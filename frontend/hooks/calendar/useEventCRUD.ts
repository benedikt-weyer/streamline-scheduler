import { CalendarEvent, Calendar, EventFormValues } from '@/utils/calendar/calendar-types';
import { EventStateActions } from './types/eventHooks';
import { useError } from '@/utils/context/ErrorContext';
import { 
  addCalendarEvent, 
  updateCalendarEvent, 
  deleteCalendarEvent
} from '../../app/dashboard/calendar/actions';
import { encryptEventData } from '../../utils/calendar/eventEncryption';
import { processEventData } from '../../utils/calendar/eventDataProcessing';
import { isValid } from 'date-fns';

/**
 * Hook for basic CRUD operations on events
 */
export const useEventCRUD = (
  events: CalendarEvent[],
  calendars: Calendar[],
  eventActions: EventStateActions,
  encryptionKey: string | null,
  skipNextEventReload?: () => void
) => {
  const { setError } = useError();

  const handleSubmitEvent = async (values: EventFormValues): Promise<boolean> => {
    if (!encryptionKey) return false;
    
    try {
      const { eventData, startDateTime, endDateTime, recurrencePattern, calendar } = processEventData(values, calendars);
      const { encryptedData, salt, iv } = encryptEventData(eventData, encryptionKey);
      
      if (values.id && values.id !== 'new') {
        // Update existing event
        if (skipNextEventReload) {
          skipNextEventReload();
        }
        await updateCalendarEvent(values.id, encryptedData, iv, salt);
        
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
        const newEventRecord = await addCalendarEvent(encryptedData, iv, salt);
        const newEvent: CalendarEvent = {
          id: newEventRecord.id,
          title: values.title.trim(),
          description: values.description?.trim() ?? '',
          location: values.location?.trim() ?? '',
          calendarId: values.calendarId,
          calendar: calendar,
          isAllDay: values.isAllDay ?? false,
          startTime: startDateTime,
          endTime: endDateTime,
          recurrencePattern,
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

  const moveEventToCalendar = async (eventId: string, targetCalendarId: string): Promise<void> => {
    if (!encryptionKey) return;
    
    try {
      const event = events.find(e => e.id === eventId);
      if (!event) {
        throw new Error('Event not found');
      }
      
      const targetCalendar = calendars.find(cal => cal.id === targetCalendarId);
      if (!targetCalendar) {
        throw new Error('Target calendar not found');
      }
      
      const eventData = {
        title: event.title,
        description: event.description ?? '',
        location: event.location ?? '',
        calendarId: targetCalendarId,
        startTime: event.startTime.toISOString(),
        endTime: event.endTime.toISOString(),
        recurrenceFrequency: event.recurrencePattern?.frequency,
        recurrenceEndDate: event.recurrencePattern?.endDate?.toISOString(),
        recurrenceInterval: event.recurrencePattern?.interval,
        daysOfWeek: event.recurrencePattern?.daysOfWeek
      };
      
      const { encryptedData, salt, iv } = encryptEventData(eventData, encryptionKey);
      
      if (skipNextEventReload) {
        skipNextEventReload();
      }
      
      await updateCalendarEvent(eventId, encryptedData, iv, salt);
      
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
    moveEventToCalendar
  };
};
