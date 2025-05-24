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

// Add a counter for hook executions
// let hookExecutionCounter = 0; // Remove counter

export function useCalendarEvents(encryptionKey: string | null, calendars: Calendar[], skipNextEventReload?: () => void) {
  // hookExecutionCounter++; // Remove counter increment
  // console.log(`[useCalendarEvents] Hook execution count: ${hookExecutionCounter}, calendars count: ${calendars?.length}`); // Remove log

  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const { setError } = useError();

  // Consolidated useEffect to synchronize event.calendar details from the main calendars list
  useEffect(() => {
    // console.log('[useCalendarEvents] Sync effect running. Events count:', events.length, 'Calendars count:', calendars.length); // Remove log
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
            // Ensure all fields from the Calendar type used in event.calendar are here
            createdAt: foundCalendar.createdAt, // Assuming these might be part of Calendar type
            updatedAt: foundCalendar.updatedAt  // if not, they can be omitted if not compared
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
              normalizedEventCalendar.isDefault !== normalizedCorrespondingCalendar.isDefault // Both are now consistently boolean or from a defined source
             ) {
            if (!hasChanges) { // Log only for the first detected change to avoid spam
              changeDetectedForEventId = event.id;
              oldCalendarDetails = event.calendar ? { ...event.calendar } : null;
              // Log the version that will be used for the new state
              newCalendarDetails = { ...normalizedCorrespondingCalendar }; 
            }
            hasChanges = true;
            // Use the normalized version for the new state
            return { ...event, calendar: normalizedCorrespondingCalendar }; 
          }
        } else if (event.calendar) { // Event has a calendar object, but no correspondingCalendar (foundCalendar) found
          if (!hasChanges) { // Log only for the first detected change
            changeDetectedForEventId = event.id;
            oldCalendarDetails = { ...event.calendar };
            newCalendarDetails = 'undefined (calendar missing from source)';
          }
          hasChanges = true;
          return { ...event, calendar: undefined }; // Remove stale calendar object
        }
        return event;
      });

      if (hasChanges) {
        // console.log(`[useCalendarEvents] Sync effect: hasChanges is TRUE for event ID: ${changeDetectedForEventId}. Old calendar:`, oldCalendarDetails, 'New calendar:', newCalendarDetails, 'Calling setEvents.'); // Remove log
        setEvents(newEvents
          .filter(event => isValid(event.startTime)) 
          .sort((a, b) => a.startTime.getTime() - b.startTime.getTime()));
      } else {
        // console.log('[useCalendarEvents] Sync effect: No changes detected in event.calendar details.'); // Remove log
      }
    }
  }, [events, calendars, setEvents]);

  // Load and decrypt events
  const loadEvents = async (key: string) => {
    try {
      setIsLoading(true);
      
      // Fetch encrypted events from the database
      const encryptedEvents = await fetchCalendarEvents();
      
      // console.log(`Loaded ${encryptedEvents.length} encrypted events`); // Consider keeping or making less verbose
      
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
      // If no encrypted events were provided, fetch them
      if (encryptedEvents.length === 0) {
        encryptedEvents = await fetchCalendarEvents();
      }
      
      // Decrypt each event
      const decryptedEvents = encryptedEvents
        .map(event => {
          try {
            // Get the salt and IV for this event
            const salt = event.salt;
            const iv = event.iv;
            
            // Derive the key for this event using the provided encryption key and salt
            const derivedKey = deriveKeyFromPassword(key, salt);
            
            // Make sure event.encrypted_data is defined before decrypting
            if (!event.encrypted_data) {
              console.error('Event data is undefined for event:', event.id);
              return null;
            }
            
            // Decrypt the event data
            const decryptedData = decryptData(event.encrypted_data, derivedKey, iv);
            
            if (!decryptedData) {
              console.error('Failed to decrypt event data for event:', event.id);
              return null;
            }
            
            // Get the start and end times as Date objects
            const startTime = new Date(decryptedData.startTime);
            const endTime = new Date(decryptedData.endTime);
            
            if (!isValid(startTime) || !isValid(endTime)) {
              console.error('Invalid date found for event after decryption:', event.id, 
                { startTime: decryptedData.startTime, endTime: decryptedData.endTime });
              return null; // Skip this event
            }
            
            // Create recurrence pattern if specified
            let recurrencePattern: RecurrencePattern | undefined;
            if (decryptedData.recurrenceFrequency && decryptedData.recurrenceFrequency !== RecurrenceFrequency.None) {
              recurrencePattern = {
                frequency: decryptedData.recurrenceFrequency,
                interval: decryptedData.recurrenceInterval ?? 1,
                endDate: decryptedData.recurrenceEndDate ? new Date(decryptedData.recurrenceEndDate) : undefined,
                daysOfWeek: decryptedData.daysOfWeek
              };
            }
            
            // Find the calendar for this event
            const calendar = calendars.find(cal => cal.id === decryptedData.calendarId);
            
            // Return a calendar event object with decrypted data and metadata
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
        .filter(event => isValid(event.startTime)) // Ensure valid startTimes before sorting
        .sort((a, b) => a.startTime.getTime() - b.startTime.getTime());
      
      // console.log(`Setting ${decryptedEvents.length} events in state with calendar references`); // Consider keeping or making less verbose
      
      // Count events with calendar
      // const eventsWithCalendar = decryptedEvents.filter(e => e.calendar?.color); // Remove if only for logging
      // console.log(`${eventsWithCalendar.length} events have calendar with color`); // Remove log
      
      // Set the events directly without using JSON.parse/stringify
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
      
      // Convert the separate date and time fields into datetime objects
      const startDateTime = combineDateAndTime(values.startDate, values.startTime);
      const endDateTime = combineDateAndTime(values.endDate, values.endTime);
      
      // Create recurrence pattern if specified
      let recurrencePattern: RecurrencePattern | undefined;
      if (values.recurrenceFrequency && values.recurrenceFrequency !== RecurrenceFrequency.None) {
        recurrencePattern = {
          frequency: values.recurrenceFrequency,
          interval: values.recurrenceInterval ?? 1,
          endDate: values.recurrenceEndDate ? endOfDay(new Date(values.recurrenceEndDate)) : undefined,
          daysOfWeek: values.daysOfWeek
        };
      }
      
      // Find the calendar for this event
      const calendar = calendars.find(cal => cal.id === values.calendarId);
      
      // The data to be encrypted and stored
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
        // Skip next event reload to prevent calendar refresh when saving edit
        if (skipNextEventReload) {
          skipNextEventReload();
        }
        
        // Update existing event
        await updateCalendarEvent(values.id, encryptedData, iv, salt);
        
        // Update local state
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
        // Skip next event reload to prevent calendar refresh when creating new event
        if (skipNextEventReload) {
          skipNextEventReload();
        }
        
        // Create new event
        const newEventRecord = await addCalendarEvent(encryptedData, iv, salt);
        
        // Create event object for local state
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
      // Skip next event reload to prevent calendar refresh when deleting
      if (skipNextEventReload) {
        skipNextEventReload();
      }
      
      await deleteCalendarEvent(id);
      setEvents(prevEvents => prevEvents
        .filter(event => event.id !== id)
        .filter(event => isValid(event.startTime)) // Ensure valid startTimes before sorting
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
    // console.log('[HDTO] Called with event:', eventToDelete.id, 'Occurrence:', eventToDelete.clickedOccurrenceDate?.toISOString()); // Remove log
    
    if (skipNextEventReload) {
        // console.log('[HDTO] Attempting to call skipNextEventReload at the beginning of handleDeleteThisOccurrence.'); // Remove log
        skipNextEventReload(); 
    }

    if (!encryptionKey || !eventToDelete.recurrencePattern) {
      // console.warn('[HDTO] Missing encryptionKey or recurrencePattern. Bailing out.'); // Keep warn
      return false;
    }
    // console.log('[HDTO] Encryption key and recurrence pattern present.'); // Remove log

    const originalEventId = eventToDelete.id;
    const occurrenceStartTime = eventToDelete.clickedOccurrenceDate ?? eventToDelete.startTime;
    // console.log('[HDTO] originalEventId:', originalEventId, 'occurrenceStartTime:', occurrenceStartTime?.toISOString()); // Remove log

    if (!isValid(occurrenceStartTime)) {
      // console.error("[HDTO] occurrenceStartTime is invalid", eventToDelete); // Keep error
      setError("Cannot process delete: invalid event date.");
      return false;
    }
    // console.log('[HDTO] occurrenceStartTime is valid.'); // Remove log

    if (!isValid(eventToDelete.startTime) || !isValid(eventToDelete.endTime) || eventToDelete.endTime <= eventToDelete.startTime) {
        // console.error("[HDTO] master event has invalid start/end times or duration", eventToDelete); // Keep error
        setError("Cannot process delete: master event data is corrupted.");
        return false;
    }
    // console.log('[HDTO] Master event start/end times are valid.'); // Remove log

    try {
      // console.log('[HDTO] Entered try block. Generating salt/iv/key for original event update.'); // Remove log
      const salt = generateSalt();
      const iv = generateIV();
      const derivedKey = deriveKeyFromPassword(encryptionKey, salt);
      // console.log('[HDTO] Salt/iv/key generated for original event update.'); // Remove log

      const originalRecurrenceEndDate = eventToDelete.recurrencePattern.endDate;
      // console.log('[HDTO] originalRecurrenceEndDate:', originalRecurrenceEndDate?.toISOString()); // Remove log
      const newEndOfOriginalEvent = subDays(occurrenceStartTime, 1);
      // console.log('[HDTO] Calculated newEndOfOriginalEvent:', newEndOfOriginalEvent?.toISOString()); // Remove log

      if (!isValid(newEndOfOriginalEvent)) {
        // console.error("[HDTO] newEndOfOriginalEvent is invalid"); // Keep error
        setError("Cannot process delete: date calculation error.");
        return false;
      }
      // console.log('[HDTO] newEndOfOriginalEvent is valid.'); // Remove log

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
      // console.log('[HDTO] Prepared updatedOriginalEventData. Encrypting...'); // Remove log
      const encryptedOriginalEventData = encryptData(updatedOriginalEventData, derivedKey, iv);
      // console.log('[HDTO] Original event data encrypted. Calling updateCalendarEvent...'); // Remove log
      await updateCalendarEvent(originalEventId, encryptedOriginalEventData, iv, salt);
      // console.log('[HDTO] updateCalendarEvent completed for original event.'); // Remove log

      // console.log('[HDTO] Calculating nextOccurrenceStartTime...'); // Remove log
      let nextOccurrenceStartTime = new Date(occurrenceStartTime);
      const interval = eventToDelete.recurrencePattern.interval || 1;
      switch (eventToDelete.recurrencePattern.frequency) {
        case RecurrenceFrequency.Daily:
          // console.log('[HDTO] Freq: Daily, Interval:', interval); // Remove log
          nextOccurrenceStartTime = addDays(nextOccurrenceStartTime, interval);
          break;
        case RecurrenceFrequency.Weekly:
          // console.log('[HDTO] Freq: Weekly, Interval:', interval); // Remove log
          nextOccurrenceStartTime = addWeeks(nextOccurrenceStartTime, interval);
          break;
        case RecurrenceFrequency.BiWeekly:
            // console.log('[HDTO] Freq: BiWeekly, Interval:', interval); // Remove log
            nextOccurrenceStartTime = addWeeks(nextOccurrenceStartTime, 2 * interval);
            break;
        case RecurrenceFrequency.Monthly:
          // console.log('[HDTO] Freq: Monthly, Interval:', interval); // Remove log
          nextOccurrenceStartTime = addMonths(nextOccurrenceStartTime, interval);
          break;
        case RecurrenceFrequency.Yearly:
          // console.log('[HDTO] Freq: Yearly, Interval:', interval); // Remove log
          nextOccurrenceStartTime = addYears(nextOccurrenceStartTime, interval);
          break;
        default:
          // console.error("[HDTO] Unknown recurrence frequency", eventToDelete.recurrencePattern.frequency); // Keep error
          setError("Cannot process delete: unknown recurrence type.");
          return false; 
      }
      // console.log('[HDTO] Calculated nextOccurrenceStartTime:', nextOccurrenceStartTime?.toISOString()); // Remove log
      
      if (!isValid(nextOccurrenceStartTime)) {
        // console.error("[HDTO] nextOccurrenceStartTime is invalid after interval addition.", { occurrenceStartTime, interval, frequency: eventToDelete.recurrencePattern.frequency }); // Keep error
        setError("Cannot process delete: date calculation error for next occurrence.");
        return false;
      }
      // console.log('[HDTO] nextOccurrenceStartTime is valid.'); // Remove log
                  
      if (originalRecurrenceEndDate && isValid(originalRecurrenceEndDate) && nextOccurrenceStartTime > originalRecurrenceEndDate) {
        // console.log("[HDTO] Next occurrence is beyond original series end. Only updating original event. Preparing to setEvents..."); // Remove log
        
        // Log the state being set in this branch
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
            // console.log('[HDTO PRE-SETSTATE-NO-NEW-SERIES] Updating state with:', JSON.stringify(eventsToUpdate.find((e: CalendarEvent) => e.id === originalEventId), null, 2)); // Remove log
            return eventsToUpdate;
        };
        setEvents(stateForNoNewSeries);

        // console.log("[HDTO] Processed case where no new series is needed. Returning true."); // Remove log
        return true;
      }
      // console.log('[HDTO] New series needs to be created.'); // Remove log

      const eventDuration = eventToDelete.endTime.getTime() - eventToDelete.startTime.getTime();
      if (eventDuration <= 0) {
        // console.error("[HDTO] master event has non-positive duration.", eventToDelete); // Keep error
        setError("Cannot process delete: master event duration invalid.");
        return false;
      }
      // console.log('[HDTO] Event duration calculated and valid:', eventDuration); // Remove log

      const newSeriesStartTime = nextOccurrenceStartTime; 
      const newSeriesEndTime = new Date(newSeriesStartTime.getTime() + eventDuration);
      // console.log('[HDTO] Calculated newSeriesStartTime:', newSeriesStartTime?.toISOString(), 'newSeriesEndTime:', newSeriesEndTime?.toISOString()); // Remove log

      if (!isValid(newSeriesEndTime)) { 
        // console.error("[HDTO] newSeriesEndTime is invalid for the new series.", { newSeriesStartTime, eventDuration }); // Keep error
        setError("Cannot process delete: date calculation error for new series end time.");
        return false;
      }
      // console.log('[HDTO] newSeriesEndTime is valid.'); // Remove log

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
      // console.log('[HDTO] Prepared newRecurringEventData. Generating new salt/iv/key.'); // Remove log

      const newSalt = generateSalt();
      const newIv = generateIV();
      const newDerivedKey = deriveKeyFromPassword(encryptionKey, newSalt);
      // console.log('[HDTO] New salt/iv/key generated. Encrypting new event data...'); // Remove log
      const encryptedNewEventData = encryptData(newRecurringEventData, newDerivedKey, newIv);
      // console.log('[HDTO] New event data encrypted. Calling addCalendarEvent...'); // Remove log
      
      const rawNewEventRecord = await addCalendarEvent(encryptedNewEventData, newIv, newSalt);
      // console.log('[HDTO] addCalendarEvent completed. Response:', rawNewEventRecord); // Remove log

      let newEventRecord: any; 
      if (Array.isArray(rawNewEventRecord) && rawNewEventRecord.length > 0) {
        newEventRecord = rawNewEventRecord[0];
      } else if (rawNewEventRecord && typeof rawNewEventRecord === 'object' && !Array.isArray(rawNewEventRecord)) {
        newEventRecord = rawNewEventRecord;
      } else {
        // console.error("[HDTO] addCalendarEvent returned unexpected data format.", rawNewEventRecord); // Keep error
        setError("Failed to process event creation: invalid response from server.");
        return false;
      }
      // console.log('[HDTO] Processed rawNewEventRecord:', newEventRecord); // Remove log

      if (!newEventRecord || typeof newEventRecord.id === 'undefined' || typeof newEventRecord.created_at === 'undefined') {
        // console.error("[HDTO] Processed newEventRecord is invalid or missing essential fields (id, created_at).", { originalResponse: rawNewEventRecord, processedRecord: newEventRecord }); // Keep error
        setError("Failed to process event creation: essential data missing from server response.");
        return false;
      }
      // console.log('[HDTO] newEventRecord is valid and contains id and created_at.'); // Remove log

      // Update local state
      // console.log('[HDTO] Preparing final setEvents call...'); // Remove log
      setEvents(prevEvents => {
        // console.log('[HDTO setEvents_callback] Start updating local state. Original event ID:', originalEventId, 'Prev events count:', prevEvents.length); // Remove log
        // console.log('[HDTO setEvents_callback] eventToDelete:', JSON.stringify(eventToDelete));
        // console.log('[HDTO setEvents_callback] newEndOfOriginalEvent:', newEndOfOriginalEvent?.toISOString());
        // console.log('[HDTO setEvents_callback] newEventRecord:', JSON.stringify(newEventRecord));
        // console.log('[HDTO setEvents_callback] newSeriesStartTime:', newSeriesStartTime?.toISOString());
        // console.log('[HDTO setEvents_callback] newSeriesEndTime:', newSeriesEndTime?.toISOString());
        // console.log('[HDTO setEvents_callback] originalRecurrenceEndDate:', originalRecurrenceEndDate?.toISOString());

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
          // console.error("[HDTO setEvents_callback CRITICAL] newEndOfOriginalEvent for modified event became invalid. Aborting and returning prevEvents.", { endDate: modifiedOriginalEventForState.recurrencePattern!.endDate }); // Keep error
          return prevEvents; 
        }

        const updatedEventsList = prevEvents.map(e =>
          e.id === originalEventId ? modifiedOriginalEventForState : e
        );

        const newLocalEventCreatedAt = new Date(newEventRecord.created_at);
        const newLocalEventUpdatedAt = newEventRecord.updated_at ? new Date(newEventRecord.updated_at) : undefined;
        const newLocalEventRecurrenceEndDate = originalRecurrenceEndDate; 

        if (!isValid(newSeriesStartTime) || !isValid(newSeriesEndTime)) {
            // console.error("[HDTO setEvents_callback CRITICAL] newSeriesStartTime or newSeriesEndTime for newLocalEvent is invalid. Aborting.", {newSeriesStartTime: newSeriesStartTime?.toISOString(), newSeriesEndTime: newSeriesEndTime?.toISOString()}); // Keep error
            return prevEvents; 
        }
        if (!isValid(newLocalEventCreatedAt)) {
            // console.error("[HDTO setEvents_callback CRITICAL] newLocalEvent.createdAt is invalid. Aborting.", { createdAt_from_db: newEventRecord.created_at }); // Keep error
            return prevEvents; 
        }
        if (newLocalEventUpdatedAt && !isValid(newLocalEventUpdatedAt)) {
            // console.error("[HDTO setEvents_callback CRITICAL] newLocalEvent.updatedAt is invalid. Aborting.", { updatedAt_from_db: newEventRecord.updated_at }); // Keep error
            return prevEvents; 
        }
        if (newLocalEventRecurrenceEndDate && !isValid(newLocalEventRecurrenceEndDate)) {
            // console.error("[HDTO setEvents_callback CRITICAL] newLocalEvent.recurrencePattern.endDate is invalid. Aborting.", { originalRecurrenceEndDate: originalRecurrenceEndDate?.toISOString() }); // Keep error
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
        
        // Critical log before setting state - this is the one the user said wasn't appearing
        // console.log("[HDTO PRE-SETSTATE] modifiedOriginalEventForState:", JSON.stringify(modifiedOriginalEventForState, null, 2)); // Remove log
        // console.log("[HDTO PRE-SETSTATE] newLocalEvent:", JSON.stringify(newLocalEvent, null, 2)); // Remove log

        const finalEvents = [...updatedEventsList, newLocalEvent]
          .filter(event => {
            const isValidStart = isValid(event.startTime);
            if (!isValidStart) {
              // console.warn('[HDTO setEvents_callback] Filtering out event with invalid startTime:', event.id, event.title, event.startTime); // Keep warn
            }
            return isValidStart;
          })
          .sort((a, b) => {
            if (!a.startTime || !b.startTime || !isValid(a.startTime) || !isValid(b.startTime)) {
                // console.warn('[HDTO setEvents_callback] Sorting with invalid startTime(s). Event A start:', a.startTime, 'Event B start:', b.startTime); // Keep warn
                if (!isValid(a.startTime) && isValid(b.startTime)) return 1; 
                if (isValid(a.startTime) && !isValid(b.startTime)) return -1; 
            }
            return a.startTime.getTime() - b.startTime.getTime();
          });
        
        // console.log('[HDTO setEvents_callback] Successfully returning new state. New events count:', finalEvents.length); // Remove log
        return finalEvents;
      });
      
      // console.log("[HDTO] Process completed successfully (after main setEvents). Returning true."); // Remove log
      return true;

    } catch (error) {
      // console.error('[HDTO] Error in handleDeleteThisOccurrence:', error); // Keep error
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
