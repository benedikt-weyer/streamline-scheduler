/* eslint-disable @typescript-eslint/prefer-destructuring */
import { useState } from 'react';
import { CalendarEvent } from '@/utils/calendar/calendar-types';
import { EventStateActions } from './types/eventHooks';
import { sortEventsByStartTime } from '../../utils/calendar/eventDataProcessing';

/**
 * Hook for managing event state
 */
export const useEventState = (): [CalendarEvent[], boolean, EventStateActions] => {
  const [events, setEventsInternal] = useState<CalendarEvent[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const setEvents = (eventsOrUpdater: CalendarEvent[] | ((prev: CalendarEvent[]) => CalendarEvent[])) => {
    setEventsInternal(prevEvents => {
      const newEvents = typeof eventsOrUpdater === 'function' 
        ? eventsOrUpdater(prevEvents) 
        : eventsOrUpdater;
      
      return sortEventsByStartTime(newEvents);
    });
  };

  const actions: EventStateActions = {
    setEvents,
    setIsLoading
  };

  return [events, isLoading, actions];
};
