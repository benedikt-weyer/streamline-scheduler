'use client';

import React, { useState, useMemo, useCallback } from 'react';
import { CalendarHeader } from './calendar-header';
import { CalendarGrid } from './calendar-grid';
import { CalendarEventDialog, EventFormValues } from './calendar-event-dialog';
import { RecurringEventModificationDialog } from './recurring-event-modification-dialog';
import { CalendarSidebar } from './calendar-sidebar';
import { CalendarHeaderMobile } from './calendar-header-mobile';
import { CalendarGridMobile } from './calendar-grid-mobile';

import { CalendarEvent, Calendar, RecurrenceFrequency } from '@/utils/calendar/calendar-types';
import { getDaysOfWeek, getEventsInWeek } from '@/utils/calendar/calendarHelpers';
import { startOfWeek } from 'date-fns';

export interface CalendarFullControlCrossPlatformProps {
  // Data
  calendars: Calendar[];
  events: CalendarEvent[];
  icsEvents: CalendarEvent[];
  isLoading: boolean;
  error?: string | null;
  
  // State props (optional - component can manage its own state if not provided)
  currentWeek?: Date;
  setCurrentWeek?: React.Dispatch<React.SetStateAction<Date>>;
  selectedDate?: Date;
  setSelectedDate?: React.Dispatch<React.SetStateAction<Date>>;
  isDialogOpen?: boolean;
  setIsDialogOpen?: (open: boolean) => void;
  selectedEvent?: CalendarEvent | null;
  setSelectedEvent?: (event: CalendarEvent | null) => void;
  shouldSelectToday?: boolean;
  setShouldSelectToday?: (should: boolean) => void;
  
  // Calendar handlers
  onCalendarToggle: (calendarId: string, isVisible: boolean) => Promise<void>;
  onCalendarCreate: (name: string, color: string) => Promise<Calendar>;
  onICSCalendarCreate: (name: string, color: string, icsUrl: string) => Promise<Calendar>;
  onICSCalendarRefresh: (calendarId: string) => Promise<void>;
  onCalendarEdit: (id: string, name: string, color: string) => Promise<void>;
  onCalendarDelete: (calendarId: string) => Promise<string | undefined>;
  onSetDefaultCalendar: (calendarId: string) => Promise<void>;
  
  // Event handlers
  onSubmitEvent: (values: EventFormValues) => Promise<boolean>;
  onDeleteEvent: (id: string) => Promise<boolean>;
  onCloneEvent: (event: CalendarEvent) => Promise<boolean>;
  onEventUpdate: (updatedEvent: CalendarEvent) => Promise<boolean>;
  moveEventToCalendar: (eventId: string, targetCalendarId: string) => Promise<void>;
  
  // Recurrence event handlers
  onDeleteThisOccurrence?: (event: CalendarEvent) => Promise<boolean>;
  onDeleteThisAndFuture?: (event: CalendarEvent) => Promise<boolean>;
  onModifyThisOccurrence?: (event: CalendarEvent, modifiedData: any) => Promise<boolean>;
  onModifyThisAndFuture?: (event: CalendarEvent, modifiedData: any) => Promise<boolean>;
  onModifyAllInSeries?: (event: CalendarEvent, modifiedData: any) => Promise<boolean>;
  
  // ICS handlers
  onRefreshICSCalendar: (calendarId: string) => Promise<void>;
  isICSEvent: (event: CalendarEvent) => boolean;
  isReadOnlyCalendar: (calendarId: string) => boolean;
  
  // Optional custom class names
  className?: string;
  
  // Optional loading text
  loadingText?: string;
}

