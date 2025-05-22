'use client';

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

import { CalendarHeader } from '@/components/dashboard/calendar-header';
import { CalendarGrid } from '@/components/dashboard/calendar-grid';
import { CalendarEventDialog, EventFormValues } from '@/components/dashboard/calendar-event-dialog';
import { CalendarSidebar } from '@/components/dashboard/calendar/calendar-sidebar';

import { CalendarEvent } from '@/utils/types';
import { useEncryptionKey } from '@/utils/hooks';

// Import our custom hooks
import { useCalendars } from './hooks/useCalendars';
import { useCalendarEvents } from './hooks/useCalendarEvents';
import { useCalendarSubscriptions } from './hooks/useCalendarSubscriptions';
import { getDaysOfWeek, getEventsInWeek } from './utils/calendarHelpers';

export default function CalendarPage() {
  const { encryptionKey, isLoading: isLoadingKey } = useEncryptionKey();
  const [currentWeek, setCurrentWeek] = useState<Date>(new Date());
  const [isDialogOpen, setIsDialogOpen] = useState<boolean>(false);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  
  // Use our custom hooks
  const { 
    calendars, 
    error: calendarError, 
    setError, 
    handleCalendarToggle, 
    handleCalendarCreate, 
    handleCalendarEdit, 
    handleCalendarDelete,
    setCalendarAsDefault,
    loadCalendarsAndSetState
  } = useCalendars(encryptionKey);
  
  const {
    events,
    isLoading: isLoadingEvents,
    error: eventError,
    loadEvents,
    handleSubmitEvent,
    handleDeleteEvent,
    handleEventUpdate,
    moveEventToCalendar
  } = useCalendarEvents(encryptionKey, calendars);

  // Calculate derived data using useMemo to avoid unnecessary recalculations
  const daysOfWeek = useMemo(() => 
    getDaysOfWeek(currentWeek), [currentWeek]
  );
  
  const eventsInCurrentWeek = useMemo(() => 
    getEventsInWeek(events, daysOfWeek[0]), [events, daysOfWeek]
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

  // Subscribe to real-time updates
  useCalendarSubscriptions(
    encryptionKey,
    async () => {
      if (encryptionKey) {
        await loadCalendarsAndSetState(encryptionKey);
      }
    },
    async () => {
      if (encryptionKey) {
        await loadEvents(encryptionKey);
      }
    }
  );
  
  // Function to handle calendar deletion with event moving
  const handleCalendarDeleteWithEvents = async (calendarId: string) => {
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
  };

  // Open dialog for editing an event
  const openEditDialog = (event: CalendarEvent) => {
    setSelectedEvent(event);
    setIsDialogOpen(true);
  };

  // Open dialog for creating a new event
  const openNewEventDialog = (day?: Date, calendarId?: string) => {
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
        calendarId: calendarId ?? (calendars.find(c => c.isDefault)?.id ?? (calendars.length > 0 ? calendars[0].id : '')),
        startTime: startTime,
        endTime: endTime,
        createdAt: new Date()
      };
      
      // Set as selected event to prefill the form with these times
      setSelectedEvent(dummyEvent);
    }
    
    setIsDialogOpen(true);
  };

  // Handle submit event and close dialog
  const onSubmitEvent = async (values: EventFormValues) => {
    const success = await handleSubmitEvent(values);
    if (success) {
      setSelectedEvent(null);
      setIsDialogOpen(false);
    }
  };

  // Handle delete event and close dialog
  const onDeleteEvent = async (id: string) => {
    const success = await handleDeleteEvent(id);
    if (success && selectedEvent?.id === id) {
      setSelectedEvent(null);
      setIsDialogOpen(false);
    }
  };

  // Combine errors
  const error = calendarError ?? eventError;
  
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
      {/* Calendar Sidebar */}
      <CalendarSidebar
        calendars={calendars}
        onCalendarToggle={handleCalendarToggle}
        onCalendarCreate={handleCalendarCreate}
        onCalendarEdit={handleCalendarEdit}
        onCalendarDelete={handleCalendarDeleteWithEvents}
        onSetDefaultCalendar={setCalendarAsDefault}
      />
      
      {/* Main Calendar Content */}
      <div className="flex-1 px-4">
        <CalendarHeader 
          currentWeek={currentWeek}
          setCurrentWeek={setCurrentWeek}
          openNewEventDialog={() => openNewEventDialog()}
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
              openNewEventDialog={(day) => openNewEventDialog(day)}
              onEventUpdate={handleEventUpdate}
            />
        )}
        
        {/* Event dialog */}
        <CalendarEventDialog 
          isOpen={isDialogOpen}
          onOpenChange={setIsDialogOpen}
          selectedEvent={selectedEvent}
          calendars={calendars.filter(cal => cal.isVisible)}
          defaultCalendarId={calendars.find(cal => cal.isDefault)?.id}
          onSubmit={onSubmitEvent}
          onDelete={onDeleteEvent}
        />
      </div>
    </div>
  );
}