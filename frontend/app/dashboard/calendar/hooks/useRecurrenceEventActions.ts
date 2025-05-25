import { CalendarEvent } from '@/utils/calendar/calendar-types';
import { EventStateActions } from '../types/eventHooks';
import { useError } from '@/utils/context/ErrorContext';
import { 
  updateCalendarEvent, 
  addCalendarEvent
} from '../actions';
import { encryptEventData } from '../utils/eventEncryption';
import { calculateNextOccurrence, calculatePreviousOccurrence } from '../utils/recurrenceHelpers';
import { 
  subDays,
  isSameDay,
  isValid,
  endOfDay
} from 'date-fns';

/**
 * Hook for handling recurrence-specific event actions
 */
export const useRecurrenceEventActions = (
  events: CalendarEvent[],
  eventActions: EventStateActions,
  encryptionKey: string | null,
  skipNextEventReload?: () => void
) => {
  const { setError } = useError();

  /**
   * Validates the event data for occurrence deletion
   */
  const validateEventForOccurrenceDeletion = (eventToDelete: CalendarEvent): { 
    isValid: boolean; 
    occurrenceStartTime?: Date; 
    error?: string; 
  } => {
    if (!encryptionKey || !eventToDelete.recurrencePattern) {
      return { isValid: false, error: 'Missing encryption key or recurrence pattern' };
    }

    const occurrenceStartTime = eventToDelete.clickedOccurrenceDate ?? eventToDelete.startTime;

    if (!isValid(occurrenceStartTime)) {
      return { isValid: false, error: "Cannot process delete: invalid event date." };
    }

    if (!isValid(eventToDelete.startTime) || !isValid(eventToDelete.endTime) || eventToDelete.endTime <= eventToDelete.startTime) {
      return { isValid: false, error: "Cannot process delete: master event data is corrupted." };
    }

    return { isValid: true, occurrenceStartTime };
  };

  /**
   * Updates the original event to end before the deleted occurrence
   */
  const updateOriginalEventEndDate = async (
    eventToDelete: CalendarEvent, 
    occurrenceStartTime: Date
  ): Promise<{ success: boolean; newEndDate?: Date; error?: string }> => {
    const newEndOfOriginalEvent = calculatePreviousOccurrence(occurrenceStartTime);

    if (!isValid(newEndOfOriginalEvent)) {
      return { success: false, error: "Cannot process delete: date calculation error." };
    }

    const updatedOriginalEventData = {
      title: eventToDelete.title,
      description: eventToDelete.description,
      calendarId: eventToDelete.calendarId,
      startTime: eventToDelete.startTime.toISOString(), 
      endTime: eventToDelete.endTime.toISOString(), 
      recurrenceFrequency: eventToDelete.recurrencePattern!.frequency,
      recurrenceInterval: eventToDelete.recurrencePattern!.interval,
      recurrenceEndDate: endOfDay(newEndOfOriginalEvent).toISOString(),
      daysOfWeek: eventToDelete.recurrencePattern!.daysOfWeek,
    };
    
    try {
      const { encryptedData: encryptedOriginalEventData, salt, iv } = encryptEventData(updatedOriginalEventData, encryptionKey!);
      await updateCalendarEvent(eventToDelete.id, encryptedOriginalEventData, iv, salt);
      return { success: true, newEndDate: newEndOfOriginalEvent };
    } catch (error) {
      console.error('Failed to update original event:', error);
      return { success: false, error: "Failed to update original event in database." };
    }
  };

  /**
   * Creates a new recurring event starting from the next occurrence
   */
  const createNewRecurringEvent = async (
    eventToDelete: CalendarEvent,
    occurrenceStartTime: Date,
    originalRecurrenceEndDate?: Date
  ): Promise<{ success: boolean; newEvent?: any; error?: string }> => {
    const nextOccurrenceStartTime = calculateNextOccurrence(
      occurrenceStartTime,
      eventToDelete.recurrencePattern!.frequency,
      eventToDelete.recurrencePattern!.interval
    );

    if (!isValid(nextOccurrenceStartTime)) {
      return { success: false, error: "Cannot process delete: date calculation error for next occurrence." };
    }

    // If the next occurrence would be after the original end date, no new event needed
    if (originalRecurrenceEndDate && isValid(originalRecurrenceEndDate) && nextOccurrenceStartTime > originalRecurrenceEndDate) {
      return { success: true }; // No new event needed
    }

    const eventDuration = eventToDelete.endTime.getTime() - eventToDelete.startTime.getTime();
    if (eventDuration <= 0) {
      return { success: false, error: "Cannot process delete: master event duration invalid." };
    }

    const newSeriesStartTime = nextOccurrenceStartTime; 
    const newSeriesEndTime = new Date(newSeriesStartTime.getTime() + eventDuration);

    if (!isValid(newSeriesEndTime)) { 
      return { success: false, error: "Cannot process delete: date calculation error for new series end time." };
    }

    const newRecurringEventData = {
      title: eventToDelete.title,
      description: eventToDelete.description,
      calendarId: eventToDelete.calendarId,
      startTime: newSeriesStartTime.toISOString(),
      endTime: newSeriesEndTime.toISOString(),
      recurrenceFrequency: eventToDelete.recurrencePattern!.frequency,
      recurrenceInterval: eventToDelete.recurrencePattern!.interval,
      recurrenceEndDate: originalRecurrenceEndDate ? originalRecurrenceEndDate.toISOString() : undefined,
      daysOfWeek: eventToDelete.recurrencePattern!.daysOfWeek,
    };

    try {
      const { encryptedData: encryptedNewEventData, salt: newSalt, iv: newIv } = encryptEventData(newRecurringEventData, encryptionKey!);
      const rawNewEventRecord = await addCalendarEvent(encryptedNewEventData, newIv, newSalt);

      let newEventRecord: any; 
      if (Array.isArray(rawNewEventRecord) && rawNewEventRecord.length > 0) {
        newEventRecord = rawNewEventRecord[0];
      } else if (rawNewEventRecord && typeof rawNewEventRecord === 'object' && !Array.isArray(rawNewEventRecord)) {
        newEventRecord = rawNewEventRecord;
      } else {
        return { success: false, error: "Failed to process event creation: invalid response from server." };
      }

      if (!newEventRecord || typeof newEventRecord.id === 'undefined' || typeof newEventRecord.created_at === 'undefined') {
        return { success: false, error: "Failed to process event creation: essential data missing from server response." };
      }

      return { 
        success: true, 
        newEvent: {
          record: newEventRecord,
          data: newRecurringEventData,
          startTime: newSeriesStartTime,
          endTime: newSeriesEndTime,
          originalRecurrenceEndDate
        }
      };
    } catch (error) {
      console.error('Failed to create new recurring event:', error);
      return { success: false, error: "Failed to create new recurring event." };
    }
  };

  const handleDeleteThisOccurrence = async (eventToDelete: CalendarEvent): Promise<boolean> => {
    if (skipNextEventReload) {
      skipNextEventReload(); 
    }

    // Validate event data
    const validation = validateEventForOccurrenceDeletion(eventToDelete);
    if (!validation.isValid) {
      setError(validation.error ?? 'Validation failed');
      return false;
    }

    const occurrenceStartTime = validation.occurrenceStartTime!;
    const originalRecurrenceEndDate = eventToDelete.recurrencePattern!.endDate;

    try {
      // Update the original event to end before this occurrence
      const updateResult = await updateOriginalEventEndDate(eventToDelete, occurrenceStartTime);
      if (!updateResult.success) {
        setError(updateResult.error ?? 'Failed to update original event');
        return false;
      }

      const newEndOfOriginalEvent = updateResult.newEndDate!;

      // Create new recurring event starting from next occurrence
      const createResult = await createNewRecurringEvent(eventToDelete, occurrenceStartTime, originalRecurrenceEndDate);
      if (!createResult.success) {
        setError(createResult.error ?? 'Failed to create new recurring event');
        return false;
      }

      // Update state
      eventActions.setEvents(prevEvents => {
        const modifiedOriginalEvent: CalendarEvent = {
          ...eventToDelete,
          id: eventToDelete.id,
          recurrencePattern: {
            ...eventToDelete.recurrencePattern!,
            endDate: endOfDay(newEndOfOriginalEvent),
          },
          updatedAt: new Date(),
        };

        let updatedEventsList = prevEvents.map(e =>
          e.id === eventToDelete.id ? modifiedOriginalEvent : e
        );

        // Add new event if created
        if (createResult.newEvent) {
          const { record, data, startTime, endTime, originalRecurrenceEndDate: endDate } = createResult.newEvent;
          
          const newLocalEvent: CalendarEvent = {
            id: record.id,
            title: data.title,
            description: data.description,
            calendarId: data.calendarId,
            calendar: undefined,
            startTime, 
            endTime,   
            recurrencePattern: {
              frequency: data.recurrenceFrequency,
              interval: data.recurrenceInterval,
              endDate: endDate ? endOfDay(endDate) : undefined, 
              daysOfWeek: data.daysOfWeek,
            },
            createdAt: new Date(record.created_at), 
            updatedAt: record.updated_at ? new Date(record.updated_at) : undefined,
          };

          updatedEventsList = [...updatedEventsList, newLocalEvent];
        }
        
        return updatedEventsList.filter(event => isValid(event.startTime));
      });
      
      return true;
    } catch (error) {
      console.error('Failed to delete this event occurrence:', error);
      setError('Failed to delete this event occurrence.');
      return false;
    }
  };

  const handleDeleteThisAndFuture = async (eventToDelete: CalendarEvent): Promise<boolean> => {
    if (!encryptionKey || !eventToDelete.recurrencePattern) return false;

    const eventId = eventToDelete.id;
    const occurrenceDateForFutureDelete = eventToDelete.clickedOccurrenceDate ?? eventToDelete.startTime;

    if (!isValid(occurrenceDateForFutureDelete)) {
      setError("Cannot process delete: invalid event date.");
      return false;
    }

    const newEndDate = subDays(occurrenceDateForFutureDelete, 1);

    if (!isValid(newEndDate)) {
      setError("Cannot process delete: date calculation error.");
      return false;
    }

    if (isSameDay(eventToDelete.startTime, occurrenceDateForFutureDelete)) {
      // If deleting from the start, delete the entire series
      return await handleDeleteEvent(eventId);
    }

    try {
      const eventData = {
        title: eventToDelete.title,
        description: eventToDelete.description,
        calendarId: eventToDelete.calendarId,
        startTime: eventToDelete.startTime.toISOString(),
        endTime: eventToDelete.endTime.toISOString(),
        recurrenceFrequency: eventToDelete.recurrencePattern.frequency,
        recurrenceInterval: eventToDelete.recurrencePattern.interval,
        recurrenceEndDate: endOfDay(newEndDate).toISOString(),
        daysOfWeek: eventToDelete.recurrencePattern.daysOfWeek,
      };
      
      const { encryptedData, salt, iv } = encryptEventData(eventData, encryptionKey);
      await updateCalendarEvent(eventId, encryptedData, iv, salt);

      eventActions.setEvents(prevEvents =>
        prevEvents.map(e =>
          e.id === eventId
            ? {
                ...e,
                recurrencePattern: {
                  ...e.recurrencePattern!,
                  endDate: endOfDay(newEndDate),
                },
                updatedAt: new Date(),
              }
            : e
        ).filter(event => isValid(event.startTime))
      );
      
      if (skipNextEventReload) skipNextEventReload();
      return true;
    } catch (error) {
      console.error('Error deleting this and future events:', error);
      setError('Failed to delete this and future events.');
      return false;
    }
  };

  const handleEventUpdate = async (updatedEvent: CalendarEvent): Promise<boolean> => {
    if (!encryptionKey) return false;
    
    try {
      // Check if this is a recurring event instance
      const isRecurrenceInstance = updatedEvent.isRecurrenceInstance || updatedEvent.id.includes('-recurrence-');
      let originalEvent: CalendarEvent | undefined;
      let eventIdToUpdate: string;
      
      if (isRecurrenceInstance) {
        // Extract the master event ID from the recurrence instance ID
        const masterEventId = updatedEvent.id.split('-recurrence-')[0];
        originalEvent = events.find(e => e.id === masterEventId);
        eventIdToUpdate = masterEventId;
        
        if (!originalEvent) {
          console.error('Master recurring event not found for instance ID:', updatedEvent.id);
          setError('Failed to update recurring event: Master event not found');
          return false;
        }
      } else {
        // Regular event - find it directly
        originalEvent = events.find(e => e.id === updatedEvent.id);
        eventIdToUpdate = updatedEvent.id;
        
        if (!originalEvent) {
          console.error('Original event not found for ID:', updatedEvent.id);
          setError('Failed to update event: Event not found in current state');
          return false;
        }
      }
      
      // Preserve recurrence pattern from the original event if it exists
      const recurrencePattern = originalEvent.recurrencePattern;
      
      if (isRecurrenceInstance) {
        // For recurring event instances, calculate the time offset and apply it to the master event
        const instanceDateStr = updatedEvent.id.split('-recurrence-')[1];
        const instanceDate = new Date(instanceDateStr);
        
        // Calculate what the original instance time would have been
        const originalInstanceStartTime = new Date(instanceDate);
        originalInstanceStartTime.setHours(
          originalEvent.startTime.getHours(),
          originalEvent.startTime.getMinutes(),
          originalEvent.startTime.getSeconds(),
          originalEvent.startTime.getMilliseconds()
        );
        
        const originalInstanceEndTime = new Date(instanceDate);
        originalInstanceEndTime.setHours(
          originalEvent.endTime.getHours(),
          originalEvent.endTime.getMinutes(),
          originalEvent.endTime.getSeconds(),
          originalEvent.endTime.getMilliseconds()
        );
        
        // Calculate time offsets for both start and end times
        const startTimeOffsetMs = updatedEvent.startTime.getTime() - originalInstanceStartTime.getTime();
        const endTimeOffsetMs = updatedEvent.endTime.getTime() - originalInstanceEndTime.getTime();
        
        // Apply offsets to the master event's original times
        const newMasterStartTime = new Date(originalEvent.startTime.getTime() + startTimeOffsetMs);
        const newMasterEndTime = new Date(originalEvent.endTime.getTime() + endTimeOffsetMs);
        
        const offsetEventData = {
          title: updatedEvent.title,
          description: updatedEvent.description ?? '',
          calendarId: originalEvent.calendarId,
          startTime: newMasterStartTime.toISOString(),
          endTime: newMasterEndTime.toISOString(),
          recurrenceFrequency: recurrencePattern?.frequency,
          recurrenceEndDate: recurrencePattern?.endDate?.toISOString(),
          recurrenceInterval: recurrencePattern?.interval,
          daysOfWeek: recurrencePattern?.daysOfWeek
        };
        
        const { encryptedData: offsetEncryptedData, salt, iv } = encryptEventData(offsetEventData, encryptionKey);
        
        if (skipNextEventReload) {
          skipNextEventReload();
        }
        
        await updateCalendarEvent(eventIdToUpdate, offsetEncryptedData, iv, salt);
        
        eventActions.setEvents(prevEvents =>
          prevEvents.map(event =>
            event.id === eventIdToUpdate ? {
              ...event,
              startTime: newMasterStartTime,
              endTime: newMasterEndTime,
              updatedAt: new Date()
            } : event
          )
        );
      } else {
        // For regular events, update normally
        const eventData = {
          title: updatedEvent.title,
          description: updatedEvent.description ?? '',
          calendarId: originalEvent.calendarId,
          startTime: updatedEvent.startTime.toISOString(),
          endTime: updatedEvent.endTime.toISOString(),
          recurrenceFrequency: recurrencePattern?.frequency,
          recurrenceEndDate: recurrencePattern?.endDate?.toISOString(),
          recurrenceInterval: recurrencePattern?.interval,
          daysOfWeek: recurrencePattern?.daysOfWeek
        };
        
        const { encryptedData, salt, iv } = encryptEventData(eventData, encryptionKey);
        
        if (skipNextEventReload) {
          skipNextEventReload();
        }
        
        await updateCalendarEvent(eventIdToUpdate, encryptedData, iv, salt);
        
        eventActions.setEvents(prevEvents =>
          prevEvents.map(event =>
            event.id === updatedEvent.id ? {
              ...updatedEvent,
              calendarId: originalEvent.calendarId,
              calendar: originalEvent.calendar,
              recurrencePattern
            } : event
          )
        );
      }
      
      return true;
    } catch (error) {
      console.error('Error updating dragged event:', error);
      setError('Failed to update event position');
      return false;
    }
  };

  // We need to include handleDeleteEvent from CRUD for the delete all logic
  const handleDeleteEvent = async (id: string): Promise<boolean> => {
    try {
      if (skipNextEventReload) {
        skipNextEventReload();
      }
      
      const { deleteCalendarEvent } = await import('../actions');
      await deleteCalendarEvent(id);
      
      eventActions.setEvents(prevEvents => 
        prevEvents
          .filter(event => event.id !== id)
          .filter(event => isValid(event.startTime))
      );
      return true;
    } catch (error) {
      console.error('Error deleting event:', error);
      setError('Failed to delete event');
      return false;
    }
  };

  return {
    handleDeleteThisOccurrence,
    handleDeleteThisAndFuture,
    handleEventUpdate
  };
};
