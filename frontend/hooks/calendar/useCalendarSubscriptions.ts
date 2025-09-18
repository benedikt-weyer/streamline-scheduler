import { useState, useEffect, useRef } from 'react';
import { getDecryptedBackend } from '@/utils/api/decrypted-backend';
import { RealtimeSubscription, RealtimeMessage, CalendarDecrypted, CalendarEventDecrypted } from '@/utils/api/types';

export function useCalendarSubscriptions(
  calendarLoadFn: () => Promise<void>,
  eventLoadFn: () => Promise<void>
) {
  const [isSubscribed, setIsSubscribed] = useState<boolean>(false);

  useEffect(() => {
    let calendarUnsubscribe: RealtimeSubscription | null = null;
    let eventUnsubscribe: RealtimeSubscription | null = null;

    const setupSubscriptions = async () => {
      try {
        const backend = getDecryptedBackend();

        // Subscribe to calendars changes
        calendarUnsubscribe = backend.calendars.subscribe(async (message: RealtimeMessage<CalendarDecrypted>) => {
          // console.log('Calendar change detected:', message.event_type);
          
          // Reload calendars when a change is detected
          try {
            await calendarLoadFn();
          } catch (error) {
            console.error('Error reloading calendars after subscription update:', error);
          }
        });

        // Subscribe to calendar_events changes
        eventUnsubscribe = backend.calendarEvents.subscribe(async (message: RealtimeMessage<CalendarEventDecrypted>) => {
          // console.log('Calendar event change detected:', message.event_type);
          
          
          // Reload events when a change is detected
          try {
            await eventLoadFn();
          } catch (error) {
            console.error('Error reloading events after subscription update:', error);
          }
        });

        setIsSubscribed(true);
        // console.log('Subscribed to calendar and event changes');
      } catch (error) {
        console.error('Failed to setup WebSocket subscriptions:', error);
      }
    };

    setupSubscriptions();

    // Cleanup function to unsubscribe when component unmounts
    return () => {
      // console.log('Unsubscribing from calendar and event changes');
      if (calendarUnsubscribe) {
        calendarUnsubscribe.unsubscribe();
      }
      if (eventUnsubscribe) {
        eventUnsubscribe.unsubscribe();
      }
      setIsSubscribed(false);
    };
  }, [calendarLoadFn, eventLoadFn]);


  return { isSubscribed };
}
