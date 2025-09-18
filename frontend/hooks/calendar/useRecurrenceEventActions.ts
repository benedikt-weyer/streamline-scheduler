import { CalendarEvent } from '@/utils/calendar/calendar-types';
import { EventStateActions } from './types/eventHooks';
import { useError } from '@/utils/context/ErrorContext';
import { getDecryptedBackend } from '@/utils/api/decrypted-backend';
import { calculateNextOccurrence, calculatePreviousOccurrence } from '../../utils/calendar/recurrenceHelpers';
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
    if (!eventToDelete.recurrencePattern) {
      return { isValid: false, error: 'Missing recurrence pattern' };
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
  ): Promise<{ success: boolean; newEndDate?: Date; error?: string; deletedOriginal?: boolean }> => {
    const newEndOfOriginalEvent = calculatePreviousOccurrence(
      occurrenceStartTime,
      eventToDelete.recurrencePattern!.frequency,
      eventToDelete.recurrencePattern!.interval
    );

    if (!isValid(newEndOfOriginalEvent)) {
      return { success: false, error: "Cannot process delete: date calculation error." };
    }

    // If the calculated end date is before the original start date, 
    // it means we're trying to delete the first occurrence
    if (newEndOfOriginalEvent < eventToDelete.startTime) {
      // In this case, we should delete the entire original event instead of updating it
      const backend = getDecryptedBackend();
      try {
        await backend.calendarEvents.delete(eventToDelete.id);
        return { success: true, newEndDate: newEndOfOriginalEvent, deletedOriginal: true };
      } catch (error) {
        console.error('Failed to delete original event:', error);
        return { success: false, error: "Failed to delete original event in database." };
      }
    }

    const updatedOriginalEventData = {
      id: eventToDelete.id,
      title: eventToDelete.title,
      description: eventToDelete.description,
      location: eventToDelete.location,
      calendar_id: eventToDelete.calendarId,
      start_time: eventToDelete.startTime.toISOString(), 
      end_time: eventToDelete.endTime.toISOString(),
      all_day: eventToDelete.isAllDay || false,
      recurrence_rule: JSON.stringify({
        frequency: eventToDelete.recurrencePattern!.frequency,
        interval: eventToDelete.recurrencePattern!.interval,
        end_date: endOfDay(newEndOfOriginalEvent).toISOString(),
        days_of_week: eventToDelete.recurrencePattern!.daysOfWeek,
      }),
    };
    
    try {
      const backend = getDecryptedBackend();
      await backend.calendarEvents.update(updatedOriginalEventData);
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

    // Use the original master event's duration and time, not the modified occurrence's time
    const originalEventDuration = eventToDelete.endTime.getTime() - eventToDelete.startTime.getTime();
    if (originalEventDuration <= 0) {
      return { success: false, error: "Cannot process delete: master event duration invalid." };
    }

    // Create the new series start time using the original event's time of day
    const originalStartTime = new Date(eventToDelete.startTime);
    const newSeriesStartTime = new Date(
      nextOccurrenceStartTime.getFullYear(),
      nextOccurrenceStartTime.getMonth(),
      nextOccurrenceStartTime.getDate(),
      originalStartTime.getHours(),
      originalStartTime.getMinutes(),
      originalStartTime.getSeconds(),
      originalStartTime.getMilliseconds()
    );
    
    const newSeriesEndTime = new Date(newSeriesStartTime.getTime() + originalEventDuration);

    if (!isValid(newSeriesEndTime)) { 
      return { success: false, error: "Cannot process delete: date calculation error for new series end time." };
    }

    const newRecurringEventData = {
      title: eventToDelete.title,
      description: eventToDelete.description,
      location: eventToDelete.location,
      calendar_id: eventToDelete.calendarId,
      start_time: newSeriesStartTime.toISOString(),
      end_time: newSeriesEndTime.toISOString(),
      all_day: eventToDelete.isAllDay || false,
      recurrence_rule: JSON.stringify({
        frequency: eventToDelete.recurrencePattern!.frequency,
        interval: eventToDelete.recurrencePattern!.interval,
        end_date: originalRecurrenceEndDate ? originalRecurrenceEndDate.toISOString() : undefined,
        days_of_week: eventToDelete.recurrencePattern!.daysOfWeek,
      }),
    };

    try {
      const backend = getDecryptedBackend();
      const rawNewEventRecord = await backend.calendarEvents.create(newRecurringEventData);

      if (!rawNewEventRecord || !rawNewEventRecord.data) {
        return { success: false, error: "Failed to process event creation: invalid response from server." };
      }

      const newEventRecord = rawNewEventRecord.data;

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

    // If this is a recurrence instance, find the master event
    let masterEvent = eventToDelete;
    if (eventToDelete.isRecurrenceInstance && eventToDelete.id.includes('-recurrence-')) {
      const masterEventId = eventToDelete.id.split('-recurrence-')[0];
      const foundMasterEvent = events.find(e => e.id === masterEventId);
      if (foundMasterEvent) {
        masterEvent = foundMasterEvent;
        // Set the clicked occurrence date for proper handling
        masterEvent.clickedOccurrenceDate = eventToDelete.startTime;
      } else {
        setError('Could not find the master recurring event');
        return false;
      }
    }

    // Validate event data
    const validation = validateEventForOccurrenceDeletion(masterEvent);
    if (!validation.isValid) {
      setError(validation.error ?? 'Validation failed');
      return false;
    }

    const occurrenceStartTime = validation.occurrenceStartTime!;
    const originalRecurrenceEndDate = masterEvent.recurrencePattern!.endDate;

    try {
      // Update the original event to end before this occurrence
      const updateResult = await updateOriginalEventEndDate(masterEvent, occurrenceStartTime);
      if (!updateResult.success) {
        setError(updateResult.error ?? 'Failed to update original event');
        return false;
      }

      const newEndOfOriginalEvent = updateResult.newEndDate!;

      // Create new recurring event starting from next occurrence
      const createResult = await createNewRecurringEvent(masterEvent, occurrenceStartTime, originalRecurrenceEndDate);
      if (!createResult.success) {
        setError(createResult.error ?? 'Failed to create new recurring event');
        return false;
      }

      // Update state
      eventActions.setEvents(prevEvents => {
        let updatedEventsList = prevEvents;

        // If the original event was deleted, remove it from the list
        if (updateResult.deletedOriginal) {
          updatedEventsList = prevEvents.filter(e => e.id !== masterEvent.id);
        } else {
          // Otherwise, update it with the new end date
          const modifiedOriginalEvent: CalendarEvent = {
            ...masterEvent,
            id: masterEvent.id,
            recurrencePattern: {
              ...masterEvent.recurrencePattern!,
              endDate: endOfDay(newEndOfOriginalEvent),
            },
            updatedAt: new Date(),
          };

          updatedEventsList = prevEvents.map(e =>
            e.id === masterEvent.id ? modifiedOriginalEvent : e
          );
        }

        // Add new event if created
        if (createResult.newEvent) {
          const { record, data, startTime, endTime, originalRecurrenceEndDate: endDate } = createResult.newEvent;
          
          const newLocalEvent: CalendarEvent = {
            id: record.id,
            title: data.title,
            description: data.description,
            calendarId: data.calendarId,
            calendar: undefined,
            user_id: record.user_id,
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
    if (!eventToDelete.recurrencePattern) return false;

    // If this is a recurrence instance, find the master event
    let masterEvent = eventToDelete;
    let masterEventId = eventToDelete.id;
    if (eventToDelete.isRecurrenceInstance && eventToDelete.id.includes('-recurrence-')) {
      masterEventId = eventToDelete.id.split('-recurrence-')[0];
      const foundMasterEvent = events.find(e => e.id === masterEventId);
      if (foundMasterEvent) {
        masterEvent = foundMasterEvent;
        // Set the clicked occurrence date for proper handling
        masterEvent.clickedOccurrenceDate = eventToDelete.startTime;
      } else {
        setError('Could not find the master recurring event');
        return false;
      }
    }

    const occurrenceDateForFutureDelete = masterEvent.clickedOccurrenceDate ?? masterEvent.startTime;

    if (!isValid(occurrenceDateForFutureDelete)) {
      setError("Cannot process delete: invalid event date.");
      return false;
    }

    const newEndDate = subDays(occurrenceDateForFutureDelete, 1);

    if (!isValid(newEndDate)) {
      setError("Cannot process delete: date calculation error.");
      return false;
    }

    if (isSameDay(masterEvent.startTime, occurrenceDateForFutureDelete)) {
      // If deleting from the start, delete the entire series
      return await handleDeleteEvent(masterEventId);
    }

    try {
      const eventData = {
        id: masterEventId,
        title: masterEvent.title,
        description: masterEvent.description,
        location: masterEvent.location,
        calendar_id: masterEvent.calendarId,
        start_time: masterEvent.startTime.toISOString(),
        end_time: masterEvent.endTime.toISOString(),
        all_day: masterEvent.isAllDay || false,
        recurrence_rule: JSON.stringify({
          frequency: masterEvent.recurrencePattern!.frequency,
          interval: masterEvent.recurrencePattern!.interval,
          end_date: endOfDay(newEndDate).toISOString(),
          days_of_week: masterEvent.recurrencePattern!.daysOfWeek,
        }),
      };
      
      const backend = getDecryptedBackend();
      await backend.calendarEvents.update(eventData);

      eventActions.setEvents(prevEvents =>
        prevEvents.map(e =>
          e.id === masterEventId
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
          id: eventIdToUpdate,
          title: updatedEvent.title,
          description: updatedEvent.description ?? '',
          location: updatedEvent.location ?? '',
          calendar_id: originalEvent.calendarId,
          start_time: newMasterStartTime.toISOString(),
          end_time: newMasterEndTime.toISOString(),
          all_day: updatedEvent.isAllDay || false,
          recurrence_rule: recurrencePattern ? JSON.stringify({
            frequency: recurrencePattern.frequency,
            end_date: recurrencePattern.endDate?.toISOString(),
            interval: recurrencePattern.interval,
            days_of_week: recurrencePattern.daysOfWeek
          }) : undefined
        };
        
        if (skipNextEventReload) {
          skipNextEventReload();
        }
        
        const backend = getDecryptedBackend();
        await backend.calendarEvents.update(offsetEventData);
        
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
          id: eventIdToUpdate,
          title: updatedEvent.title,
          description: updatedEvent.description ?? '',
          location: updatedEvent.location ?? '',
          calendar_id: originalEvent.calendarId,
          start_time: updatedEvent.startTime.toISOString(),
          end_time: updatedEvent.endTime.toISOString(),
          all_day: updatedEvent.isAllDay || false,
          recurrence_rule: recurrencePattern ? JSON.stringify({
            frequency: recurrencePattern.frequency,
            end_date: recurrencePattern.endDate?.toISOString(),
            interval: recurrencePattern.interval,
            days_of_week: recurrencePattern.daysOfWeek
          }) : undefined
        };
        
        if (skipNextEventReload) {
          skipNextEventReload();
        }
        
        const backend = getDecryptedBackend();
        await backend.calendarEvents.update(eventData);
        
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
      
      const backend = getDecryptedBackend();
      await backend.calendarEvents.delete(id);
      
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

  /**
   * Handles modifying only a specific occurrence of a recurring event
   * Creates a single event and splits the recurring series
   */
  const handleModifyThisOccurrence = async (
    eventToModify: CalendarEvent,
    modifiedEventData: any
  ): Promise<boolean> => {
    if (skipNextEventReload) {
      skipNextEventReload();
    }

    // If this is a recurrence instance, find the master event
    let masterEvent = eventToModify;
    if (eventToModify.isRecurrenceInstance && eventToModify.id.includes('-recurrence-')) {
      const masterEventId = eventToModify.id.split('-recurrence-')[0];
      const foundMasterEvent = events.find(e => e.id === masterEventId);
      if (foundMasterEvent) {
        masterEvent = foundMasterEvent;
        // Set the clicked occurrence date for proper handling
        masterEvent.clickedOccurrenceDate = eventToModify.startTime;
      } else {
        setError('Could not find the master recurring event');
        return false;
      }
    }

    // Validate event data
    const validation = validateEventForOccurrenceDeletion(masterEvent);
    if (!validation.isValid) {
      setError(validation.error ?? 'Validation failed');
      return false;
    }

    const occurrenceStartTime = validation.occurrenceStartTime!;
    const originalRecurrenceEndDate = masterEvent.recurrencePattern!.endDate;

    try {
      // Step 1: Update the original event to end before this occurrence
      const updateResult = await updateOriginalEventEndDate(masterEvent, occurrenceStartTime);
      if (!updateResult.success) {
        setError(updateResult.error ?? 'Failed to update original event');
        return false;
      }

      // Step 2: Create new recurring event starting from next occurrence (if needed)
      const createResult = await createNewRecurringEvent(masterEvent, occurrenceStartTime, originalRecurrenceEndDate);
      if (!createResult.success) {
        setError(createResult.error ?? 'Failed to create new recurring event');
        return false;
      }

      // Step 3: Create the modified single event
      const singleEventData = {
        title: modifiedEventData.title,
        description: modifiedEventData.description ?? '',
        location: modifiedEventData.location ?? '',
        calendar_id: modifiedEventData.calendarId ?? masterEvent.calendarId,
        start_time: modifiedEventData.startTime.toISOString(),
        end_time: modifiedEventData.endTime.toISOString(),
        all_day: modifiedEventData.isAllDay || false
      };

      const backend = getDecryptedBackend();
      const rawSingleEventRecord = await backend.calendarEvents.create(singleEventData);

      if (!rawSingleEventRecord || !rawSingleEventRecord.data) {
        setError("Failed to process single event creation: invalid response from server.");
        return false;
      }

      const singleEventRecord = rawSingleEventRecord.data;

      // Update state with all changes
      eventActions.setEvents(prevEvents => {
        let updatedEvents = prevEvents.map(event => {
          if (event.id === masterEvent.id) {
            // Update original event with new end date
            return {
              ...event,
              recurrencePattern: {
                ...event.recurrencePattern!,
                endDate: updateResult.newEndDate
              },
              updatedAt: new Date()
            };
          }
          return event;
        });

        // Add the single modified event
        const newSingleEvent: CalendarEvent = {
          id: singleEventRecord.id,
          title: modifiedEventData.title,
          description: modifiedEventData.description ?? '',
          location: modifiedEventData.location ?? '',
          startTime: modifiedEventData.startTime,
          endTime: modifiedEventData.endTime,
          calendarId: modifiedEventData.calendarId ?? masterEvent.calendarId,
          calendar: masterEvent.calendar,
          user_id: singleEventRecord.user_id,
          isAllDay: modifiedEventData.isAllDay || false,
          createdAt: new Date(singleEventRecord.created_at),
          updatedAt: undefined
        };
        updatedEvents.push(newSingleEvent);

        // Add the new recurring event if it was created
        if (createResult.newEvent) {
          const newRecurringEvent: CalendarEvent = {
            id: createResult.newEvent.record.id,
            title: masterEvent.title,
            description: masterEvent.description ?? '',
            location: masterEvent.location ?? '',
            startTime: createResult.newEvent.startTime,
            endTime: createResult.newEvent.endTime,
            calendarId: masterEvent.calendarId,
            calendar: masterEvent.calendar,
            user_id: createResult.newEvent.record.user_id,
            isAllDay: masterEvent.isAllDay || false,
            recurrencePattern: masterEvent.recurrencePattern,
            createdAt: new Date(createResult.newEvent.record.created_at),
            updatedAt: undefined
          };
          updatedEvents.push(newRecurringEvent);
        }

        return updatedEvents.filter(event => isValid(event.startTime));
      });

      return true;
    } catch (error) {
      console.error('Failed to modify this occurrence:', error);
      setError('Failed to modify this occurrence');
      return false;
    }
  };

  /**
   * Handles modifying this and future occurrences of a recurring event
   * Splits the recurring series and updates the second part
   */
  const handleModifyThisAndFuture = async (
    eventToModify: CalendarEvent,
    modifiedEventData: any
  ): Promise<boolean> => {
    if (skipNextEventReload) {
      skipNextEventReload();
    }

    // If this is a recurrence instance, find the master event
    let masterEvent = eventToModify;
    if (eventToModify.isRecurrenceInstance && eventToModify.id.includes('-recurrence-')) {
      const masterEventId = eventToModify.id.split('-recurrence-')[0];
      const foundMasterEvent = events.find(e => e.id === masterEventId);
      if (foundMasterEvent) {
        masterEvent = foundMasterEvent;
        // Set the clicked occurrence date for proper handling
        masterEvent.clickedOccurrenceDate = eventToModify.startTime;
      } else {
        setError('Could not find the master recurring event');
        return false;
      }
    }

    // Validate event data
    const validation = validateEventForOccurrenceDeletion(masterEvent);
    if (!validation.isValid) {
      setError(validation.error ?? 'Validation failed');
      return false;
    }

    const occurrenceStartTime = validation.occurrenceStartTime!;
    const originalRecurrenceEndDate = masterEvent.recurrencePattern!.endDate;

    try {
      // Step 1: Update the original event to end before this occurrence
      const updateResult = await updateOriginalEventEndDate(masterEvent, occurrenceStartTime);
      if (!updateResult.success) {
        setError(updateResult.error ?? 'Failed to update original event');
        return false;
      }

      // Step 2: Create new recurring event with modified data starting from this occurrence
      const eventDuration = masterEvent.endTime.getTime() - masterEvent.startTime.getTime();
      const newSeriesStartTime = modifiedEventData.startTime;
      const newSeriesEndTime = modifiedEventData.endTime;

      const newRecurringEventData = {
        title: modifiedEventData.title,
        description: modifiedEventData.description ?? '',
        location: modifiedEventData.location ?? '',
        calendar_id: modifiedEventData.calendarId ?? masterEvent.calendarId,
        start_time: newSeriesStartTime.toISOString(),
        end_time: newSeriesEndTime.toISOString(),
        all_day: modifiedEventData.isAllDay || false,
        recurrence_rule: JSON.stringify({
          frequency: masterEvent.recurrencePattern!.frequency,
          interval: masterEvent.recurrencePattern!.interval,
          end_date: originalRecurrenceEndDate ? originalRecurrenceEndDate.toISOString() : undefined,
          days_of_week: masterEvent.recurrencePattern!.daysOfWeek,
        }),
      };

      const backend = getDecryptedBackend();
      const rawNewEventRecord = await backend.calendarEvents.create(newRecurringEventData);

      if (!rawNewEventRecord || !rawNewEventRecord.data) {
        setError("Failed to process event creation: invalid response from server.");
        return false;
      }

      const newEventRecord = rawNewEventRecord.data;

      // Update state with all changes
      eventActions.setEvents(prevEvents => {
        let updatedEvents = prevEvents.map(event => {
          if (event.id === masterEvent.id) {
            // Update original event with new end date
            return {
              ...event,
              recurrencePattern: {
                ...event.recurrencePattern!,
                endDate: updateResult.newEndDate
              },
              updatedAt: new Date()
            };
          }
          return event;
        });

        // Add the new modified recurring event
        const newRecurringEvent: CalendarEvent = {
          id: newEventRecord.id,
          title: modifiedEventData.title,
          description: modifiedEventData.description ?? '',
          location: modifiedEventData.location ?? '',
          startTime: newSeriesStartTime,
          endTime: newSeriesEndTime,
          calendarId: modifiedEventData.calendarId ?? masterEvent.calendarId,
          calendar: masterEvent.calendar,
          user_id: newEventRecord.user_id,
          isAllDay: modifiedEventData.isAllDay || false,
          recurrencePattern: masterEvent.recurrencePattern,
          createdAt: new Date(newEventRecord.created_at),
          updatedAt: undefined
        };
        updatedEvents.push(newRecurringEvent);

        return updatedEvents.filter(event => isValid(event.startTime));
      });

      return true;
    } catch (error) {
      console.error('Failed to modify this and future occurrences:', error);
      setError('Failed to modify this and future occurrences');
      return false;
    }
  };

  /**
   * Handles modifying all occurrences in the series
   * Simply updates the master recurring event
   */
  const handleModifyAllInSeries = async (
    eventToModify: CalendarEvent,
    modifiedEventData: any
  ): Promise<boolean> => {

    // If this is a recurrence instance, find the master event
    let masterEvent = eventToModify;
    if (eventToModify.isRecurrenceInstance && eventToModify.id.includes('-recurrence-')) {
      const masterEventId = eventToModify.id.split('-recurrence-')[0];
      const foundMasterEvent = events.find(e => e.id === masterEventId);
      if (foundMasterEvent) {
        masterEvent = foundMasterEvent;
      } else {
        setError('Could not find the master recurring event');
        return false;
      }
    }

    try {
      if (skipNextEventReload) {
        skipNextEventReload();
      }

      // For "modify all in series", preserve the original start date but update the time
      const originalStartDate = new Date(masterEvent.startTime);
      const newStartTime = new Date(modifiedEventData.startTime);
      const newEndTime = new Date(modifiedEventData.endTime);
      
      // Calculate the time difference to apply to the master event
      const timeDifference = newEndTime.getTime() - newStartTime.getTime();
      
      // Create the new start time with original date but new time
      const updatedStartTime = new Date(
        originalStartDate.getFullYear(),
        originalStartDate.getMonth(),
        originalStartDate.getDate(),
        newStartTime.getHours(),
        newStartTime.getMinutes(),
        newStartTime.getSeconds(),
        newStartTime.getMilliseconds()
      );
      
      // Create the new end time maintaining the duration
      const updatedEndTime = new Date(updatedStartTime.getTime() + timeDifference);

      const eventData = {
        id: masterEvent.id,
        title: modifiedEventData.title,
        description: modifiedEventData.description ?? '',
        location: modifiedEventData.location ?? '',
        calendar_id: modifiedEventData.calendarId ?? masterEvent.calendarId,
        start_time: updatedStartTime.toISOString(),
        end_time: updatedEndTime.toISOString(),
        all_day: modifiedEventData.isAllDay || false,
        recurrence_rule: masterEvent.recurrencePattern ? JSON.stringify({
          frequency: masterEvent.recurrencePattern.frequency,
          end_date: masterEvent.recurrencePattern.endDate?.toISOString(),
          interval: masterEvent.recurrencePattern.interval,
          days_of_week: masterEvent.recurrencePattern.daysOfWeek
        }) : undefined
      };

      const backend = getDecryptedBackend();
      await backend.calendarEvents.update(eventData);

      // Update state
      eventActions.setEvents(prevEvents =>
        prevEvents.map(event =>
          event.id === masterEvent.id ? {
            ...event,
            title: modifiedEventData.title,
            description: modifiedEventData.description ?? '',
            location: modifiedEventData.location ?? '',
            calendarId: modifiedEventData.calendarId ?? masterEvent.calendarId,
            startTime: updatedStartTime,
            endTime: updatedEndTime,
            updatedAt: new Date()
          } : event
        )
      );

      return true;
    } catch (error) {
      console.error('Failed to modify all in series:', error);
      setError('Failed to modify all events in series');
      return false;
    }
  };

  return {
    handleDeleteThisOccurrence,
    handleDeleteThisAndFuture,
    handleEventUpdate,
    handleModifyThisOccurrence,
    handleModifyThisAndFuture,
    handleModifyAllInSeries
  };
};
