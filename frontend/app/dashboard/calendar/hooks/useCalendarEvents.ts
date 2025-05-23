import { useState } from 'react';
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

  // Load and decrypt events
  const loadEvents = async (key: string) => {
    try {
      setIsLoading(true);
      
      // Fetch encrypted events from the database
      const encryptedEvents = await fetchCalendarEvents();
      
      console.log(`Loaded ${encryptedEvents.length} encrypted events`);
      
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
        .sort((a, b) => a.startTime.getTime() - b.startTime.getTime());
      
      console.log(`Setting ${decryptedEvents.length} events in state with calendar references`);
      
      // Count events with calendar
      const eventsWithCalendar = decryptedEvents.filter(e => e.calendar?.color);
      console.log(`${eventsWithCalendar.length} events have calendar with color`);
      
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
          endDate: values.recurrenceEndDate ? new Date(values.recurrenceEndDate) : undefined,
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
        recurrenceEndDate: values.recurrenceEndDate ? new Date(values.recurrenceEndDate).toISOString() : undefined,
        recurrenceInterval: values.recurrenceInterval,
        daysOfWeek: values.daysOfWeek
      };
      
      const encryptedData = encryptData(eventData, derivedKey, iv);
      
      if (values.id && values.id !== 'new') {
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
      await deleteCalendarEvent(id);
      setEvents(prevEvents => prevEvents.filter(event => event.id !== id));
      return true;
    } catch (error) {
      console.error('Error deleting event:', error);
      setError('Failed to delete event');
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
      
      // Get the original event to preserve recurrence pattern and calendar
      const originalEvent = events.find(e => e.id === updatedEvent.id);
      
      if (!originalEvent) {
        throw new Error('Original event not found');
      }
      
      // Preserve recurrence pattern from the original event if it exists
      const recurrencePattern = originalEvent.recurrencePattern;
      
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
      
      // Update the event in the database
      await updateCalendarEvent(updatedEvent.id, encryptedData, iv, salt);
      
      // Local state update with preserved recurrence pattern and calendar
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
    handleEventUpdate,
    moveEventToCalendar
  };
}
