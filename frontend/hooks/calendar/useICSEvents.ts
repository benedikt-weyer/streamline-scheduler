import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Calendar, CalendarEvent, CalendarType } from '@/utils/calendar/calendar-types';
import { fetchAndParseICSCalendar } from '@/utils/calendar/ics-parser';
import { useError } from '@/utils/context/ErrorContext';

export function useICSEvents(calendars: Calendar[]) {
  const [icsEvents, setICSEvents] = useState<CalendarEvent[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { setError } = useError();

  // Get ICS calendars only - use useMemo to prevent recreation
  const icsCalendars = useMemo(() => 
    calendars.filter(calendar => calendar.type === CalendarType.ICS), 
    [calendars]
  );

  // Fetch ICS events for a specific calendar
  const fetchICSEventsForCalendar = useCallback(async (calendar: Calendar) => {
    if (!calendar.icsUrl) return [];
    
    try {
      const events = await fetchAndParseICSCalendar(calendar.icsUrl, calendar.id);
      // Attach the full calendar object to each event for proper color rendering
      return events.map(event => ({
        ...event,
        calendar: calendar,
        calendarId: calendar.id
      }));
    } catch (error) {
      console.error(`Error fetching ICS events for calendar ${calendar.name}:`, error);
      setError(`Failed to fetch events for calendar: ${calendar.name}`);
      return [];
    }
  }, [setError]);

  // Fetch all ICS events
  const fetchAllICSEvents = useCallback(async () => {
    if (icsCalendars.length === 0) {
      setICSEvents([]);
      return;
    }

    setIsLoading(true);
    try {
      const allEvents: CalendarEvent[] = [];
      
      // Fetch events for each ICS calendar
      for (const calendar of icsCalendars) {
        const events = await fetchICSEventsForCalendar(calendar);
        allEvents.push(...events);
      }
      
      setICSEvents(allEvents);
    } catch (error) {
      console.error('Error fetching all ICS events:', error);
      setError('Failed to fetch ICS calendar events');
    } finally {
      setIsLoading(false);
    }
  }, [icsCalendars, fetchICSEventsForCalendar, setError]);

  // Refresh ICS events for a specific calendar
  const refreshICSCalendar = useCallback(async (calendarId: string) => {
    const calendar = calendars.find(cal => cal.id === calendarId && cal.type === CalendarType.ICS);
    if (!calendar) return;

    try {
      const events = await fetchICSEventsForCalendar(calendar);
      
      // Update state by removing old events for this calendar and adding new ones
      setICSEvents(prevEvents => [
        ...prevEvents.filter(event => event.calendarId !== calendarId),
        ...events
      ]);
    } catch (error) {
      console.error(`Error refreshing ICS calendar ${calendar.name}:`, error);
      setError(`Failed to refresh calendar: ${calendar.name}`);
    }
  }, [calendars, fetchICSEventsForCalendar, setError]);

  // Create a stable reference to avoid infinite loops
  const fetchAllICSEventsRef = useRef<() => Promise<void>>(async () => {});

  // Update the ref whenever the function changes
  useEffect(() => {
    fetchAllICSEventsRef.current = fetchAllICSEvents;
  });

  // Load ICS events when ICS calendars change
  useEffect(() => {
    if (icsCalendars.length > 0) {
      fetchAllICSEventsRef.current?.();
    } else {
      setICSEvents([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [icsCalendars]);

  // Helper to check if an event is from an ICS calendar
  const isICSEvent = useCallback((event: CalendarEvent) => {
    return event.id.startsWith('ics-');
  }, []);

  // Helper to check if a calendar is read-only (ICS calendars are read-only)
  const isReadOnlyCalendar = useCallback((calendarId: string) => {
    const calendar = calendars.find(cal => cal.id === calendarId);
    return calendar?.type === CalendarType.ICS;
  }, [calendars]);

  return {
    icsEvents,
    isLoading,
    fetchAllICSEvents,
    refreshICSCalendar,
    isICSEvent,
    isReadOnlyCalendar
  };
} 