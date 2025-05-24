import { renderHook, act } from '@testing-library/react';
import { useEventState } from '@/app/dashboard/calendar/hooks/useEventState';
import { CalendarEvent } from '@/utils/types';

describe('useEventState', () => {
  const mockEvent: CalendarEvent = {
    id: '1',
    title: 'Test Event',
    startTime: new Date('2025-05-24T10:00:00Z'),
    endTime: new Date('2025-05-24T11:00:00Z'),
    calendarId: 'cal-1',
    description: 'Test Description',
    createdAt: new Date(),
    updatedAt: new Date()
  };

  it('should initialize with empty events array and loading state true', () => {
    const { result } = renderHook(() => useEventState());
    const [events, isLoading] = result.current;

    expect(events).toEqual([]);
    expect(isLoading).toBe(true);
  });

  it('should set events and sort them by start time', () => {
    const { result } = renderHook(() => useEventState());
    const [, , actions] = result.current;

    const events = [
      { ...mockEvent, id: '2', startTime: new Date('2025-05-24T12:00:00Z') },
      { ...mockEvent, id: '1', startTime: new Date('2025-05-24T10:00:00Z') }
    ];

    act(() => {
      actions.setEvents(events);
    });

    const [updatedEvents] = result.current;
    expect(updatedEvents).toHaveLength(2);
    expect(updatedEvents[0].id).toBe('1'); // Earlier time should come first
    expect(updatedEvents[1].id).toBe('2');
  });

  it('should update events using function updater', () => {
    const { result } = renderHook(() => useEventState());
    const [, , actions] = result.current;

    const initialEvent = { ...mockEvent, id: '1', startTime: new Date('2025-05-24T12:00:00Z') };
    
    act(() => {
      actions.setEvents([initialEvent]);
    });

    const newEvent = { ...mockEvent, id: '2', startTime: new Date('2025-05-24T10:00:00Z') };
    
    act(() => {
      actions.setEvents(prev => [...prev, newEvent]);
    });

    const [updatedEvents] = result.current;
    expect(updatedEvents).toHaveLength(2);
    expect(updatedEvents[0].id).toBe('2'); // Earlier time should come first
    expect(updatedEvents[1].id).toBe('1');
  });

  it('should update events by replacing array', () => {
    const { result } = renderHook(() => useEventState());
    const [, , actions] = result.current;

    act(() => {
      actions.setEvents([mockEvent]);
    });

    const updatedEvent = { ...mockEvent, title: 'Updated Event' };
    
    act(() => {
      actions.setEvents([updatedEvent]);
    });

    const [events] = result.current;
    expect(events[0].title).toBe('Updated Event');
  });

  it('should remove event using function updater', () => {
    const { result } = renderHook(() => useEventState());
    const [, , actions] = result.current;

    act(() => {
      actions.setEvents([mockEvent]);
    });

    act(() => {
      actions.setEvents(prev => prev.filter(event => event.id !== '1'));
    });

    const [events] = result.current;
    expect(events).toHaveLength(0);
  });

  it('should set loading state', () => {
    const { result } = renderHook(() => useEventState());
    const [, , actions] = result.current;

    act(() => {
      actions.setIsLoading(false);
    });

    const [, isLoading] = result.current;
    expect(isLoading).toBe(false);
  });
});
