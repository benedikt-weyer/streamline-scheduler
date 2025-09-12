import { useState, useEffect, useRef } from 'react';
import { getBackend } from '@/utils/api/backend-interface';
import { RealtimeSubscription, RealtimeMessage, Calendar, CalendarEvent } from '@/utils/api/types';

export function useCalendarSubscriptions(
  encryptionKey: string | null,
  calendarLoadFn: () => Promise<void>,
  eventLoadFn: () => Promise<void>
) {
  const [isSubscribed, setIsSubscribed] = useState<boolean>(false);
  const skipNextEventReloadRef = useRef<boolean>(false);

  useEffect(() => {
    // Only subscribe when we have an encryption key
    if (!encryptionKey) {
      return;
    }

    let calendarUnsubscribe: RealtimeSubscription | null = null;
    let eventUnsubscribe: RealtimeSubscription | null = null;

    const setupSubscriptions = async () => {
      try {
        const backend = getBackend();

        // Subscribe to calendars changes
        calendarUnsubscribe = backend.calendars.subscribe(async (message: RealtimeMessage<Calendar>) => {
          // console.log('Calendar change detected:', message.event_type);
          
          // Reload calendars when a change is detected
          try {
            await calendarLoadFn();
          } catch (error) {
            console.error('Error reloading calendars after subscription update:', error);
          }
        });

        // Subscribe to calendar_events changes
        eventUnsubscribe = backend.calendarEvents.subscribe(async (message: RealtimeMessage<CalendarEvent>) => {
          // console.log('Calendar event change detected:', message.event_type);
          
          // Skip reload if we're in the middle of a drag operation
          if (skipNextEventReloadRef.current) {
            // console.log('Skipping event reload due to local update');
            // Reset the flag after a short delay to allow multi-step operations to complete
            setTimeout(() => {
              skipNextEventReloadRef.current = false;
              // console.log('skipNextEventReloadRef reset after delay');
            }, 500); // 500ms delay
            return;
          }
          
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
  }, [encryptionKey, calendarLoadFn, eventLoadFn]);

  // Function to skip the next event reload (useful for drag operations)
  const skipNextEventReload = () => {
    skipNextEventReloadRef.current = true;
  };

  return { isSubscribed, skipNextEventReload };
}
