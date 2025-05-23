import { useState, useEffect, useRef } from 'react';
import { createClient } from '@/utils/supabase/client';

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

    const supabase = createClient();
    let calendarSubscription: any = null;
    let eventSubscription: any = null;

    // Subscribe to calendars table changes
    calendarSubscription = supabase
      .channel('calendars-changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'calendars'
      }, async (payload) => {
        console.log('Calendar change detected:', payload.eventType);
        
        // Reload calendars when a change is detected
        try {
          await calendarLoadFn();
        } catch (error) {
          console.error('Error reloading calendars after subscription update:', error);
        }
      })
      .subscribe();

    // Subscribe to calendar_events table changes
    eventSubscription = supabase
      .channel('calendar-events-changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'calendar_events'
      }, async (payload) => {
        console.log('Calendar event change detected:', payload.eventType);
        
        // Skip reload if we're in the middle of a drag operation
        if (skipNextEventReloadRef.current) {
          console.log('Skipping event reload due to local update');
          skipNextEventReloadRef.current = false;
          return;
        }
        
        // Reload events when a change is detected
        try {
          await eventLoadFn();
        } catch (error) {
          console.error('Error reloading events after subscription update:', error);
        }
      })
      .subscribe();

    setIsSubscribed(true);
    console.log('Subscribed to calendar and event changes');

    // Cleanup function to unsubscribe when component unmounts
    return () => {
      console.log('Unsubscribing from calendar and event changes');
      if (calendarSubscription) {
        supabase.removeChannel(calendarSubscription);
      }
      if (eventSubscription) {
        supabase.removeChannel(eventSubscription);
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
