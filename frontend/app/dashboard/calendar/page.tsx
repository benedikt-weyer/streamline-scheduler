'use client';

import { useEffect, useCallback, useRef } from 'react';

import { CalendarFullControlCrossPlatform } from '@/components/dashboard/calendar/calendar-full-control-cross-platform';

import { ErrorProvider, useError } from '@/utils/context/ErrorContext';

// Import our custom hooks
import { useCalendars } from '../../../hooks/calendar/useCalendars';
import { useCalendarEvents } from '../../../hooks/calendar/useCalendarEvents';
import { useCalendarSubscriptions } from '../../../hooks/calendar/useCalendarSubscriptions';
import { useICSEvents } from '../../../hooks/calendar/useICSEvents';

function CalendarContent() {
  const { error, setError } = useError();
  
  // Use ref to store loadEvents function to avoid circular dependency
  const loadEventsRef = useRef<(() => Promise<any>) | null>(null);
  
  // Use our custom hooks
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
  
  // Subscribe to real-time updates (need to get skipNextEventReload before useCalendarEvents)
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
    handleDeleteThisAndFuture,
    handleModifyThisOccurrence,
    handleModifyThisAndFuture,
    handleModifyAllInSeries
  } = useCalendarEvents(calendars, skipNextEventReload);

  // ICS events hook
  const {
    icsEvents,
    isLoading: isLoadingICSEvents,
    refreshICSCalendar,
    isICSEvent,
    isReadOnlyCalendar
  } = useICSEvents(calendars);
  
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
        setError('Failed to load calendar data');
      }
    };
    
    loadData();
  }, []);

  // Function to handle calendar deletion with event moving
  const handleCalendarDeleteWithEvents = useCallback(async (calendarId: string) => {
    try {
      // Delete the calendar and get the target calendar ID for moving events
      const targetCalendarId = await handleCalendarDelete(calendarId, moveEventToCalendar);
      
      if (targetCalendarId) {
        // Move all events from this calendar to the target calendar
        const eventsToMove = events.filter(event => event.calendarId === calendarId);
        for (const event of eventsToMove) {
          await moveEventToCalendar(event.id, targetCalendarId);
        }
      }
      return targetCalendarId;
    } catch (error) {
      console.error('Error in handleCalendarDeleteWithEvents:', error);
      setError('Failed to delete calendar and move events');
      throw error;
    }
  }, [handleCalendarDelete, moveEventToCalendar, events, setError]);

  return (
    <CalendarFullControlCrossPlatform
      // Data
      calendars={calendars}
      events={events}
      icsEvents={icsEvents}
      isLoading={isLoadingEvents || isLoadingICSEvents}
      error={error}
      
      // Calendar handlers
      onCalendarToggle={handleCalendarToggle}
      onCalendarCreate={handleCalendarCreate}
      onICSCalendarCreate={(name: string, color: string, icsUrl: string) => handleICSCalendarCreate(name, color, icsUrl)}
      onICSCalendarRefresh={handleICSCalendarRefresh}
      onCalendarEdit={handleCalendarEdit}
      onCalendarDelete={handleCalendarDeleteWithEvents}
      onSetDefaultCalendar={setCalendarAsDefault}
      
      // Event handlers
      onSubmitEvent={handleSubmitEvent}
      onDeleteEvent={handleDeleteEvent}
      onCloneEvent={handleCloneEvent}
      onEventUpdate={handleEventUpdate}
      moveEventToCalendar={moveEventToCalendar}
      
      // Recurrence event handlers
      onDeleteThisOccurrence={handleDeleteThisOccurrence}
      onDeleteThisAndFuture={handleDeleteThisAndFuture}
      onModifyThisOccurrence={handleModifyThisOccurrence}
      onModifyThisAndFuture={handleModifyThisAndFuture}
      onModifyAllInSeries={handleModifyAllInSeries}
      
      // ICS handlers
      onRefreshICSCalendar={refreshICSCalendar}
      isICSEvent={isICSEvent}
      isReadOnlyCalendar={isReadOnlyCalendar}
      
      // Custom loading text
      loadingText="Loading your encrypted calendar..."
    />
  );
}

export default function CalendarPage() {
  return (
    <ErrorProvider>
      <CalendarContent />
    </ErrorProvider>
  );
}