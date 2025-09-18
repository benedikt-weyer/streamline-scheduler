import { Calendar } from '@/utils/calendar/calendar-types';
import { CalendarEventsHook } from './types/eventHooks';
import { useEventState } from './useEventState';
import { useEventLoader } from './useEventLoader';
import { useEventCRUD } from './useEventCRUD';
import { useRecurrenceEventActions } from './useRecurrenceEventActions';
import { useEventCalendarSync } from './useEventCalendarSync';

/**
 * Main orchestrating hook for calendar events
 * Coordinates all event-related operations through smaller, focused hooks
 */
export function useCalendarEvents(
  calendars: Calendar[], 
  skipNextEventReload?: () => void
): CalendarEventsHook {
  // Initialize event state management
  const [events, isLoading, eventActions] = useEventState();

  // Initialize specialized hooks
  const { loadEvents, loadEventsWithCalendars } = useEventLoader(calendars, eventActions);
  
  const { handleSubmitEvent, handleDeleteEvent, handleCloneEvent, moveEventToCalendar } = useEventCRUD(
    events, 
    calendars, 
    eventActions, 
    skipNextEventReload
  );
  
  const { 
    handleDeleteThisOccurrence, 
    handleDeleteThisAndFuture, 
    handleEventUpdate,
    handleModifyThisOccurrence,
    handleModifyThisAndFuture,
    handleModifyAllInSeries
  } = useRecurrenceEventActions(
    events, 
    eventActions, 
    skipNextEventReload
  );

  // Synchronize event calendar details with the main calendars list
  useEventCalendarSync(events, calendars, eventActions);

  return {
    events,
    isLoading,
    loadEvents,
    loadEventsWithCalendars,
    handleSubmitEvent,
    handleDeleteEvent,
    handleCloneEvent,
    handleDeleteThisOccurrence,
    handleDeleteThisAndFuture,
    handleEventUpdate,
    moveEventToCalendar,
    handleModifyThisOccurrence,
    handleModifyThisAndFuture,
    handleModifyAllInSeries
  };
}