export function CalendarFullControlCrossPlatform({
  // Data
  calendars,
  events,
  icsEvents,
  isLoading,
  error,
  
  // State props (with defaults for internal state management)
  currentWeek: propCurrentWeek,
  setCurrentWeek: propSetCurrentWeek,
  selectedDate: propSelectedDate,
  setSelectedDate: propSetSelectedDate,
  isDialogOpen: propIsDialogOpen,
  setIsDialogOpen: propSetIsDialogOpen,
  selectedEvent: propSelectedEvent,
  setSelectedEvent: propSetSelectedEvent,
  shouldSelectToday: propShouldSelectToday,
  setShouldSelectToday: propSetShouldSelectToday,
  
  // Calendar handlers
  onCalendarToggle,
  onCalendarCreate,
  onICSCalendarCreate,
  onICSCalendarRefresh,
  onCalendarEdit,
  onCalendarDelete,
  onSetDefaultCalendar,
  
  // Event handlers
  onSubmitEvent,
  onDeleteEvent,
  onCloneEvent,
  onEventUpdate,
  moveEventToCalendar,
  
  // Recurrence event handlers
  onDeleteThisOccurrence,
  onDeleteThisAndFuture,
  onModifyThisOccurrence,
  onModifyThisAndFuture,
  onModifyAllInSeries,
  
  // ICS handlers
  onRefreshICSCalendar,
  isICSEvent,
  isReadOnlyCalendar,
  
  // Optional props
  className = '',
  loadingText = 'Loading your calendar...'
}: CalendarFullControlCrossPlatformProps) {
  
  // Internal state management (only used if props not provided)
  const [internalCurrentWeek, setInternalCurrentWeek] = useState<Date>(new Date());
  const [internalSelectedDate, setInternalSelectedDate] = useState<Date>(new Date());
  const [internalIsDialogOpen, setInternalIsDialogOpen] = useState<boolean>(false);
  const [internalSelectedEvent, setInternalSelectedEvent] = useState<CalendarEvent | null>(null);
  const [internalShouldSelectToday, setInternalShouldSelectToday] = useState<boolean>(false);
  
  // Use provided state or fallback to internal state
  const currentWeek = propCurrentWeek ?? internalCurrentWeek;
  const setCurrentWeek = propSetCurrentWeek ?? setInternalCurrentWeek;
  const selectedDate = propSelectedDate ?? internalSelectedDate;
  const setSelectedDate = propSetSelectedDate ?? setInternalSelectedDate;
  const isDialogOpen = propIsDialogOpen ?? internalIsDialogOpen;
  const setIsDialogOpen = propSetIsDialogOpen ?? setInternalIsDialogOpen;
  const selectedEvent = propSelectedEvent ?? internalSelectedEvent;
  const setSelectedEvent = propSetSelectedEvent ?? setInternalSelectedEvent;
  const shouldSelectToday = propShouldSelectToday ?? internalShouldSelectToday;
  const setShouldSelectToday = propSetShouldSelectToday ?? setInternalShouldSelectToday;
  
  // Drag/resize modification modal state
  const [isDragModificationModalOpen, setIsDragModificationModalOpen] = useState(false);
  const [pendingDraggedEvent, setPendingDraggedEvent] = useState<CalendarEvent | null>(null);

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

  // Handle calendar deletion with event moving
  const handleCalendarDeleteWithEvents = useCallback(async (calendarId: string) => {
    try {
      // Delete the calendar and get the target calendar ID for moving events
      const targetCalendarId = await onCalendarDelete(calendarId);
      
      if (targetCalendarId) {
        // Move all events from this calendar to the target calendar
        const eventsToMove = events.filter(event => event.calendarId === calendarId);
        for (const event of eventsToMove) {
          await moveEventToCalendar(event.id, targetCalendarId);
        }
      }
    } catch (error) {
      console.error('Error in handleCalendarDeleteWithEvents:', error);
      throw error;
    }
  }, [onCalendarDelete, moveEventToCalendar, events]);

  // Handle ICS calendar refresh
  const handleICSCalendarRefreshWrapper = useCallback(async (calendarId: string) => {
    try {
      await onICSCalendarRefresh(calendarId);
      await onRefreshICSCalendar(calendarId);
    } catch (error) {
      console.error('Error refreshing ICS calendar:', error);
      throw error;
    }
  }, [onICSCalendarRefresh, onRefreshICSCalendar]);

  // Open dialog for editing an event
  const openEditDialog = useCallback((event: CalendarEvent) => {
    // Allow viewing ICS events in read-only mode
    setSelectedEvent(event);
    setIsDialogOpen(true);
  }, [setSelectedEvent, setIsDialogOpen]);

  // Open dialog for creating a new event
  const openNewEventDialog = useCallback((day?: Date, isAllDay?: boolean, calendarId?: string) => {
    // If a specific calendar is provided, check if it's read-only
    if (calendarId && isReadOnlyCalendar(calendarId)) {
      console.error('Cannot create events in ICS calendars');
      return;
    }
    
    setSelectedEvent(null);
    
    // If a day is provided, set the start time to the clicked time
    if (day) {
      const startTime = new Date(day);
      
      // For all-day events, set to start of day and end at end of day
      // For timed events, set end time to be 1 hour after start time
      const endTime = new Date(startTime);
      if (isAllDay) {
        // For all-day events, set start to beginning of day and end to end of day
        startTime.setHours(0, 0, 0, 0);
        endTime.setDate(endTime.getDate());
        endTime.setHours(23, 59, 59, 999);
      } else {
        endTime.setHours(endTime.getHours() + 1);
      }
      
      // Create a temporary "dummy" event to pass to the form
      const dummyEvent: CalendarEvent = {
        id: 'new', // This ID will never be used, it's just for the temporary object
        title: '',
        description: '',
        calendarId: calendarId ?? fallbackCalendarId,
        startTime: startTime,
        endTime: endTime,
        isAllDay: isAllDay ?? false,
        user_id: '', // Temporary value for dummy event
        createdAt: new Date()
      };
      
      // Set as selected event to prefill the form with these times
      setSelectedEvent(dummyEvent);
    }
    
    setIsDialogOpen(true);
  }, [fallbackCalendarId, isReadOnlyCalendar, setSelectedEvent, setIsDialogOpen]);

  // Handle submit event and close dialog
  const onSubmitEventHandler = useCallback(async (values: EventFormValues) => {
    // Prevent editing ICS events
    if (values.id && isICSEvent({ id: values.id } as CalendarEvent)) {
      console.error('Events from ICS calendars cannot be edited');
      return;
    }
    // Prevent creating events in ICS calendars
    if (isReadOnlyCalendar(values.calendarId)) {
      console.error('Cannot create events in ICS calendars');
      return;
    }
    const success = await onSubmitEvent(values);
    if (success) {
      setSelectedEvent(null);
      setIsDialogOpen(false);
    }
  }, [onSubmitEvent, isICSEvent, isReadOnlyCalendar, setSelectedEvent, setIsDialogOpen]);

  // Handle delete event and close dialog
  const onDeleteEventHandler = useCallback(async (id: string) => {
    // Prevent deleting ICS events
    if (isICSEvent({ id } as CalendarEvent)) {
      console.error('Events from ICS calendars cannot be deleted');
      return;
    }
    const success = await onDeleteEvent(id);
    if (success && selectedEvent?.id === id) {
      setSelectedEvent(null);
      setIsDialogOpen(false);
    }
  }, [onDeleteEvent, selectedEvent, isICSEvent, setSelectedEvent, setIsDialogOpen]);

  // Handle clone event and open edit dialog with cloned event
  const onCloneEventHandler = useCallback(async (eventToClone: CalendarEvent) => {
    // Prevent cloning ICS events
    if (isICSEvent(eventToClone)) {
      console.error('Events from ICS calendars cannot be cloned');
      return;
    }
    const success = await onCloneEvent(eventToClone);
    if (success) {
      // Close the current dialog since the event has been cloned
      setSelectedEvent(null);
      setIsDialogOpen(false);
    }
  }, [onCloneEvent, isICSEvent, setSelectedEvent, setIsDialogOpen]);

  // Callback for deleting a single occurrence
  const onDeleteThisOccurrenceHandler = useCallback(async (event: CalendarEvent) => {
    if (!onDeleteThisOccurrence) return; // Guard if function is not available
    const success = await onDeleteThisOccurrence(event);
    if (success) {
      setSelectedEvent(null);
      setIsDialogOpen(false);
    }
  }, [onDeleteThisOccurrence, setIsDialogOpen, setSelectedEvent]);

  // Callback for deleting this and future occurrences
  const onDeleteThisAndFutureHandler = useCallback(async (event: CalendarEvent) => {
    if (!onDeleteThisAndFuture) return; // Guard if function is not available
    const success = await onDeleteThisAndFuture(event);
    if (success) {
      setSelectedEvent(null);
      setIsDialogOpen(false);
    }
  }, [onDeleteThisAndFuture, setIsDialogOpen, setSelectedEvent]);

  // Callback for deleting all events in a series
  const onDeleteAllInSeriesHandler = useCallback(async (event: CalendarEvent) => {
    // onDeleteEvent from the hook expects an ID.
    const success = await onDeleteEvent(event.id);
    if (success) {
      setSelectedEvent(null);
      setIsDialogOpen(false);
    }
  }, [onDeleteEvent, setIsDialogOpen, setSelectedEvent]);

  // Callbacks for modifying recurring events
  const onModifyThisOccurrenceHandler = useCallback(async (event: CalendarEvent, modifiedData: any) => {
    if (!onModifyThisOccurrence) return;
    const success = await onModifyThisOccurrence(event, modifiedData);
    if (success) {
      setSelectedEvent(null);
      setIsDialogOpen(false);
    }
  }, [onModifyThisOccurrence, setIsDialogOpen, setSelectedEvent]);

  const onModifyThisAndFutureHandler = useCallback(async (event: CalendarEvent, modifiedData: any) => {
    if (!onModifyThisAndFuture) return;
    const success = await onModifyThisAndFuture(event, modifiedData);
    if (success) {
      setSelectedEvent(null);
      setIsDialogOpen(false);
    }
  }, [onModifyThisAndFuture, setIsDialogOpen, setSelectedEvent]);

  const onModifyAllInSeriesHandler = useCallback(async (event: CalendarEvent, modifiedData: any) => {
    if (!onModifyAllInSeries) return;
    const success = await onModifyAllInSeries(event, modifiedData);
    if (success) {
      setSelectedEvent(null);
      setIsDialogOpen(false);
    }
  }, [onModifyAllInSeries, setIsDialogOpen, setSelectedEvent]);

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
    await onEventUpdate(updatedEvent);
  }, [onEventUpdate, onModifyAllInSeries, onModifyThisAndFuture, onModifyThisOccurrence]);

  // Handlers for drag/resize modification choices
  const handleDragModifyThisOccurrence = useCallback(async (event: CalendarEvent) => {
    if (pendingDraggedEvent && onModifyThisOccurrence) {
      const modifiedData = {
        title: pendingDraggedEvent.title,
        description: pendingDraggedEvent.description,
        location: pendingDraggedEvent.location,
        startTime: pendingDraggedEvent.startTime,
        endTime: pendingDraggedEvent.endTime
      };
      await onModifyThisOccurrence(event, modifiedData);
      setPendingDraggedEvent(null);
    }
  }, [pendingDraggedEvent, onModifyThisOccurrence]);

  const handleDragModifyThisAndFuture = useCallback(async (event: CalendarEvent) => {
    if (pendingDraggedEvent && onModifyThisAndFuture) {
      const modifiedData = {
        title: pendingDraggedEvent.title,
        description: pendingDraggedEvent.description,
        location: pendingDraggedEvent.location,
        startTime: pendingDraggedEvent.startTime,
        endTime: pendingDraggedEvent.endTime
      };
      await onModifyThisAndFuture(event, modifiedData);
      setPendingDraggedEvent(null);
    }
  }, [pendingDraggedEvent, onModifyThisAndFuture]);

  const handleDragModifyAllInSeries = useCallback(async (event: CalendarEvent) => {
    if (pendingDraggedEvent && onModifyAllInSeries) {
      const modifiedData = {
        title: pendingDraggedEvent.title,
        description: pendingDraggedEvent.description,
        location: pendingDraggedEvent.location,
        startTime: pendingDraggedEvent.startTime,
        endTime: pendingDraggedEvent.endTime
      };
      await onModifyAllInSeries(event, modifiedData);
      setPendingDraggedEvent(null);
    }
  }, [pendingDraggedEvent, onModifyAllInSeries]);

  const handleDragModificationConfirmed = () => {
    setPendingDraggedEvent(null);
  };

  // Memoized handlers for JSX props to prevent unnecessary re-renders
  const openNewEventDialogHandler = useCallback(() => {
    openNewEventDialog();
  }, [openNewEventDialog]);

  const openNewEventDialogWithDayHandler = useCallback((day: Date, isAllDay?: boolean) => {
    openNewEventDialog(day, isAllDay);
  }, [openNewEventDialog]);

  // Handle today selection from mobile header
  const handleTodaySelected = useCallback(() => {
    setShouldSelectToday(true);
    // Reset the flag after a brief delay to allow the effect to trigger
    setTimeout(() => setShouldSelectToday(false), 100);
  }, [setShouldSelectToday]);

  // Handle date selection from month overview
  const handleDateSelect = useCallback((date: Date) => {
    setSelectedDate(date);
    // Navigate to the week containing the selected date (Monday as start of week)
    const weekStart = startOfWeek(date, { weekStartsOn: 1 });
    setCurrentWeek(weekStart);
  }, [setSelectedDate, setCurrentWeek]);

  // Handle month change from month overview
  const handleMonthChange = useCallback((date: Date) => {
    // Navigate to the first week of the selected month
    const firstDayOfMonth = new Date(date.getFullYear(), date.getMonth(), 1);
    const weekStart = startOfWeek(firstDayOfMonth, { weekStartsOn: 1 });
    setCurrentWeek(weekStart);
    setSelectedDate(firstDayOfMonth);
  }, [setCurrentWeek, setSelectedDate]);

  return (
    <div className={`flex w-full h-full ${className}`}>
      {/* Mobile Layout */}
      <div className="md:hidden w-full flex flex-col h-screen">
        {/* Mobile Header */}
        <div className="border-b p-4 flex-shrink-0">
          <CalendarHeaderMobile 
            currentWeek={currentWeek}
            setCurrentWeek={setCurrentWeek}
            openNewEventDialog={openNewEventDialogHandler}
            calendars={calendars}
            onCalendarToggle={onCalendarToggle}
            onCalendarCreate={onCalendarCreate}
            onICSCalendarCreate={onICSCalendarCreate}
            onICSCalendarRefresh={handleICSCalendarRefreshWrapper}
            onCalendarEdit={onCalendarEdit}
            onCalendarDelete={handleCalendarDeleteWithEvents}
            onSetDefaultCalendar={onSetDefaultCalendar}
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
          {isLoading ? (
            <div className="text-center py-8">{loadingText}</div>
          ) : (
            <CalendarGridMobile 
              days={daysOfWeek}
              events={eventsInCurrentWeek}
              calendars={calendars.map(cal => ({ ...cal, color: cal.color || '#3b82f6' }))}
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
          onCalendarToggle={onCalendarToggle}
          onCalendarCreate={onCalendarCreate}
          onICSCalendarCreate={onICSCalendarCreate}
          onICSCalendarRefresh={handleICSCalendarRefreshWrapper}
          onCalendarEdit={onCalendarEdit}
          onCalendarDelete={handleCalendarDeleteWithEvents}
          onSetDefaultCalendar={onSetDefaultCalendar}
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
          {isLoading ? (
            <div className="text-center py-8">{loadingText}</div>
          ) : (
              <CalendarGrid 
                days={daysOfWeek}
                events={eventsInCurrentWeek}
                calendars={calendars.map(cal => ({ ...cal, color: cal.color || '#3b82f6' }))}
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
        onSubmit={onSubmitEventHandler}
        onDelete={onDeleteEventHandler}
        onClone={onCloneEventHandler}
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
