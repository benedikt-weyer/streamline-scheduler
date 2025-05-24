import { useState, useEffect, useRef } from 'react';
import { 
  fetchCalendarEvents, 
  addCalendarEvent, 
  updateCalendarEvent, 
  deleteCalendarEvent,
  updateEventCalendar
} from '../actions';
import { 
  Calendar, 
  CalendarEvent, 
  EventFormValues, 
  RecurrenceFrequency, 
  RecurrencePattern 
} from '@/utils/types';
import { 
  generateSalt, 
  generateIV, 
  deriveKeyFromPassword, 
  encryptData,
  decryptData
} from '@/utils/encryption';
import { useError } from '@/utils/context/ErrorContext';
import { 
  addDays,
  addWeeks,
  addMonths,
  addYears,
  subDays,
  isSameDay,
  format,
  isValid,
  endOfDay
} from 'date-fns';

// Helper function to combine date and time
const combineDateAndTime = (date: Date | string, time: string): Date => {
  const result = new Date(date);
  const [hours, minutes] = time.split(':').map(Number);
  result.setHours(hours, minutes, 0, 0);
  return result;
};

export function useCalendarEvents(encryptionKey: string | null, calendars: Calendar[], skipNextEventReload?: () => void) {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const { setError } = useError();

  // Consolidated useEffect to synchronize event.calendar details from the main calendars list
  useEffect(() => {
    if (events.length > 0 && calendars.length > 0) {
      let hasChanges = false;
      let changeDetectedForEventId: string | null = null;
      let oldCalendarDetails: any = null;
      let newCalendarDetails: any = null;

      const newEvents = events.map(event => {
        const foundCalendar = calendars.find(c => c.id === event.calendarId);
        
        if (foundCalendar) {
          // Normalize foundCalendar for consistent comparison and usage
          const normalizedCorrespondingCalendar = {
            id: foundCalendar.id,
            name: foundCalendar.name,
            color: foundCalendar.color,
            isVisible: foundCalendar.isVisible,
            isDefault: foundCalendar.isDefault ?? false, // Treat undefined as false
            createdAt: foundCalendar.createdAt,
            updatedAt: foundCalendar.updatedAt
          };

          // Normalize event.calendar for consistent comparison (if it exists)
          const normalizedEventCalendar = event.calendar ? {
            id: event.calendar.id,
            name: event.calendar.name,
            color: event.calendar.color,
            isVisible: event.calendar.isVisible,
            isDefault: event.calendar.isDefault ?? false, // Treat undefined as false
            createdAt: event.calendar.createdAt,
            updatedAt: event.calendar.updatedAt
          } : undefined;

          if (!normalizedEventCalendar || 
              normalizedEventCalendar.id !== normalizedCorrespondingCalendar.id ||
              normalizedEventCalendar.name !== normalizedCorrespondingCalendar.name ||
              normalizedEventCalendar.color !== normalizedCorrespondingCalendar.color ||
              normalizedEventCalendar.isVisible !== normalizedCorrespondingCalendar.isVisible ||
              normalizedEventCalendar.isDefault !== normalizedCorrespondingCalendar.isDefault
             ) {
            if (!hasChanges) {
              changeDetectedForEventId = event.id;
              oldCalendarDetails = event.calendar ? { ...event.calendar } : null;
              newCalendarDetails = { ...normalizedCorrespondingCalendar }; 
            }
            hasChanges = true;
            return { ...event, calendar: normalizedCorrespondingCalendar }; 
          }
        } else if (event.calendar) {
          if (!hasChanges) {
            changeDetectedForEventId = event.id;
            oldCalendarDetails = { ...event.calendar };
            newCalendarDetails = 'undefined (calendar missing from source)';
          }
          hasChanges = true;
          return { ...event, calendar: undefined };
        }
        return event;
      });

      if (hasChanges) {
        setEvents(newEvents
          .filter(event => isValid(event.startTime)) 
          .sort((a, b) => a.startTime.getTime() - b.startTime.getTime()));
      }
    }
  }, [events, calendars, setEvents]);

  // Load and decrypt events
  const loadEvents = async (key: string) => {
    try {
      setIsLoading(true);
      const encryptedEvents = await fetchCalendarEvents();
      if (encryptedEvents.length === 0) {
        setEvents([]);
        setIsLoading(false);
        return [];
      }
      return await loadEventsWithCalendars(key, encryptedEvents);
    } catch (error) {
      console.error('Error loading events:', error);
      setError('Failed to load your Calendar events');
      setIsLoading(false);
      return [];
    }
  };

  // Load events with the calendars available in state
  const loadEventsWithCalendars = async (key: string, encryptedEvents: any[] = []): Promise<CalendarEvent[]> => {
    try {
      if (encryptedEvents.length === 0) {
        encryptedEvents = await fetchCalendarEvents();
      }
      const decryptedEvents = encryptedEvents
        .map(event => {
          try {
            const salt = event.salt;
            const iv = event.iv;
            const derivedKey = deriveKeyFromPassword(key, salt);
            if (!event.encrypted_data) {
              console.error('Event data is undefined for event:', event.id);
              return null;
            }
            const decryptedData = decryptData(event.encrypted_data, derivedKey, iv);
            if (!decryptedData) {
              console.error('Failed to decrypt event data for event:', event.id);
              return null;
            }
            const startTime = new Date(decryptedData.startTime);
            const endTime = new Date(decryptedData.endTime);
            if (!isValid(startTime) || !isValid(endTime)) {
              console.error('Invalid date found for event after decryption:', event.id, 
                { startTime: decryptedData.startTime, endTime: decryptedData.endTime });
              return null;
            }
            let recurrencePattern: RecurrencePattern | undefined;
            if (decryptedData.recurrenceFrequency && decryptedData.recurrenceFrequency !== RecurrenceFrequency.None) {
              recurrencePattern = {
                frequency: decryptedData.recurrenceFrequency,
                interval: decryptedData.recurrenceInterval ?? 1,
                endDate: decryptedData.recurrenceEndDate ? new Date(decryptedData.recurrenceEndDate) : undefined,
                daysOfWeek: decryptedData.daysOfWeek
              };
            }
            const calendar = calendars.find(cal => cal.id === decryptedData.calendarId);
            return {
              id: event.id,
              title: decryptedData.title,
              description: decryptedData.description,
              calendarId: decryptedData.calendarId,
              calendar: calendar,
              startTime,
              endTime,
              recurrencePattern,
              createdAt: new Date(event.created_at),
              updatedAt: event.updated_at ? new Date(event.updated_at) : undefined
            };
          } catch (error) {
            console.error('Error decrypting event:', error);
            return null;
          }
        })
        .filter((event): event is NonNullable<typeof event> => event !== null)
        .filter(event => isValid(event.startTime))
        .sort((a, b) => a.startTime.getTime() - b.startTime.getTime());
      setEvents(decryptedEvents);
      setIsLoading(false);
      return decryptedEvents;
    } catch (error) {
      console.error('Error in loadEventsWithCalendars:', error);
      setError('Failed to load your Calendar events');
      setIsLoading(false);
      throw error;
    }
  };

  // Add a new event or update existing one
  const handleSubmitEvent = async (values: EventFormValues) => {
    if (!encryptionKey) return;
    try {
      const salt = generateSalt();
      const iv = generateIV();
      const derivedKey = deriveKeyFromPassword(encryptionKey, salt);
      const startDateTime = combineDateAndTime(values.startDate, values.startTime);
      const endDateTime = combineDateAndTime(values.endDate, values.endTime);
      let recurrencePattern: RecurrencePattern | undefined;
      if (values.recurrenceFrequency && values.recurrenceFrequency !== RecurrenceFrequency.None) {
        recurrencePattern = {
          frequency: values.recurrenceFrequency,
          interval: values.recurrenceInterval ?? 1,
          endDate: values.recurrenceEndDate ? endOfDay(new Date(values.recurrenceEndDate)) : undefined,
          daysOfWeek: values.daysOfWeek
        };
      }
      const calendar = calendars.find(cal => cal.id === values.calendarId);
      const eventData = {
        title: values.title.trim(),
        description: values.description?.trim() ?? '',
        calendarId: values.calendarId,
        startTime: startDateTime.toISOString(),
        endTime: endDateTime.toISOString(),
        recurrenceFrequency: values.recurrenceFrequency,
        recurrenceEndDate: values.recurrenceEndDate ? endOfDay(new Date(values.recurrenceEndDate)).toISOString() : undefined,
        recurrenceInterval: values.recurrenceInterval,
        daysOfWeek: values.daysOfWeek
      };
      const encryptedData = encryptData(eventData, derivedKey, iv);
      if (values.id && values.id !== 'new') {
        if (skipNextEventReload) {
          skipNextEventReload();
        }
        await updateCalendarEvent(values.id, encryptedData, iv, salt);
        setEvents(prevEvents => 
          prevEvents.map(event => 
            event.id === values.id 
              ? {
                  ...event,
                  title: values.title.trim(),
                  description: values.description?.trim() ?? '',
                  calendarId: values.calendarId,
                  calendar: calendar,
                  startTime: startDateTime,
                  endTime: endDateTime,
                  recurrencePattern,
                  updatedAt: new Date()
                } 
              : event
          ).sort((a, b) => a.startTime.getTime() - b.startTime.getTime())
        );
      } else {
        if (skipNextEventReload) {
          skipNextEventReload();
        }
        const newEventRecord = await addCalendarEvent(encryptedData, iv, salt);
        const newEvent: CalendarEvent = {
          id: newEventRecord.id,
          title: values.title.trim(),
          description: values.description?.trim() ?? '',
          calendarId: values.calendarId,
          calendar: calendar,
          startTime: startDateTime,
          endTime: endDateTime,
          recurrencePattern,
          createdAt: new Date(newEventRecord.created_at),
          updatedAt: newEventRecord.updated_at ? new Date(newEventRecord.updated_at) : undefined
        };
        setEvents(prevEvents => 
          [...prevEvents, newEvent].sort((a, b) => a.startTime.getTime() - b.startTime.getTime())
        );
      }
      return true;
    } catch (error) {
      console.error('Error saving event:', error);
      setError('Failed to save event');
      return false;
    }
  };

  // Delete an event
  const handleDeleteEvent = async (id: string) => {
    try {
      if (skipNextEventReload) {
        skipNextEventReload();
      }
      await deleteCalendarEvent(id);
      setEvents(prevEvents => prevEvents
        .filter(event => event.id !== id)
        .filter(event => isValid(event.startTime))
        .sort((a, b) => a.startTime.getTime() - b.startTime.getTime()));
      return true;
    } catch (error) {
      console.error('Error deleting event:', error);
      setError('Failed to delete event');
      return false;
    }
  };

  // Handler to delete only a single occurrence of a recurring event
  const handleDeleteThisOccurrence = async (eventToDelete: CalendarEvent) => {
    if (skipNextEventReload) {
        skipNextEventReload(); 
    }

    if (!encryptionKey || !eventToDelete.recurrencePattern) {
      return false;
    }

    const originalEventId = eventToDelete.id;
    const occurrenceStartTime = eventToDelete.clickedOccurrenceDate ?? eventToDelete.startTime;

    if (!isValid(occurrenceStartTime)) {
      setError("Cannot process delete: invalid event date.");
      return false;
    }

    if (!isValid(eventToDelete.startTime) || !isValid(eventToDelete.endTime) || eventToDelete.endTime <= eventToDelete.startTime) {
        setError("Cannot process delete: master event data is corrupted.");
        return false;
    }
    try {
      const salt = generateSalt();
      const iv = generateIV();
      const derivedKey = deriveKeyFromPassword(encryptionKey, salt);

      const originalRecurrenceEndDate = eventToDelete.recurrencePattern.endDate;
      const newEndOfOriginalEvent = subDays(occurrenceStartTime, 1);

      if (!isValid(newEndOfOriginalEvent)) {
        setError("Cannot process delete: date calculation error.");
        return false;
      }

      const updatedOriginalEventData = {
        title: eventToDelete.title,
        description: eventToDelete.description,
        calendarId: eventToDelete.calendarId,
        startTime: eventToDelete.startTime.toISOString(), 
        endTime: eventToDelete.endTime.toISOString(), 
        recurrenceFrequency: eventToDelete.recurrencePattern.frequency,
        recurrenceInterval: eventToDelete.recurrencePattern.interval,
        recurrenceEndDate: endOfDay(newEndOfOriginalEvent).toISOString(),
        daysOfWeek: eventToDelete.recurrencePattern.daysOfWeek,
      };
      const encryptedOriginalEventData = encryptData(updatedOriginalEventData, derivedKey, iv);
      await updateCalendarEvent(originalEventId, encryptedOriginalEventData, iv, salt);

      let nextOccurrenceStartTime = new Date(occurrenceStartTime);
      const interval = eventToDelete.recurrencePattern.interval || 1;
      switch (eventToDelete.recurrencePattern.frequency) {
        case RecurrenceFrequency.Daily:
          nextOccurrenceStartTime = addDays(nextOccurrenceStartTime, interval);
          break;
        case RecurrenceFrequency.Weekly:
          nextOccurrenceStartTime = addWeeks(nextOccurrenceStartTime, interval);
          break;
        case RecurrenceFrequency.BiWeekly:
            nextOccurrenceStartTime = addWeeks(nextOccurrenceStartTime, 2 * interval);
            break;
        case RecurrenceFrequency.Monthly:
          nextOccurrenceStartTime = addMonths(nextOccurrenceStartTime, interval);
          break;
        case RecurrenceFrequency.Yearly:
          nextOccurrenceStartTime = addYears(nextOccurrenceStartTime, interval);
          break;
        default:
          setError("Cannot process delete: unknown recurrence type.");
          return false; 
      }
      
      if (!isValid(nextOccurrenceStartTime)) {
        setError("Cannot process delete: date calculation error for next occurrence.");
        return false;
      }
                  
      if (originalRecurrenceEndDate && isValid(originalRecurrenceEndDate) && nextOccurrenceStartTime > originalRecurrenceEndDate) {
        const stateForNoNewSeries = (prevEvents: CalendarEvent[]) => {
            const eventsToUpdate = prevEvents.map((e: CalendarEvent) =>
              e.id === originalEventId
                ? {
                    ...e,
                    recurrencePattern: {
                      ...e.recurrencePattern!,
                      endDate: endOfDay(newEndOfOriginalEvent),
                    },
                    updatedAt: new Date(),
                  }
                : e
            )
            .filter((event: CalendarEvent) => isValid(event.startTime))
            .sort((a: CalendarEvent, b: CalendarEvent) => a.startTime.getTime() - b.startTime.getTime());
            return eventsToUpdate;
        };
        setEvents(stateForNoNewSeries);

        return true;
      }

      const eventDuration = eventToDelete.endTime.getTime() - eventToDelete.startTime.getTime();
      if (eventDuration <= 0) {
        setError("Cannot process delete: master event duration invalid.");
        return false;
      }

      const newSeriesStartTime = nextOccurrenceStartTime; 
      const newSeriesEndTime = new Date(newSeriesStartTime.getTime() + eventDuration);

      if (!isValid(newSeriesEndTime)) { 
        setError("Cannot process delete: date calculation error for new series end time.");
        return false;
      }

      const newRecurringEventData = {
        title: eventToDelete.title,
        description: eventToDelete.description,
        calendarId: eventToDelete.calendarId,
        startTime: newSeriesStartTime.toISOString(),
        endTime: newSeriesEndTime.toISOString(),
        recurrenceFrequency: eventToDelete.recurrencePattern.frequency,
        recurrenceInterval: eventToDelete.recurrencePattern.interval,
        recurrenceEndDate: originalRecurrenceEndDate ? originalRecurrenceEndDate.toISOString() : undefined,
        daysOfWeek: eventToDelete.recurrencePattern.daysOfWeek,
      };

      const newSalt = generateSalt();
      const newIv = generateIV();
      const newDerivedKey = deriveKeyFromPassword(encryptionKey, newSalt);
      const encryptedNewEventData = encryptData(newRecurringEventData, newDerivedKey, newIv);
      
      const rawNewEventRecord = await addCalendarEvent(encryptedNewEventData, newIv, newSalt);

      let newEventRecord: any; 
      if (Array.isArray(rawNewEventRecord) && rawNewEventRecord.length > 0) {
        newEventRecord = rawNewEventRecord[0];
      } else if (rawNewEventRecord && typeof rawNewEventRecord === 'object' && !Array.isArray(rawNewEventRecord)) {
        newEventRecord = rawNewEventRecord;
      } else {
        setError("Failed to process event creation: invalid response from server.");
        return false;
      }

      if (!newEventRecord || typeof newEventRecord.id === 'undefined' || typeof newEventRecord.created_at === 'undefined') {
        setError("Failed to process event creation: essential data missing from server response.");
        return false;
      }

      setEvents(prevEvents => {
        const { 
          isRecurrenceInstance: _isRecurrenceInstanceFromInstance,
          originalStartTime: _originalStartTimeFromInstance, 
          clickedOccurrenceDate: _clickedOccurrenceDateFromInstance,
          calendar: _calendarFromInstance, 
          ...masterEventDataFromEventToDelete 
        } = eventToDelete as any; 

        const currentRecurrencePattern = masterEventDataFromEventToDelete.recurrencePattern as RecurrencePattern;

        const modifiedOriginalEventForState: CalendarEvent = {
          id: originalEventId, 
          title: masterEventDataFromEventToDelete.title,
          description: masterEventDataFromEventToDelete.description,
          calendarId: masterEventDataFromEventToDelete.calendarId,
          startTime: masterEventDataFromEventToDelete.startTime, 
          endTime: masterEventDataFromEventToDelete.endTime,     
          createdAt: masterEventDataFromEventToDelete.createdAt,
          calendar: undefined, 
          recurrencePattern: {
            frequency: currentRecurrencePattern.frequency,
            interval: currentRecurrencePattern.interval,
            daysOfWeek: currentRecurrencePattern.daysOfWeek,
            endDate: endOfDay(newEndOfOriginalEvent),
          },
          updatedAt: new Date(),
        };

        if (modifiedOriginalEventForState.recurrencePattern!.endDate && !isValid(modifiedOriginalEventForState.recurrencePattern!.endDate)) {
          return prevEvents; 
        }

        const updatedEventsList = prevEvents.map(e =>
          e.id === originalEventId ? modifiedOriginalEventForState : e
        );

        const newLocalEventCreatedAt = new Date(newEventRecord.created_at);
        const newLocalEventUpdatedAt = newEventRecord.updated_at ? new Date(newEventRecord.updated_at) : undefined;
        const newLocalEventRecurrenceEndDate = originalRecurrenceEndDate; 

        if (!isValid(newSeriesStartTime) || !isValid(newSeriesEndTime)) {
            return prevEvents; 
        }
        if (!isValid(newLocalEventCreatedAt)) {
            return prevEvents; 
        }
        if (newLocalEventUpdatedAt && !isValid(newLocalEventUpdatedAt)) {
            return prevEvents; 
        }
        if (newLocalEventRecurrenceEndDate && !isValid(newLocalEventRecurrenceEndDate)) {
            return prevEvents; 
        }

        const newLocalEvent: CalendarEvent = {
          id: newEventRecord.id, 
          title: newRecurringEventData.title,
          description: newRecurringEventData.description,
          calendarId: newRecurringEventData.calendarId,
          calendar: undefined, 
          startTime: newSeriesStartTime, 
          endTime: newSeriesEndTime,   
          recurrencePattern: {
            frequency: newRecurringEventData.recurrenceFrequency!,
            interval: newRecurringEventData.recurrenceInterval,
            endDate: newLocalEventRecurrenceEndDate ? endOfDay(newLocalEventRecurrenceEndDate) : undefined, 
            daysOfWeek: newRecurringEventData.daysOfWeek,
          },
          createdAt: newLocalEventCreatedAt, 
          updatedAt: newLocalEventUpdatedAt,
        };
        
        const finalEvents = [...updatedEventsList, newLocalEvent]
          .filter(event => {
            const isValidStart = isValid(event.startTime);
            return isValidStart;
          })
          .sort((a, b) => {
            if (!a.startTime || !b.startTime || !isValid(a.startTime) || !isValid(b.startTime)) {
                if (!isValid(a.startTime) && isValid(b.startTime)) return 1; 
                if (isValid(a.startTime) && !isValid(b.startTime)) return -1; 
            }
            return a.startTime.getTime() - b.startTime.getTime();
          });
        return finalEvents;
      });
      return true;

    } catch (error) {
      setError('Failed to delete this event occurrence.');
      return false;
    }
  };

  // Handler to delete this and all future occurrences of a recurring event
  const handleDeleteThisAndFuture = async (eventToDelete: CalendarEvent) => {
    if (!encryptionKey || !eventToDelete.recurrencePattern) return false;

    const eventId = eventToDelete.id;
    const occurrenceDateForFutureDelete = eventToDelete.clickedOccurrenceDate ?? eventToDelete.startTime;

    if (!isValid(occurrenceDateForFutureDelete)) {
      console.error("handleDeleteThisAndFuture: occurrenceDateForFutureDelete is invalid", eventToDelete);
      setError("Cannot process delete: invalid event date.");
      return false;
    }

    const newEndDate = subDays(occurrenceDateForFutureDelete, 1);

    if (!isValid(newEndDate)) {
      console.error("handleDeleteThisAndFuture: newEndDate is invalid");
      setError("Cannot process delete: date calculation error.");
      return false;
    }

    if (isSameDay(eventToDelete.startTime, occurrenceDateForFutureDelete)) {
      // If "this and future" is from the very start of the series (or no specific occurrence was clicked),
      // it means delete the entire series.
      return handleDeleteEvent(eventId); // Use the "delete all" logic.
    }

    try {
      const salt = generateSalt();
      const iv = generateIV();
      const derivedKey = deriveKeyFromPassword(encryptionKey, salt);

      const eventData = {
        title: eventToDelete.title,
        description: eventToDelete.description,
        calendarId: eventToDelete.calendarId,
        startTime: eventToDelete.startTime.toISOString(), // Master start time
        endTime: eventToDelete.endTime.toISOString(),   // Master end time
        recurrenceFrequency: eventToDelete.recurrencePattern.frequency,
        recurrenceInterval: eventToDelete.recurrencePattern.interval,
        recurrenceEndDate: endOfDay(newEndDate).toISOString(), // Normalize to end of day
        daysOfWeek: eventToDelete.recurrencePattern.daysOfWeek,
      };
      
      const encryptedData = encryptData(eventData, derivedKey, iv);
      await updateCalendarEvent(eventId, encryptedData, iv, salt);

      setEvents(prevEvents =>
        prevEvents.map(e =>
          e.id === eventId
            ? {
                ...e,
                recurrencePattern: {
                  ...e.recurrencePattern!,
                  endDate: endOfDay(newEndDate), // Normalize to end of day
                },
                updatedAt: new Date(),
              }
            : e
        )
        .filter(event => isValid(event.startTime)) // Ensure valid startTimes before sorting
        .sort((a, b) => a.startTime.getTime() - b.startTime.getTime())
      );
      if (skipNextEventReload) skipNextEventReload();
      return true;
    } catch (error) {
      console.error('Error deleting this and future events:', error);
      setError('Failed to delete this and future events.');
      return false;
    }
  };

  // Handle event update when dragged
  const handleEventUpdate = async (updatedEvent: CalendarEvent) => {
    if (!encryptionKey) return;
    
    try {
      const salt = generateSalt();
      const iv = generateIV();
      const derivedKey = deriveKeyFromPassword(encryptionKey, salt);
      
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
          console.error('Extracted master ID:', masterEventId);
          console.error('Available events:', events.map(e => ({ id: e.id, title: e.title })));
          setError('Failed to update recurring event: Master event not found');
          return false;
        }
      } else {
        // Regular event - find it directly
        originalEvent = events.find(e => e.id === updatedEvent.id);
        eventIdToUpdate = updatedEvent.id;
        
        if (!originalEvent) {
          console.error('Original event not found for ID:', updatedEvent.id);
          console.error('Available events:', events.map(e => ({ id: e.id, title: e.title })));
          setError('Failed to update event: Event not found in current state');
          return false;
        }
      }
      
      // Preserve recurrence pattern from the original event if it exists
      const recurrencePattern = originalEvent.recurrencePattern;
      
      if (isRecurrenceInstance) {
        // For recurring event instances, calculate the time offset and apply it to the master event
        // This maintains the relative distance rather than moving the master to the exact dragged position
        
        // Extract the date from the recurrence instance ID to find the original instance time
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
        
        // Update the event data with the offset times instead of the exact dragged position
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
        
        const offsetEncryptedData = encryptData(offsetEventData, derivedKey, iv);
        
        // Skip next event reload to prevent calendar refresh during drag
        if (skipNextEventReload) {
          skipNextEventReload();
        }
        
        // Update the database with the offset times
        await updateCalendarEvent(eventIdToUpdate, offsetEncryptedData, iv, salt);
        
        // Update local state with the offset times
        setEvents(prevEvents =>
          prevEvents.map(event =>
            event.id === eventIdToUpdate ? {
              ...event,
              startTime: newMasterStartTime,
              endTime: newMasterEndTime,
              updatedAt: new Date()
            } : event
          ).sort((a, b) => a.startTime.getTime() - b.startTime.getTime())
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
        
        const encryptedData = encryptData(eventData, derivedKey, iv);
        
        // Skip next event reload to prevent calendar refresh during drag
        if (skipNextEventReload) {
          skipNextEventReload();
        }
        
        // Update the event in the database using the correct event ID
        await updateCalendarEvent(eventIdToUpdate, encryptedData, iv, salt);
        
        setEvents(prevEvents =>
          prevEvents.map(event =>
            event.id === updatedEvent.id ? {
              ...updatedEvent,
              calendarId: originalEvent.calendarId,
              calendar: originalEvent.calendar,
              recurrencePattern
            } : event
          ).sort((a, b) => a.startTime.getTime() - b.startTime.getTime())
        );
      }
      
      return true;
    } catch (error) {
      console.error('Error updating dragged event:', error);
      setError('Failed to update event position');
      return false;
    }
  };

  // Helper function to move an event to another calendar
  const moveEventToCalendar = async (eventId: string, targetCalendarId: string) => {
    if (!encryptionKey) return;
    
    try {
      const event = events.find(e => e.id === eventId);
      if (!event) {
        throw new Error('Event not found');
      }
      
      const salt = generateSalt();
      const iv = generateIV();
      const derivedKey = deriveKeyFromPassword(encryptionKey, salt);
      
      // Get the target calendar
      const targetCalendar = calendars.find(cal => cal.id === targetCalendarId);
      if (!targetCalendar) {
        throw new Error('Target calendar not found');
      }
      
      const eventData = {
        title: event.title,
        description: event.description ?? '',
        calendarId: targetCalendarId,
        startTime: event.startTime.toISOString(),
        endTime: event.endTime.toISOString(),
        recurrenceFrequency: event.recurrencePattern?.frequency,
        recurrenceEndDate: event.recurrencePattern?.endDate?.toISOString(),
        recurrenceInterval: event.recurrencePattern?.interval,
        daysOfWeek: event.recurrencePattern?.daysOfWeek
      };
      
      const encryptedData = encryptData(eventData, derivedKey, iv);
      
      // Skip next event reload to prevent calendar refresh when moving event
      if (skipNextEventReload) {
        skipNextEventReload();
      }
      
      // Update the event in the database
      await updateEventCalendar(eventId, encryptedData, iv, salt);
      
      // Update local state
      setEvents(prevEvents =>
        prevEvents.map(e =>
          e.id === eventId ? {
            ...e,
            calendarId: targetCalendarId,
            calendar: targetCalendar
          } : e
        )
      );
    } catch (error) {
      console.error('Error moving event to calendar:', error);
      throw error;
    }
  };

  return {
    events,
    setEvents,
    isLoading,
    setIsLoading,
    loadEvents,
    loadEventsWithCalendars,
    handleSubmitEvent,
    handleDeleteEvent,
    handleDeleteThisOccurrence,
    handleDeleteThisAndFuture,
    handleEventUpdate,
    moveEventToCalendar
  };
}
