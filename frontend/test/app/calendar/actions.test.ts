import { fetchCalendarEvents, addCalendarEvent, updateCalendarEvent, deleteCalendarEvent } from '@/app/dashboard/calendar/api';

// Mock the backend interface
jest.mock('@/utils/api/backend-interface', () => {
  return {
    createClient: jest.fn(() => ({
      auth: {
        getUser: jest.fn().mockResolvedValue({
          data: {
            user: { id: 'user-123' }
          },
          error: null
        })
      },
      from: jest.fn(() => ({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            order: jest.fn(() => ({
              data: [
                {
                  id: '1',
                  user_id: 'user-123',
                  encrypted_data: 'encrypted-event-data-1',
                  iv: 'iv-1',
                  salt: 'salt-1',
                  created_at: '2025-05-17T10:00:00Z',
                  updated_at: '2025-05-17T11:00:00Z'
                },
                {
                  id: '2',
                  user_id: 'user-123',
                  encrypted_data: 'encrypted-event-data-2',
                  iv: 'iv-2',
                  salt: 'salt-2',
                  created_at: '2025-05-18T10:00:00Z',
                  updated_at: '2025-05-18T11:00:00Z'
                }
              ],
              error: null
            }))
          }))
        })),
        insert: jest.fn(() => ({
          select: jest.fn(() => ({
            single: jest.fn(() => ({
              data: {
                id: '3',
                user_id: 'user-123',
                encrypted_data: 'encrypted-event-data-3',
                iv: 'test-iv',
                salt: 'test-salt',
                created_at: '2025-05-19T10:00:00Z',
                updated_at: '2025-05-19T10:00:00Z'
              },
              error: null
            }))
          }))
        })),
        update: jest.fn(() => ({
          eq: jest.fn(() => ({
            eq: jest.fn(() => ({
              select: jest.fn(() => ({
                single: jest.fn(() => ({
                  data: {
                    id: '1',
                    user_id: 'user-123',
                    encrypted_data: 'updated-encrypted-data',
                    iv: 'updated-iv',
                    salt: 'updated-salt',
                    created_at: '2025-05-17T10:00:00Z',
                    updated_at: '2025-05-17T12:00:00Z'
                  },
                  error: null
                }))
              }))
            }))
          }))
        })),
        delete: jest.fn(() => ({
          eq: jest.fn(() => ({
            eq: jest.fn(() => ({
              data: null,
              error: null
            }))
          }))
        }))
      }))
    }))
  };
});

describe('Calendar Actions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('fetchCalendarEvents', () => {
    it('should return encrypted calendar events', async () => {
      const events = await fetchCalendarEvents();
      
      expect(events).toHaveLength(2);
      expect(events[0].id).toBe('1');
      expect(events[0].encrypted_data).toBe('encrypted-event-data-1');
      expect(events[0].iv).toBe('iv-1');
      expect(events[0].salt).toBe('salt-1');
      expect(events[1].id).toBe('2');
    });
  });

  describe('addCalendarEvent', () => {
    it('should add a new encrypted calendar event', async () => {
      const encryptedData = 'test-encrypted-data';
      const iv = 'test-iv';
      const salt = 'test-salt';
      
      const result = await addCalendarEvent(encryptedData, iv, salt);
      
      expect(result.id).toBe('3');
      expect(result.encrypted_data).toBe('encrypted-event-data-3');
      expect(result.iv).toBe('test-iv');
      expect(result.salt).toBe('test-salt');
    });
  });

  describe('updateCalendarEvent', () => {
    it('should update an existing calendar event', async () => {
      const id = '1';
      const encryptedData = 'updated-encrypted-data';
      const iv = 'updated-iv';
      const salt = 'updated-salt';
      
      const result = await updateCalendarEvent(id, encryptedData, iv, salt);
      
      expect(result.id).toBe('1');
      expect(result.encrypted_data).toBe('updated-encrypted-data');
      expect(result.iv).toBe('updated-iv');
      expect(result.salt).toBe('updated-salt');
      expect(result.updated_at).toBe('2025-05-17T12:00:00Z');
    });
  });

  describe('deleteCalendarEvent', () => {
    it('should delete a calendar event', async () => {
      const id = '1';
      
      await expect(deleteCalendarEvent(id)).resolves.not.toThrow();
    });
  });
});