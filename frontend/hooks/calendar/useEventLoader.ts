import { CalendarEvent, Calendar } from '@/utils/calendar/calendar-types';
import { EventStateActions } from './types/eventHooks';
import { useError } from '@/utils/context/ErrorContext';
import { getDecryptedBackend } from '@/utils/api/decrypted-backend';
import { CalendarEventDecrypted } from '@/utils/api/types';
import { processDecryptedEvent, sortEventsByStartTime } from '../../utils/calendar/eventDataProcessing';

/**
 * Hook for loading and decrypting events
 */
export const useEventLoader = (
  calendars: Calendar[],
  eventActions: EventStateActions
) => {
  const { setError } = useError();

  const loadEvents = async (): Promise<CalendarEvent[]> => {
    try {
      eventActions.setIsLoading(true);
      const backend = getDecryptedBackend();
      const { data: decryptedEvents } = await backend.calendarEvents.getAll();
      
      if (decryptedEvents.length === 0) {
        eventActions.setEvents([]);
        eventActions.setIsLoading(false);
        return [];
      }
      return await loadEventsWithCalendars(decryptedEvents);
    } catch (error) {
      console.error('Error loading events:', error);
      setError('Failed to load your Calendar events');
      eventActions.setIsLoading(false);
      return [];
    }
  };

  const loadEventsWithCalendars = async (decryptedEvents: CalendarEventDecrypted[] = []): Promise<CalendarEvent[]> => {
    try {
      if (decryptedEvents.length === 0) {
        const backend = getDecryptedBackend();
        const { data: events } = await backend.calendarEvents.getAll();
        decryptedEvents = events;
      }
      
      const processedEvents = decryptedEvents
        .map(event => {
          try {
            return processDecryptedEvent(event, event, calendars);
          } catch (error) {
            console.error('Error processing event:', error);
            return null;
          }
        })
        .filter((event): event is NonNullable<typeof event> => event !== null);
      
      const sortedEvents = sortEventsByStartTime(processedEvents);
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
