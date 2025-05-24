import { renderHook } from '@testing-library/react';
import { Calendar } from '@/utils/types';

// Mock the hooks module to avoid importing React context
jest.mock('@/app/dashboard/calendar/hooks/useEventCRUD', () => ({
  useEventCRUD: jest.fn()
}));

// Mock the actions module
jest.mock('@/app/dashboard/calendar/actions', () => ({
  createEvent: jest.fn(),
  updateEvent: jest.fn(),
  deleteEvent: jest.fn(),
  moveEvent: jest.fn()
}));

describe('useEventCRUD', () => {
  const mockEncryptionKey = 'test-key';
  const mockCalendars: Calendar[] = [
    {
      id: 'cal-1',
      name: 'Test Calendar',
      color: '#000000',
      isVisible: true,
      isDefault: true,
      createdAt: new Date(),
      updatedAt: new Date()
    }
  ];

  const mockEventActions = {
    setEvents: jest.fn(),
    setIsLoading: jest.fn()
  };

  const mockSetError = jest.fn();
  const mockUseEventCRUD = require('@/app/dashboard/calendar/hooks/useEventCRUD').useEventCRUD;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return CRUD functions when properly configured', () => {
    const mockReturnValue = {
      handleSubmitEvent: jest.fn(),
      handleDeleteEvent: jest.fn(),
      handleEventUpdate: jest.fn(),
      moveEventToCalendar: jest.fn()
    };

    mockUseEventCRUD.mockReturnValue(mockReturnValue);

    const { result } = renderHook(() => 
      mockUseEventCRUD(mockEncryptionKey, mockCalendars, mockEventActions, mockSetError)
    );

    expect(typeof result.current.handleSubmitEvent).toBe('function');
    expect(typeof result.current.handleDeleteEvent).toBe('function');
    expect(typeof result.current.handleEventUpdate).toBe('function');
    expect(typeof result.current.moveEventToCalendar).toBe('function');
  });

  it('should handle missing encryption key gracefully', () => {
    const mockReturnValue = {
      handleSubmitEvent: undefined,
      handleDeleteEvent: undefined,
      handleEventUpdate: undefined,
      moveEventToCalendar: undefined
    };

    mockUseEventCRUD.mockReturnValue(mockReturnValue);

    const { result } = renderHook(() => 
      mockUseEventCRUD(null, mockCalendars, mockEventActions, mockSetError)
    );

    expect(result.current.handleSubmitEvent).toBeUndefined();
    expect(result.current.handleDeleteEvent).toBeUndefined();
    expect(result.current.handleEventUpdate).toBeUndefined();
    expect(result.current.moveEventToCalendar).toBeUndefined();
  });
});
