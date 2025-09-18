import { useMemo, useCallback, useRef, useEffect } from 'react';
import { useCalendars } from './useCalendars';
import { useCalendarEvents } from './useCalendarEvents';
import { useCalendarSubscriptions } from './useCalendarSubscriptions';
import { CalendarEvent, Calendar, EventFormValues } from '@/utils/calendar/calendar-types';

/**
 * Combined calendar hook that provides all calendar functionality
 */
export function useCalendar() {
  // Use ref to store loadEvents function to avoid circular dependency
  const loadEventsRef = useRef<(() => Promise<any>) | null>(null);
  
  // Calendar management
  const { 
    calendars, 
    handleCalendarToggle, 
    handleCalendarCreate, 
    handleICSCalendarCreate,
    handleICSCalendarRefresh,
    handleCalendarEdit, 
    handleCalendarDelete,
    setCalendarAsDefault,
    loadCalendarsAndSetState
  } = useCalendars();
  
  // Subscribe to real-time updates
  const { skipNextEventReload } = useCalendarSubscriptions(
    async () => {
      await loadCalendarsAndSetState();
    },
    async () => {
      if (loadEventsRef.current) {
        await loadEventsRef.current();
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
    handleCloneEvent,
    handleEventUpdate,
    moveEventToCalendar,
    handleDeleteThisOccurrence,
    handleDeleteThisAndFuture
  } = useCalendarEvents(calendars, skipNextEventReload);
  
  // Store loadEvents in ref for subscription hook
  loadEventsRef.current = loadEvents;

  // Load data when component mounts
  useEffect(() => {
    const loadData = async () => {
      try {
        // First load calendars
        await loadCalendarsAndSetState();
        // Then load events
        await loadEvents();
      } catch (error) {
        console.error('Error loading calendar data:', error);
      }
    };
    
    loadData();
  }, []); // Load on mount

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
    handleCloneEvent,
    handleDeleteThisOccurrence,
    handleDeleteThisAndFuture,
    onEventUpdate,
    moveEventToCalendar,
    
    // Calendar handlers
    handleCalendarToggle,
    handleCalendarCreate,
    handleICSCalendarCreate,
    handleICSCalendarRefresh,
    handleCalendarEdit,
    handleCalendarDelete: handleCalendarDeleteWithEvents,
    handleSetDefaultCalendar
  };
} 