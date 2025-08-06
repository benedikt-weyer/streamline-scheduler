'use client';

import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

import { CalendarHeader } from '@/components/dashboard/calendar/calendar-header';
import { CalendarGrid } from '@/components/dashboard/calendar/calendar-grid';
import { CalendarEventDialog, EventFormValues } from '@/components/dashboard/calendar/calendar-event-dialog';
import { RecurringEventModificationDialog } from '@/components/dashboard/calendar/recurring-event-modification-dialog';
import { CalendarSidebar } from '@/components/dashboard/calendar/calendar-sidebar';
import { CalendarHeaderMobile } from '@/components/dashboard/calendar/calendar-header-mobile';
import { CalendarGridMobile } from '@/components/dashboard/calendar/calendar-grid-mobile';

import { CalendarEvent, RecurrenceFrequency } from '@/utils/calendar/calendar-types';
import { useEncryptionKey } from '@/hooks/cryptography/useEncryptionKey';
import { ErrorProvider, useError } from '@/utils/context/ErrorContext';

// Import our custom hooks
import { useCalendars } from '../../../hooks/calendar/useCalendars';
import { useCalendarEvents } from '../../../hooks/calendar/useCalendarEvents';
import { useCalendarSubscriptions } from '../../../hooks/calendar/useCalendarSubscriptions';
import { useICSEvents } from '../../../hooks/calendar/useICSEvents';
import { getDaysOfWeek, getEventsInWeek } from '../../../utils/calendar/calendarHelpers';
import { startOfWeek } from 'date-fns';

