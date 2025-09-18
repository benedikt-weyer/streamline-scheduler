'use client';

import { useState, useCallback, useMemo } from 'react';
import { CalendarEvent, Calendar } from '@/utils/calendar/calendar-types';
import { CalendarHeader } from '@/components/dashboard/calendar/calendar-header';
import { SchedulerCalendarGrid } from './scheduler-calendar-grid';
import { CalendarEventDialog, EventFormValues } from '@/components/dashboard/calendar/calendar-event-dialog';
import { CalendarSidebar } from '@/components/dashboard/calendar/calendar-sidebar';
import { getDaysOfWeek, getEventsInWeek } from '@/utils/calendar/calendarHelpers';
// import { useDroppable } from '@dnd-kit/core'; // No longer needed
import { addMinutes, format } from 'date-fns';

interface SchedulerCalendarProps {
  readonly events: CalendarEvent[];
  readonly calendars: Calendar[];
  readonly onEventUpdate: (updatedEvent: CalendarEvent) => void;
  readonly onCalendarToggle: (calendarId: string, isVisible: boolean) => void;
  readonly onCalendarCreate: (name: string, color: string) => void;
  readonly onICSCalendarCreate: (name: string, color: string, icsUrl: string) => void;
  readonly onICSCalendarRefresh: (calendarId: string) => void;
  readonly onCalendarEdit: (calendarId: string, name: string, color: string) => void;
  readonly onCalendarDelete: (calendarId: string) => Promise<string | undefined>;
  readonly onSetDefaultCalendar: (calendarId: string) => void;
  readonly onClone?: (event: CalendarEvent) => Promise<boolean>;
  readonly isLoading: boolean;
  readonly activeTask?: { id: string; content: string; estimatedDuration?: number } | null;
}

export function SchedulerCalendar({
  events,
  calendars,
  onEventUpdate,
  onCalendarToggle,
  onCalendarCreate,
  onICSCalendarCreate,
  onICSCalendarRefresh,
  onCalendarEdit,
  onCalendarDelete,
  onSetDefaultCalendar,
  onClone,
  isLoading,
  activeTask
}: SchedulerCalendarProps) {
  const [currentWeek, setCurrentWeek] = useState<Date>(new Date());
  const [isDialogOpen, setIsDialogOpen] = useState<boolean>(false);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);

  // No longer need a single drop zone since we have individual time slot drop zones

  // Calculate derived data using useMemo to avoid unnecessary recalculations
  const daysOfWeek = useMemo(() => 
    getDaysOfWeek(currentWeek), [currentWeek]
  );
  
  // First filter events by visible calendars, then get events for current week
  const visibleEvents = useMemo(() => 
    events.filter(event => 
      // Only include events from visible calendars
      calendars.find(cal => cal.id === event.calendar_id)?.is_visible ?? false
    ), [events, calendars]
  );
  
  const eventsInCurrentWeek = useMemo(() => 
    getEventsInWeek(visibleEvents, daysOfWeek[0]), [visibleEvents, daysOfWeek]
  );

  // Memoize filtered visible calendars to avoid recalculating on each render
  const visibleCalendars = useMemo(() => 
    calendars.filter(cal => cal.is_visible), [calendars]
  );

  // Memoize default calendar ID lookup
  const defaultCalendarId = useMemo(() => 
    calendars.find(cal => cal.is_default)?.id, [calendars]
  );

  // Memoize fallback calendar ID for new events
  const fallbackCalendarId = useMemo(() => 
    defaultCalendarId ?? (calendars.length > 0 ? calendars[0].id : ''), 
    [defaultCalendarId, calendars]
  );

  // Open dialog for editing an event
  const openEditDialog = useCallback((event: CalendarEvent) => {
    setSelectedEvent(event);
    setIsDialogOpen(true);
  }, []);

  // Open dialog for creating a new event
  const openNewEventDialog = useCallback((day?: Date, isAllDay?: boolean, calendarId?: string) => {
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
  }, [fallbackCalendarId]);

  const handleSubmitEvent = useCallback(async (values: EventFormValues) => {
    // This would normally submit the event, but for now we'll just close the dialog
    setIsDialogOpen(false);
    setSelectedEvent(null);
  }, []);

  const handleDeleteEvent = useCallback(async (id: string) => {
    console.log('Deleting event:', id);
  }, []);

  const handleCloneEvent = useCallback(async (event: CalendarEvent) => {
    if (onClone) {
      await onClone(event);
    }
  }, [onClone]);

  const handleCalendarDeleteWithEvents = useCallback(async (calendarId: string) => {
    try {
      const targetCalendarId = await onCalendarDelete(calendarId);
      return targetCalendarId;
    } catch (error) {
      console.error('Error in handleCalendarDeleteWithEvents:', error);
    }
  }, [onCalendarDelete]);

  if (isLoading) {
    return (
      <div className="flex h-full">
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-gray-900 mx-auto mb-4"></div>
            <p>Loading calendar...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full">
      {/* Calendar Sidebar */}
      <CalendarSidebar
        calendars={calendars}
        onCalendarToggle={onCalendarToggle}
        onCalendarCreate={onCalendarCreate}
        onICSCalendarCreate={onICSCalendarCreate}
        onICSCalendarRefresh={onICSCalendarRefresh}
        onCalendarEdit={onCalendarEdit}
        onCalendarDelete={handleCalendarDeleteWithEvents}
        onSetDefaultCalendar={onSetDefaultCalendar}
        selectedDate={currentWeek}
        currentWeek={currentWeek}
        onDateSelect={(date) => setCurrentWeek(date)}
        onMonthChange={(date) => setCurrentWeek(date)}
      />

      {/* Main Calendar Area */}
      <div className="flex-1 flex flex-col overflow-hidden px-4">
        {/* Calendar Header */}
        <CalendarHeader
          currentWeek={currentWeek}
          setCurrentWeek={setCurrentWeek}
          openNewEventDialog={() => openNewEventDialog()}
        />

        {/* Calendar Grid */}
        
          <SchedulerCalendarGrid
            days={daysOfWeek}
            events={eventsInCurrentWeek}
            calendars={visibleCalendars}
            openEditDialog={openEditDialog}
            openNewEventDialog={openNewEventDialog}
            onEventUpdate={onEventUpdate}
            activeTask={activeTask}
          />
        
      </div>

      {/* Event Dialog */}
      <CalendarEventDialog
        isOpen={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        selectedEvent={selectedEvent}
        calendars={calendars}
        defaultCalendarId={fallbackCalendarId}
        onSubmit={handleSubmitEvent}
        onDelete={handleDeleteEvent}
        onClone={handleCloneEvent}
      />
    </div>
  );
} 