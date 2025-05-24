import { useEffect } from 'react';
import { CalendarEvent, Calendar } from '@/utils/types';
import { EventStateActions } from '../types/eventHooks';
import { isValid } from 'date-fns';

/**
 * Hook for synchronizing event calendar details with the main calendars list
 */
export const useEventCalendarSync = (
  events: CalendarEvent[],
  calendars: Calendar[],
  eventActions: EventStateActions
) => {
  useEffect(() => {
    if (events.length > 0 && calendars.length > 0) {
      let hasChanges = false;

      const newEvents = events.map(event => {
        const foundCalendar = calendars.find(c => c.id === event.calendarId);
        
        if (foundCalendar) {
          // Normalize foundCalendar for consistent comparison and usage
          const normalizedCorrespondingCalendar = {
            id: foundCalendar.id,
            name: foundCalendar.name,
            color: foundCalendar.color,
            isVisible: foundCalendar.isVisible,
            isDefault: foundCalendar.isDefault ?? false,
            createdAt: foundCalendar.createdAt,
            updatedAt: foundCalendar.updatedAt
          };

          // Normalize event.calendar for consistent comparison (if it exists)
          const normalizedEventCalendar = event.calendar ? {
            id: event.calendar.id,
            name: event.calendar.name,
            color: event.calendar.color,
            isVisible: event.calendar.isVisible,
            isDefault: event.calendar.isDefault ?? false,
            createdAt: event.calendar.createdAt,
            updatedAt: event.calendar.updatedAt
          } : undefined;

          if (!normalizedEventCalendar || 
              normalizedEventCalendar.id !== normalizedCorrespondingCalendar.id ||
              normalizedEventCalendar.name !== normalizedCorrespondingCalendar.name ||
              normalizedEventCalendar.color !== normalizedCorrespondingCalendar.color ||
              normalizedEventCalendar.isVisible !== normalizedCorrespondingCalendar.isVisible ||
              normalizedEventCalendar.isDefault !== normalizedCorrespondingCalendar.isDefault
             ) {
            hasChanges = true;
            return { ...event, calendar: normalizedCorrespondingCalendar }; 
          }
        } else if (event.calendar) {
          hasChanges = true;
          return { ...event, calendar: undefined };
        }
        return event;
      });

      if (hasChanges) {
        eventActions.setEvents(newEvents.filter(event => isValid(event.startTime)));
      }
    }
  }, [events, calendars, eventActions]);
};