function CalendarContent() {
  const { encryptionKey, isLoading: isLoadingKey } = useEncryptionKey();
  const { error, setError } = useError();
  const [currentWeek, setCurrentWeek] = useState<Date>(new Date());
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [isDialogOpen, setIsDialogOpen] = useState<boolean>(false);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [shouldSelectToday, setShouldSelectToday] = useState<boolean>(false);
  
  // Use ref to store loadEvents function to avoid circular dependency
  const loadEventsRef = useRef<((key: string) => Promise<any>) | null>(null);
  
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
  } = useCalendars(encryptionKey);
  
  // Subscribe to real-time updates (need to get skipNextEventReload before useCalendarEvents)
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
  
  const {
    events,
    isLoading: isLoadingEvents,
    loadEvents,
    handleSubmitEvent,
    handleDeleteEvent,
    handleEventUpdate,
    moveEventToCalendar,
    handleDeleteThisOccurrence,
    handleDeleteThisAndFuture,
    handleModifyThisOccurrence,
    handleModifyThisAndFuture,
    handleModifyAllInSeries
  } = useCalendarEvents(encryptionKey, calendars, skipNextEventReload);

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

  // Calculate derived data using useMemo to avoid unnecessary recalculations
  const daysOfWeek = useMemo(() => 
    getDaysOfWeek(currentWeek), [currentWeek]
  );
  
  // Combine regular events and ICS events
  const allEvents = useMemo(() => [...events, ...icsEvents], [events, icsEvents]);

  // First filter events by visible calendars, then get events for current week
  const visibleEvents = useMemo(() => 
    allEvents.filter(event => 
      // Only include events from visible calendars
      calendars.find(cal => cal.id === event.calendarId)?.isVisible ?? false
    ), [allEvents, calendars]
  );
  
  const eventsInCurrentWeek = useMemo(() => 
    getEventsInWeek(visibleEvents, daysOfWeek[0]), [visibleEvents, daysOfWeek]
  );

  // Memoize filtered visible calendars to avoid recalculating on each render
  const visibleCalendars = useMemo(() => 
    calendars.filter(cal => cal.isVisible), [calendars]
  );

  // Memoize default calendar ID lookup
  const defaultCalendarId = useMemo(() => 
    calendars.find(cal => cal.isDefault)?.id, [calendars]
  );

  // Memoize fallback calendar ID for new events
  const fallbackCalendarId = useMemo(() => 
    defaultCalendarId ?? (calendars.length > 0 ? calendars[0].id : ''), 
    [defaultCalendarId, calendars]
  );
  
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
          setError('Failed to load calendar data');
        }
      }
    };
    
    loadData();
  }, [encryptionKey]);

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
    } catch (error) {
      console.error('Error in handleCalendarDeleteWithEvents:', error);
      setError('Failed to delete calendar and move events');
    }
  }, [handleCalendarDelete, moveEventToCalendar, events, setError]);

  // Handle ICS calendar refresh
  const handleICSCalendarRefreshWrapper = useCallback(async (calendarId: string) => {
    try {
      await handleICSCalendarRefresh(calendarId);
      await refreshICSCalendar(calendarId);
    } catch (error) {
      console.error('Error refreshing ICS calendar:', error);
      setError('Failed to refresh ICS calendar');
    }
  }, [handleICSCalendarRefresh, refreshICSCalendar, setError]);

  // Open dialog for editing an event
  const openEditDialog = useCallback((event: CalendarEvent) => {
    // Allow viewing ICS events in read-only mode
    setSelectedEvent(event);
    setIsDialogOpen(true);
  }, []);

  // Open dialog for creating a new event
  const openNewEventDialog = useCallback((day?: Date, calendarId?: string) => {
    // If a specific calendar is provided, check if it's read-only
    if (calendarId && isReadOnlyCalendar(calendarId)) {
      setError('Cannot create events in ICS calendars');
      return;
    }
    
    setSelectedEvent(null);
    
    // If a day is provided, set the start time to the clicked time
    if (day) {
      const startTime = new Date(day);
      
      // Set end time to be 1 hour after start time
      const endTime = new Date(startTime);
      endTime.setHours(endTime.getHours() + 1);
      
      // Create a temporary "dummy" event to pass to the form
      const dummyEvent: CalendarEvent = {
        id: 'new', // This ID will never be used, it's just for the temporary object
        title: '',
        description: '',
        calendarId: calendarId ?? fallbackCalendarId,
        startTime: startTime,
        endTime: endTime,
        createdAt: new Date()
      };
      
      // Set as selected event to prefill the form with these times
      setSelectedEvent(dummyEvent);
    }
    
    setIsDialogOpen(true);
  }, [fallbackCalendarId, isReadOnlyCalendar, setError]);

  // Handle submit event and close dialog
  const onSubmitEvent = useCallback(async (values: EventFormValues) => {
    // Prevent editing ICS events
    if (values.id && isICSEvent({ id: values.id } as CalendarEvent)) {
      setError('Events from ICS calendars cannot be edited');
      return;
    }
    // Prevent creating events in ICS calendars
    if (isReadOnlyCalendar(values.calendarId)) {
      setError('Cannot create events in ICS calendars');
      return;
    }
    const success = await handleSubmitEvent(values);
    if (success) {
      setSelectedEvent(null);
      setIsDialogOpen(false);
    }
  }, [handleSubmitEvent, isICSEvent, isReadOnlyCalendar, setError]);

  // Handle delete event and close dialog
  const onDeleteEvent = useCallback(async (id: string) => {
    // Prevent deleting ICS events
    if (isICSEvent({ id } as CalendarEvent)) {
      setError('Events from ICS calendars cannot be deleted');
      return;
    }
    const success = await handleDeleteEvent(id);
    if (success && selectedEvent?.id === id) {
      setSelectedEvent(null);
      setIsDialogOpen(false);
    }
  }, [handleDeleteEvent, selectedEvent?.id, isICSEvent, setError]);

  // Callback for deleting a single occurrence
  const onDeleteThisOccurrenceHandler = useCallback(async (event: CalendarEvent) => {
    if (!handleDeleteThisOccurrence) return; // Guard if function is not available
    const success = await handleDeleteThisOccurrence(event);
    if (success) {
      setSelectedEvent(null);
      setIsDialogOpen(false);
    }
  }, [handleDeleteThisOccurrence, setIsDialogOpen, setSelectedEvent]);

  // Callback for deleting this and future occurrences
  const onDeleteThisAndFutureHandler = useCallback(async (event: CalendarEvent) => {
    if (!handleDeleteThisAndFuture) return; // Guard if function is not available
    const success = await handleDeleteThisAndFuture(event);
    if (success) {
      setSelectedEvent(null);
      setIsDialogOpen(false);
    }
  }, [handleDeleteThisAndFuture, setIsDialogOpen, setSelectedEvent]);

  // Callback for deleting all events in a series
  const onDeleteAllInSeriesHandler = useCallback(async (event: CalendarEvent) => {
    // handleDeleteEvent from the hook expects an ID.
    const success = await handleDeleteEvent(event.id);
    if (success) {
      setSelectedEvent(null);
      setIsDialogOpen(false);
    }
  }, [handleDeleteEvent, setIsDialogOpen, setSelectedEvent]);

  // Callbacks for modifying recurring events
  const onModifyThisOccurrenceHandler = useCallback(async (event: CalendarEvent, modifiedData: any) => {
    if (!handleModifyThisOccurrence) return;
    const success = await handleModifyThisOccurrence(event, modifiedData);
    if (success) {
      setSelectedEvent(null);
      setIsDialogOpen(false);
    }
  }, [handleModifyThisOccurrence, setIsDialogOpen, setSelectedEvent]);

  const onModifyThisAndFutureHandler = useCallback(async (event: CalendarEvent, modifiedData: any) => {
    if (!handleModifyThisAndFuture) return;
    const success = await handleModifyThisAndFuture(event, modifiedData);
    if (success) {
      setSelectedEvent(null);
      setIsDialogOpen(false);
    }
  }, [handleModifyThisAndFuture, setIsDialogOpen, setSelectedEvent]);

  const onModifyAllInSeriesHandler = useCallback(async (event: CalendarEvent, modifiedData: any) => {
    if (!handleModifyAllInSeries) return;
    const success = await handleModifyAllInSeries(event, modifiedData);
    if (success) {
      setSelectedEvent(null);
      setIsDialogOpen(false);
    }
  }, [handleModifyAllInSeries, setIsDialogOpen, setSelectedEvent]);

  // State for drag/resize modification modal
  const [isDragModificationModalOpen, setIsDragModificationModalOpen] = useState(false);
  const [pendingDraggedEvent, setPendingDraggedEvent] = useState<CalendarEvent | null>(null);

  // Handler for drag/resize operations that checks for recurring events
  const handleEventUpdateWithRecurrenceCheck = useCallback(async (updatedEvent: CalendarEvent) => {
    // Check if this is a recurring event
    const isRecurringEvent = updatedEvent.recurrencePattern && 
      updatedEvent.recurrencePattern.frequency !== RecurrenceFrequency.None;

    if (isRecurringEvent) {
      // Store the updated event and show the modification choice modal
      setPendingDraggedEvent(updatedEvent);
      setIsDragModificationModalOpen(true);
      return;
    }

    // For non-recurring events, update directly
    await handleEventUpdate(updatedEvent);
  }, [handleEventUpdate, handleModifyAllInSeries, handleModifyThisAndFuture, handleModifyThisOccurrence]);

  // Handlers for drag/resize modification choices
  const handleDragModifyThisOccurrence = useCallback(async (event: CalendarEvent) => {
    if (pendingDraggedEvent && handleModifyThisOccurrence) {
      const modifiedData = {
        title: pendingDraggedEvent.title,
        description: pendingDraggedEvent.description,
        location: pendingDraggedEvent.location,
        startTime: pendingDraggedEvent.startTime,
        endTime: pendingDraggedEvent.endTime
      };
      await handleModifyThisOccurrence(event, modifiedData);
      setPendingDraggedEvent(null);
    }
  }, [pendingDraggedEvent, handleModifyThisOccurrence]);

  const handleDragModifyThisAndFuture = useCallback(async (event: CalendarEvent) => {
    if (pendingDraggedEvent && handleModifyThisAndFuture) {
      const modifiedData = {
        title: pendingDraggedEvent.title,
        description: pendingDraggedEvent.description,
        location: pendingDraggedEvent.location,
        startTime: pendingDraggedEvent.startTime,
        endTime: pendingDraggedEvent.endTime
      };
      await handleModifyThisAndFuture(event, modifiedData);
      setPendingDraggedEvent(null);
    }
  }, [pendingDraggedEvent, handleModifyThisAndFuture]);

  const handleDragModifyAllInSeries = useCallback(async (event: CalendarEvent) => {
    if (pendingDraggedEvent && handleModifyAllInSeries) {
      const modifiedData = {
        title: pendingDraggedEvent.title,
        description: pendingDraggedEvent.description,
        location: pendingDraggedEvent.location,
        startTime: pendingDraggedEvent.startTime,
        endTime: pendingDraggedEvent.endTime
      };
      await handleModifyAllInSeries(event, modifiedData);
      setPendingDraggedEvent(null);
    }
  }, [pendingDraggedEvent, handleModifyAllInSeries]);

  const handleDragModificationConfirmed = () => {
    setPendingDraggedEvent(null);
  };

  // Memoized handlers for JSX props to prevent unnecessary re-renders
  const openNewEventDialogHandler = useCallback(() => {
    openNewEventDialog();
  }, [openNewEventDialog]);

  const openNewEventDialogWithDayHandler = useCallback((day: Date) => {
    openNewEventDialog(day);
  }, [openNewEventDialog]);

  // Handle today selection from mobile header
  const handleTodaySelected = useCallback(() => {
    setShouldSelectToday(true);
    // Reset the flag after a brief delay to allow the effect to trigger
    setTimeout(() => setShouldSelectToday(false), 100);
  }, []);

  // Handle date selection from month overview
  const handleDateSelect = useCallback((date: Date) => {
    setSelectedDate(date);
    // Navigate to the week containing the selected date (Monday as start of week)
    const weekStart = startOfWeek(date, { weekStartsOn: 1 });
    setCurrentWeek(weekStart);
  }, []);

  // Update selected date when current week changes (from header navigation)
  useEffect(() => {
    // Only update if the selected date is not in the current week
    const currentWeekStart = startOfWeek(currentWeek, { weekStartsOn: 1 });
    const selectedDateWeekStart = startOfWeek(selectedDate, { weekStartsOn: 1 });
    
    if (currentWeekStart.getTime() !== selectedDateWeekStart.getTime()) {
      // Set selected date to the first day of the current week
      setSelectedDate(currentWeekStart);
    }
  }, [currentWeek, selectedDate]);

  // Handle month change from month overview
  const handleMonthChange = useCallback((date: Date) => {
    // Optional: You could navigate to the first week of the month
    // For now, just keep the current week unless it's outside the new month
  }, []);

  // Show loading or auth required message
  if (isLoadingKey) {
    return <div className="text-center py-8">Loading...</div>;
  }

  if (!encryptionKey && !isLoadingKey) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] p-4">
        <h1 className="text-2xl font-bold mb-4">Authentication Required</h1>
        <p className="text-center mb-4">
          You need to log in first to access your encrypted Calendar.
        </p>
        <Link href="/sign-in">
          <Button>Sign In</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="flex w-full h-full">
      {/* Mobile Layout */}
      <div className="md:hidden w-full flex flex-col h-screen">
        {/* Mobile Header */}
        <div className="border-b p-4 flex-shrink-0">
          <CalendarHeaderMobile 
            currentWeek={currentWeek}
            setCurrentWeek={setCurrentWeek}
            openNewEventDialog={openNewEventDialogHandler}
            calendars={calendars}
            onCalendarToggle={handleCalendarToggle}
            onCalendarCreate={handleCalendarCreate}
            onICSCalendarCreate={handleICSCalendarCreate}
            onICSCalendarRefresh={handleICSCalendarRefreshWrapper}
            onCalendarEdit={handleCalendarEdit}
            onCalendarDelete={handleCalendarDeleteWithEvents}
            onSetDefaultCalendar={setCalendarAsDefault}
            onTodaySelected={handleTodaySelected}
          />
        </div>

        {/* Mobile Calendar Content */}
        <div className="flex-1 p-4 overflow-hidden">
          {error && (
            <div className="bg-destructive/10 text-destructive p-3 rounded-md mb-4">
              {error}
            </div>
          )}
          
          {/* Display loading or calendar grid */}
          {isLoadingEvents ? (
            <div className="text-center py-8">Loading your encrypted calendar...</div>
          ) : (
            <CalendarGridMobile 
              days={daysOfWeek}
              events={eventsInCurrentWeek}
              calendars={calendars}
              openEditDialog={openEditDialog}
              openNewEventDialog={openNewEventDialogWithDayHandler}
              onEventUpdate={handleEventUpdateWithRecurrenceCheck}
              shouldSelectToday={shouldSelectToday}
            />
          )}
        </div>
      </div>

      {/* Desktop Layout */}
      <div className="hidden md:flex w-full h-full">
        {/* Calendar Sidebar */}
        <CalendarSidebar
          calendars={calendars}
          onCalendarToggle={handleCalendarToggle}
          onCalendarCreate={handleCalendarCreate}
          onICSCalendarCreate={handleICSCalendarCreate}
          onICSCalendarRefresh={handleICSCalendarRefreshWrapper}
          onCalendarEdit={handleCalendarEdit}
          onCalendarDelete={handleCalendarDeleteWithEvents}
          onSetDefaultCalendar={setCalendarAsDefault}
          selectedDate={selectedDate}
          currentWeek={currentWeek}
          onDateSelect={handleDateSelect}
          onMonthChange={handleMonthChange}
        />
        
        {/* Main Calendar Content */}
        <div className="flex-1 px-4">
          <CalendarHeader 
            currentWeek={currentWeek}
            setCurrentWeek={setCurrentWeek}
            openNewEventDialog={openNewEventDialogHandler}
          />
          
          {error && (
            <div className="bg-destructive/10 text-destructive p-3 rounded-md mb-4">
              {error}
            </div>
          )}
          
          {/* Display loading or calendar grid */}
          {isLoadingEvents ? (
            <div className="text-center py-8">Loading your encrypted calendar...</div>
          ) : (
              <CalendarGrid 
                days={daysOfWeek}
                events={eventsInCurrentWeek}
                calendars={calendars}
                openEditDialog={openEditDialog}
                openNewEventDialog={openNewEventDialogWithDayHandler}
                onEventUpdate={handleEventUpdateWithRecurrenceCheck}
              />
          )}
        </div>
      </div>

      {/* Event dialog */}
      <CalendarEventDialog 
        isOpen={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        selectedEvent={selectedEvent}
        calendars={visibleCalendars}
        defaultCalendarId={defaultCalendarId}
        onSubmit={onSubmitEvent}
        onDelete={onDeleteEvent}
        onDeleteThisOccurrence={onDeleteThisOccurrenceHandler}
        onDeleteThisAndFuture={onDeleteThisAndFutureHandler}
        onDeleteAllInSeries={onDeleteAllInSeriesHandler}
        onModifyThisOccurrence={onModifyThisOccurrenceHandler}
        onModifyThisAndFuture={onModifyThisAndFutureHandler}
        onModifyAllInSeries={onModifyAllInSeriesHandler}
      />

      {/* Drag/Resize Modification Dialog */}
      {pendingDraggedEvent && (
        <RecurringEventModificationDialog
          isOpen={isDragModificationModalOpen}
          onOpenChange={setIsDragModificationModalOpen}
          selectedEvent={pendingDraggedEvent}
          onModifyThisOccurrence={handleDragModifyThisOccurrence}
          onModifyThisAndFuture={handleDragModifyThisAndFuture}
          onModifyAllInSeries={handleDragModifyAllInSeries}
          onModificationConfirmed={handleDragModificationConfirmed}
        />
      )}
    </div>
  );
}

export default function CalendarPage() {
  return (
    <ErrorProvider>
      <CalendarContent />
    </ErrorProvider>
  );
}