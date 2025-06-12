import { useMemo, useCallback, useRef, useEffect } from 'react';
import { useCalendars } from './useCalendars';
import { useCalendarEvents } from './useCalendarEvents';
import { useCalendarSubscriptions } from './useCalendarSubscriptions';
import { CalendarEvent, Calendar, EventFormValues } from '@/utils/calendar/calendar-types';

/**
 * Combined calendar hook that provides all calendar functionality
 */
export function useCalendar(encryptionKey: string | null) {
  // Use ref to store loadEvents function to avoid circular dependency
  const loadEventsRef = useRef<((key: string) => Promise<any>) | null>(null);
  
  // Calendar management
  const { 
    calendars, 
    handleCalendarToggle, 
    handleCalendarCreate, 
    handleCalendarEdit, 
    handleCalendarDelete,
    setCalendarAsDefault,
    loadCalendarsAndSetState
  } = useCalendars(encryptionKey);
  
  // Subscribe to real-time updates
  const { skipNextEventReload } = useCalendarSubscriptions(
    encryptionKey,
    async () => {
      if (encryptionKey) {
        await loadCalendarsAndSetState(encryptionKey);
      }
    },
    async () => {
      if (encryptionKey && loadEventsRef.current) {
        await loadEventsRef.current(encryptionKey);
      }
    }
  );
  
  // Event management
  const {
    events,
    isLoading: isLoadingEvents,
    loadEvents,
    handleSubmitEvent,
    handleDeleteEvent,
    handleEventUpdate,
    moveEventToCalendar,
    handleDeleteThisOccurrence,
    handleDeleteThisAndFuture
  } = useCalendarEvents(encryptionKey, calendars, skipNextEventReload);
  
  // Store loadEvents in ref for subscription hook
  loadEventsRef.current = loadEvents;

  // Load data when encryption key is available
  useEffect(() => {
    const loadData = async () => {
      if (encryptionKey) {
        try {
          // First load calendars
          await loadCalendarsAndSetState(encryptionKey);
          // Then load events
          await loadEvents(encryptionKey);
        } catch (error) {
          console.error('Error loading calendar data:', error);
        }
      }
    };
    
    loadData();
  }, [encryptionKey]); // Remove function dependencies to prevent infinite loop

  // Handlers with proper callbacks
  const handleSetDefaultCalendar = useCallback((calendarId: string) => {
    setCalendarAsDefault(calendarId);
  }, [setCalendarAsDefault]);

  const handleCalendarDeleteWithEvents = useCallback(async (calendarId: string) => {
    return await handleCalendarDelete(calendarId, moveEventToCalendar);
  }, [handleCalendarDelete, moveEventToCalendar]);

  const onEventUpdate = useCallback((updatedEvent: CalendarEvent) => {
    return handleEventUpdate(updatedEvent);
  }, [handleEventUpdate]);

  return {
    // Data
    events,
    calendars,
    isLoading: isLoadingEvents,
    
    // Event handlers
    handleSubmitEvent,
    handleDeleteEvent,
    handleDeleteThisOccurrence,
    handleDeleteThisAndFuture,
    onEventUpdate,
    moveEventToCalendar,
    
    // Calendar handlers
    handleCalendarToggle,
    handleCalendarCreate,
    handleCalendarEdit,
    handleCalendarDelete: handleCalendarDeleteWithEvents,
    handleSetDefaultCalendar
  };
} 