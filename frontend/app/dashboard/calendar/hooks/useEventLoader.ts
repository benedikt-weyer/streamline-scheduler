import { CalendarEvent, Calendar } from '@/utils/calendar/calendar-types';
import { EventStateActions } from '../types/eventHooks';
import { useError } from '@/utils/context/ErrorContext';
import { fetchCalendarEvents } from '../actions';
import { decryptEventData } from '../../../../utils/calendar/eventEncryption';
import { validateDecryptedEvent } from '../../../../utils/calendar/eventValidation';
import { processDecryptedEvent, sortEventsByStartTime } from '../../../../utils/calendar/eventDataProcessing';

/**
 * Hook for loading and decrypting events
 */
export const useEventLoader = (
  calendars: Calendar[],
  eventActions: EventStateActions
) => {
  const { setError } = useError();

  const loadEvents = async (key: string): Promise<CalendarEvent[]> => {
    try {
      eventActions.setIsLoading(true);
      const encryptedEvents = await fetchCalendarEvents();
      if (encryptedEvents.length === 0) {
        eventActions.setEvents([]);
        eventActions.setIsLoading(false);
        return [];
      }
      return await loadEventsWithCalendars(key, encryptedEvents);
    } catch (error) {
      console.error('Error loading events:', error);
      setError('Failed to load your Calendar events');
      eventActions.setIsLoading(false);
      return [];
    }
  };

  const loadEventsWithCalendars = async (key: string, encryptedEvents: any[] = []): Promise<CalendarEvent[]> => {
    try {
      if (encryptedEvents.length === 0) {
        encryptedEvents = await fetchCalendarEvents();
      }
      
      const decryptedEvents = encryptedEvents
        .map(event => {
          try {
            if (!validateDecryptedEvent(event)) {
              console.error('Event data is invalid for event:', event.id);
              return null;
            }

            const decryptedData = decryptEventData(event.encrypted_data, key, event.salt, event.iv);
            if (!decryptedData) {
              console.error('Failed to decrypt event data for event:', event.id);
              return null;
            }

            return processDecryptedEvent(event, decryptedData, calendars);
          } catch (error) {
            console.error('Error decrypting event:', error);
            return null;
          }
        })
        .filter((event): event is NonNullable<typeof event> => event !== null);
      
      const sortedEvents = sortEventsByStartTime(decryptedEvents);
      eventActions.setEvents(sortedEvents);
      eventActions.setIsLoading(false);
      return sortedEvents;
    } catch (error) {
      console.error('Error in loadEventsWithCalendars:', error);
      setError('Failed to load your Calendar events');
      eventActions.setIsLoading(false);
      throw error;
    }
  };

  return {
    loadEvents,
    loadEventsWithCalendars
  };
};
