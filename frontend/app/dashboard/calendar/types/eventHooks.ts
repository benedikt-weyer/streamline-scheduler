import { CalendarEvent, EventFormValues, Calendar } from '@/utils/calendar/calendar-types';

export interface EventState {
  events: CalendarEvent[];
  isLoading: boolean;
}

export interface EventStateActions {
  setEvents: (events: CalendarEvent[] | ((prev: CalendarEvent[]) => CalendarEvent[])) => void;
  setIsLoading: (loading: boolean) => void;
}

export interface EventLoaderHook {
  loadEvents: (key: string) => Promise<CalendarEvent[]>;
  loadEventsWithCalendars: (key: string, encryptedEvents?: any[]) => Promise<CalendarEvent[]>;
}

export interface EventCRUDHook {
  handleSubmitEvent: (values: EventFormValues) => Promise<boolean>;
  handleDeleteEvent: (id: string) => Promise<boolean>;
  moveEventToCalendar: (eventId: string, targetCalendarId: string) => Promise<void>;
}

export interface RecurrenceEventActionsHook {
  handleDeleteThisOccurrence: (eventToDelete: CalendarEvent) => Promise<boolean>;
  handleDeleteThisAndFuture: (eventToDelete: CalendarEvent) => Promise<boolean>;
  handleEventUpdate: (updatedEvent: CalendarEvent) => Promise<boolean>;
}

export interface EventCalendarSyncHook {
  syncEventsWithCalendars: () => void;
}

export interface CalendarEventsHook extends EventState, EventCRUDHook, RecurrenceEventActionsHook {
  loadEvents: (key: string) => Promise<CalendarEvent[]>;
  loadEventsWithCalendars: (key: string, encryptedEvents?: any[]) => Promise<CalendarEvent[]>;
  moveEventToCalendar: (eventId: string, targetCalendarId: string) => Promise<void>;
}
