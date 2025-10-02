'use client';

import { useEffect, useCallback, useState } from 'react';

import { CalendarFullControlCrossPlatform } from '@/components/dashboard/calendar/calendar-full-control-cross-platform';

import { ErrorProvider, useError } from '@/utils/context/ErrorContext';
import { Calendar, CalendarEvent } from '@/utils/calendar/calendar-types';

// Import services
import { CalendarService } from '@/services/calendar/calendar-service';
import { CalendarEventsService } from '@/services/calendar-events/calendar-events-service';
import { CalendarPageService } from './calendar-page-service';
import { EventFormValues } from '@/components/dashboard/calendar/calendar-event-dialog';
import { getDecryptedBackend } from '@/utils/api/decrypted-backend';


function CalendarContent() {
  const { error, setError } = useError();


  const [calendars, setCalendars] = useState<Calendar[]>([]);
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);
  const [icsEvents, setIcsEvents] = useState<CalendarEvent[]>([]);
  const [isLoadingEvents, setIsLoadingEvents] = useState(false);
  const [isLoadingICSEvents, setIsLoadingICSEvents] = useState(false);

  // Initialize services with backend (only in browser)
  const [calendarPageService] = useState(() => {
    if (typeof window !== 'undefined') {
      return new CalendarPageService(getDecryptedBackend());
    }
    return null;
  });

  
  // Load data when component mounts
  useEffect(() => {
    const loadData = async () => {
      if (!calendarPageService) {
        console.error('Calendar page service not initialized');
        return;
      }

      try {
        setIsLoadingEvents(true);
        setIsLoadingICSEvents(true);
        
        // Load all calendar and event data together
        const { calendars, events } = await calendarPageService!.loadCalendarData();
        setCalendars(calendars);
        setCalendarEvents(events);
        
        // Load ICS events using calendar page service
        const icsEventsData = await calendarPageService!.fetchAllICSEvents(calendars);
        setIcsEvents(icsEventsData);
        } catch (error) {
          console.error('Error loading calendar data:', error);
          setError('Failed to load calendar data');
      } finally {
        setIsLoadingEvents(false);
        setIsLoadingICSEvents(false);
      }
    };
    
    loadData();
  }, [calendarPageService, setError]);

  // Calendar handlers
  const handleCalendarToggle = useCallback(async (calendarId: string, isVisible: boolean): Promise<void> => {
    if (!calendarPageService) return;
    
    try {
      const updatedCalendar = await calendarPageService!.toggleCalendarVisibility(calendarId, isVisible);
      setCalendars(prev => prev.map(cal => 
        cal.id === calendarId 
          ? { ...cal, ...updatedCalendar } // Merge the update with existing calendar data
          : cal
      ));
    } catch (error) {
      console.error('Failed to toggle calendar visibility:', error);
      setError('Failed to update calendar visibility');
    }
  }, [calendarPageService, setError]);

  const handleCalendarCreate = useCallback(async (name: string, color: string): Promise<Calendar> => {
    try {
      const { calendar, shouldRefreshEvents } = await calendarPageService!.createCalendar(name, color);
      setCalendars(prev => [...prev, calendar]);
      
      if (shouldRefreshEvents) {
        const { events } = await calendarPageService!.loadCalendarData();
        setCalendarEvents(events);
      }
      
      return calendar;
    } catch (error) {
      console.error('Failed to create calendar:', error);
      setError('Failed to create calendar');
      throw error;
    }
  }, [calendars, setError]);

  const handleICSCalendarCreate = useCallback(async (name: string, color: string, icsUrl: string): Promise<Calendar> => {
    try {
      const { calendar, shouldRefreshEvents } = await calendarPageService!.createICSCalendar(name, color, icsUrl);
      setCalendars(prev => [...prev, calendar]);
      
      if (shouldRefreshEvents) {
        setIsLoadingICSEvents(true);
        const icsEventsData = await calendarPageService!.fetchICSEventsForCalendar(calendar);
        setIcsEvents(prev => [...prev, ...icsEventsData]);
        setIsLoadingICSEvents(false);
      }
      
      return calendar;
    } catch (error) {
      console.error('Failed to create ICS calendar:', error);
      setError('Failed to create ICS calendar');
      throw error;
    }
  }, [setError]);

  const handleICSCalendarRefresh = useCallback(async (calendarId: string): Promise<void> => {
    try {
      setIsLoadingICSEvents(true);
      const { events, calendar } = await calendarPageService!.refreshICSEventsForCalendar(calendarId, calendars);
      setCalendars(prev => prev.map(cal => cal.id === calendarId ? calendar : cal));
      
      // Update ICS events for this calendar
      setIcsEvents(prev => prev.filter(event => event.calendar_id !== calendarId).concat(events));
    } catch (error) {
      console.error('Failed to refresh ICS calendar:', error);
      setError('Failed to refresh ICS calendar');
    } finally {
      setIsLoadingICSEvents(false);
    }
  }, [calendars, setError]);

  const handleCalendarEdit = useCallback(async (id: string, name: string, color: string): Promise<void> => {
    try {
      const updatedCalendar = await calendarPageService!.editCalendar(id, name, color);
      setCalendars(prev => prev.map(cal => 
        cal.id === id 
          ? { ...cal, ...updatedCalendar } // Merge the update with existing calendar data
          : cal
      ));
    } catch (error) {
      console.error('Failed to edit calendar:', error);
      setError('Failed to edit calendar');
    }
  }, [setError]);

  const handleCalendarDeleteWithEvents = useCallback(async (calendarId: string): Promise<string | undefined> => {
    try {
      const targetCalendarId = await calendarPageService!.deleteCalendarWithEvents(
        calendarId,
        async (eventId: string, targetCalId: string) => {
          // Update local state when moving events
          setCalendarEvents(prev => prev.map(event => 
            event.id === eventId ? { ...event, calendar_id: targetCalId } : event
          ));
        }
      );
      
      // Remove calendar from state
      setCalendars(prev => prev.filter(cal => cal.id !== calendarId));
      
      // Remove events for deleted calendar and refresh events from target calendar
      if (targetCalendarId) {
        const { events: updatedEvents } = await calendarPageService!.loadCalendarData();
        setCalendarEvents(updatedEvents);
      }
      
      return targetCalendarId;
    } catch (error) {
      console.error('Failed to delete calendar with events:', error);
      setError('Failed to delete calendar');
      return undefined;
    }
  }, [calendars, setError]);

  const setCalendarAsDefault = useCallback(async (calendarId: string): Promise<void> => {
    try {
      await calendarPageService!.setDefaultCalendar(calendarId);
      // Update all calendars - unset previous default and set new one
      setCalendars(prev => prev.map(cal => ({
        ...cal,
        is_default: cal.id === calendarId
      })));
    } catch (error) {
      console.error('Failed to set default calendar:', error);
      setError('Failed to set default calendar');
    }
  }, [setError]);

  // Event handlers
  const handleSubmitEvent = useCallback(async (values: EventFormValues): Promise<boolean> => {
    try {
      const { event, isUpdate } = await calendarPageService!.submitEvent(values);
      
      if (isUpdate) {
        setCalendarEvents(prev => prev.map(e => e.id === event.id ? event : e));
      } else {
        setCalendarEvents(prev => [...prev, event]);
      }
      return true;
    } catch (error) {
      console.error('Failed to submit event:', error);
      setError('Failed to save event');
      return false;
    }
  }, [setError]);

  const handleDeleteEvent = useCallback(async (eventId: string): Promise<boolean> => {
    try {
      await calendarPageService!.deleteEvent(eventId);
      setCalendarEvents(prev => prev.filter(event => event.id !== eventId));
      return true;
    } catch (error) {
      console.error('Failed to delete event:', error);
      setError('Failed to delete event');
      return false;
    }
  }, [setError]);

  const handleCloneEvent = useCallback(async (event: CalendarEvent): Promise<boolean> => {
    try {
      const clonedEvent = await calendarPageService!.cloneEvent(event);
      setCalendarEvents(prev => [...prev, clonedEvent]);
      return true;
    } catch (error) {
      console.error('Failed to clone event:', error);
      setError('Failed to clone event');
      return false;
    }
  }, [setError]);

  const handleEventUpdate = useCallback(async (updatedEvent: CalendarEvent): Promise<boolean> => {
    try {
      const eventWithUpdates = await calendarPageService!.updateEvent(updatedEvent.id, {
        title: updatedEvent.title,
        description: updatedEvent.description,
        location: updatedEvent.location,
        startTime: updatedEvent.start_time ? new Date(updatedEvent.start_time) : undefined,
        endTime: updatedEvent.end_time ? new Date(updatedEvent.end_time) : undefined,
        isAllDay: updatedEvent.all_day,
        calendarId: updatedEvent.calendar_id,
      });
      setCalendarEvents(prev => prev.map(event => event.id === updatedEvent.id ? eventWithUpdates : event));
      return true;
    } catch (error) {
      console.error('Failed to update event:', error);
      setError('Failed to update event');
      return false;
    }
  }, [setError]);

  const moveEventToCalendar = useCallback(async (eventId: string, targetCalendarId: string): Promise<void> => {
    try {
      const updatedEvent = await calendarPageService!.moveEventToCalendar(eventId, targetCalendarId);
      setCalendarEvents(prev => prev.map(event => event.id === eventId ? updatedEvent : event));
    } catch (error) {
      console.error('Failed to move event:', error);
      setError('Failed to move event');
    }
  }, [setError]);

  // Recurrence handlers (placeholder implementations - would need proper recurrence logic)
  const handleDeleteThisOccurrence = useCallback(async (event: CalendarEvent): Promise<boolean> => {
    if (!calendarPageService) return false;
    
    try {
      const result = await calendarPageService.calendarEventsService.deleteThisOccurrence(event, calendarEvents);
      if (result.success && result.updatedEvents) {
        setCalendarEvents(result.updatedEvents);
        return true;
      } else {
        setError(result.error || 'Failed to delete occurrence');
        return false;
      }
    } catch (error) {
      console.error('Failed to delete occurrence:', error);
      setError('Failed to delete occurrence');
      return false;
    }
  }, [calendarPageService, calendarEvents, setError]);

  const handleDeleteThisAndFuture = useCallback(async (event: CalendarEvent): Promise<boolean> => {
    if (!calendarPageService) return false;
    
    try {
      const result = await calendarPageService.calendarEventsService.deleteThisAndFuture(event, calendarEvents);
      if (result.success && result.updatedEvents) {
        setCalendarEvents(result.updatedEvents);
        return true;
      } else {
        setError(result.error || 'Failed to delete this and future');
        return false;
      }
    } catch (error) {
      console.error('Failed to delete this and future:', error);
      setError('Failed to delete occurrences');
      return false;
    }
  }, [calendarPageService, calendarEvents, setError]);

  const handleModifyThisOccurrence = useCallback(async (event: CalendarEvent, modifiedData: any): Promise<boolean> => {
    if (!calendarPageService) return false;
    
    try {
      const result = await calendarPageService.calendarEventsService.modifyThisOccurrence(event, modifiedData, calendarEvents);
      if (result.success && result.updatedEvents) {
        setCalendarEvents(result.updatedEvents);
        return true;
      } else {
        setError(result.error || 'Failed to modify occurrence');
        return false;
      }
    } catch (error) {
      console.error('Failed to modify occurrence:', error);
      setError('Failed to modify occurrence');
      return false;
    }
  }, [calendarPageService, calendarEvents, setError]);

  const handleModifyThisAndFuture = useCallback(async (event: CalendarEvent, modifiedData: any): Promise<boolean> => {
    if (!calendarPageService) return false;
    
    try {
      const result = await calendarPageService.calendarEventsService.modifyThisAndFuture(event, modifiedData, calendarEvents);
      if (result.success && result.updatedEvents) {
        setCalendarEvents(result.updatedEvents);
        return true;
      } else {
        setError(result.error || 'Failed to modify this and future');
        return false;
      }
    } catch (error) {
      console.error('Failed to modify this and future:', error);
      setError('Failed to modify occurrences');
      return false;
    }
  }, [calendarPageService, calendarEvents, setError]);

  const handleModifyAllInSeries = useCallback(async (event: CalendarEvent, modifiedData: any): Promise<boolean> => {
    if (!calendarPageService) return false;
    
    try {
      const result = await calendarPageService.calendarEventsService.modifyAllInSeries(event, modifiedData, calendarEvents);
      if (result.success && result.updatedEvents) {
        setCalendarEvents(result.updatedEvents);
        return true;
      } else {
        setError(result.error || 'Failed to modify all in series');
        return false;
      }
    } catch (error) {
      console.error('Failed to modify series:', error);
      setError('Failed to modify event series');
      return false;
    }
  }, [calendarPageService, calendarEvents, setError]);

  // ICS helpers
  const isICSEvent = useCallback((event: CalendarEvent): boolean => {
    return calendarPageService!.isICSEvent(event);
  }, []);

  const isReadOnlyCalendar = useCallback((calendarId: string): boolean => {
    return calendarPageService!.isReadOnlyCalendar(calendarId, calendars);
  }, [calendars]);

  const refreshICSCalendar = useCallback(async (calendarId: string): Promise<void> => {
    return handleICSCalendarRefresh(calendarId);
  }, [handleICSCalendarRefresh]);


  return (
    <CalendarFullControlCrossPlatform
      // Data
            calendars={calendars}
      events={calendarEvents}
      icsEvents={icsEvents}
      isLoading={isLoadingEvents}
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
    <div className="fixed top-16 left-0 right-0 bottom-0 overflow-hidden">
      <ErrorProvider>
        <CalendarContent />
      </ErrorProvider>
    </div>
  );
}