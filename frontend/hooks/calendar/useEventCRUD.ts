import { CalendarEvent, Calendar, EventFormValues } from '@/utils/calendar/calendar-types';
import { EventStateActions } from './types/eventHooks';
import { useError } from '@/utils/context/ErrorContext';
import { getDecryptedBackend } from '@/utils/api/decrypted-backend';
import { processEventData } from '../../utils/calendar/eventDataProcessing';
import { isValid } from 'date-fns';

/**
 * Hook for basic CRUD operations on events
 */
export const useEventCRUD = (
  events: CalendarEvent[],
  calendars: Calendar[],
  eventActions: EventStateActions,
  skipNextEventReload?: () => void
) => {
  const { setError } = useError();

  const handleSubmitEvent = async (values: EventFormValues): Promise<boolean> => {
    try {
      const { eventData, startDateTime, endDateTime, recurrencePattern, calendar } = processEventData(values, calendars);
      const backend = getDecryptedBackend();
      
      if (values.id && values.id !== 'new') {
        // Update existing event
        if (skipNextEventReload) {
          skipNextEventReload();
        }
        await backend.calendarEvents.update({
          id: values.id,
          title: eventData.title,
          description: eventData.description,
          location: eventData.location,
          calendar_id: eventData.calendarId,
          start_time: eventData.startTime,
          end_time: eventData.endTime,
          all_day: eventData.isAllDay,
          recurrence_rule: recurrencePattern ? JSON.stringify(recurrencePattern) : undefined,
          recurrence_exception: undefined
        });
        
                  eventActions.setEvents(prevEvents => 
            prevEvents.map(event => 
              event.id === values.id 
                ? {
                    ...event,
                    title: values.title.trim(),
                    description: values.description?.trim() ?? '',
                    location: values.location?.trim() ?? '',
                    calendarId: values.calendarId,
                    calendar: calendar,
                    isAllDay: values.isAllDay ?? false,
                    startTime: startDateTime,
                    endTime: endDateTime,
                    recurrencePattern,
                    updatedAt: new Date()
                  } 
                : event
            )
          );
      } else {
        // Create new event
        if (skipNextEventReload) {
          skipNextEventReload();
        }
        const { data: newEventRecord } = await backend.calendarEvents.create({
          title: eventData.title,
          description: eventData.description,
          location: eventData.location,
          calendar_id: eventData.calendarId,
          start_time: eventData.startTime,
          end_time: eventData.endTime,
          all_day: eventData.isAllDay,
          recurrence_rule: recurrencePattern ? JSON.stringify(recurrencePattern) : undefined
        });
        
        if (!newEventRecord) {
          throw new Error('Failed to create event - no data returned');
        }
        
        const newEvent: CalendarEvent = {
          id: newEventRecord.id,
          title: newEventRecord.title,
          description: newEventRecord.description ?? '',
          location: newEventRecord.location ?? '',
          calendarId: newEventRecord.calendar_id,
          calendar: calendar,
          isAllDay: newEventRecord.all_day ?? false,
          startTime: startDateTime,
          endTime: endDateTime,
          recurrencePattern,
          user_id: newEventRecord.user_id,
          createdAt: new Date(newEventRecord.created_at),
          updatedAt: newEventRecord.updated_at ? new Date(newEventRecord.updated_at) : undefined
        };
        
        eventActions.setEvents(prevEvents => [...prevEvents, newEvent]);
      }
      return true;
    } catch (error) {
      console.error('Error saving event:', error);
      setError('Failed to save event');
      return false;
    }
  };

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

  const handleCloneEvent = async (eventToClone: CalendarEvent): Promise<boolean> => {
    try {
      // Find the calendar for the event
      const calendar = calendars.find(cal => cal.id === eventToClone.calendarId);
      if (!calendar) {
        setError('Calendar not found for cloned event');
        return false;
      }

      const backend = getDecryptedBackend();
      
      if (skipNextEventReload) {
        skipNextEventReload();
      }
      
      const { data: newEventRecord } = await backend.calendarEvents.create({
        title: `${eventToClone.title} (Copy)`,
        description: eventToClone.description || '',
        location: eventToClone.location || '',
        calendar_id: eventToClone.calendarId,
        all_day: eventToClone.isAllDay || false,
        start_time: eventToClone.startTime.toISOString(),
        end_time: eventToClone.endTime.toISOString(),
        // Don't clone recurrence patterns to avoid confusion
        recurrence_rule: undefined
      });
      
      if (!newEventRecord) {
        throw new Error('Failed to clone event - no data returned');
      }
      
      // Create the new event object
      const newEvent: CalendarEvent = {
        id: newEventRecord.id,
        title: newEventRecord.title,
        description: newEventRecord.description || '',
        location: newEventRecord.location || '',
        calendarId: newEventRecord.calendar_id,
        calendar: calendar,
        isAllDay: newEventRecord.all_day || false,
        startTime: eventToClone.startTime,
        endTime: eventToClone.endTime,
        user_id: newEventRecord.user_id,
        createdAt: new Date(newEventRecord.created_at),
        updatedAt: newEventRecord.updated_at ? new Date(newEventRecord.updated_at) : undefined
      };
      
      // Add the new event to the events list
      eventActions.setEvents(prevEvents => [...prevEvents, newEvent]);
      return true;
    } catch (error) {
      console.error('Error cloning event:', error);
      setError('Failed to clone event');
      return false;
    }
  };

  const moveEventToCalendar = async (eventId: string, targetCalendarId: string): Promise<void> => {
    try {
      const event = events.find(e => e.id === eventId);
      if (!event) {
        throw new Error('Event not found');
      }
      
      const targetCalendar = calendars.find(cal => cal.id === targetCalendarId);
      if (!targetCalendar) {
        throw new Error('Target calendar not found');
      }
      
      const backend = getDecryptedBackend();
      
      if (skipNextEventReload) {
        skipNextEventReload();
      }
      
      await backend.calendarEvents.update({
        id: eventId,
        title: event.title,
        description: event.description ?? '',
        location: event.location ?? '',
        calendar_id: targetCalendarId,
        start_time: event.startTime.toISOString(),
        end_time: event.endTime.toISOString(),
        all_day: event.isAllDay,
        recurrence_rule: event.recurrencePattern ? JSON.stringify(event.recurrencePattern) : undefined,
        recurrence_exception: undefined
      });
      
      eventActions.setEvents(prevEvents =>
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
    handleSubmitEvent,
    handleDeleteEvent,
    handleCloneEvent,
    moveEventToCalendar
  };
};
