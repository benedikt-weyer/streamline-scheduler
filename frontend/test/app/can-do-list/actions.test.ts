import { fetchCanDoItems, addCanDoItem, updateCanDoItem, deleteCanDoItem } from '@/app/dashboard/can-do-list/actions';
import { getBackend } from '@/utils/api/backend-interface';

// Mock the backend interface
jest.mock('@/utils/api/backend-interface', () => ({
  getBackend: jest.fn(),
}));

// Mock the Next.js cache function
jest.mock('next/cache', () => ({
  revalidatePath: jest.fn(),
}));

describe('Can-Do List Server Actions', () => {
  // Updated mock structure to better match real Supabase client behavior
  const mockSupabase: {
    from: jest.Mock;
    select: jest.Mock;
    insert: jest.Mock;
    update: jest.Mock;
    delete: jest.Mock;
    eq: jest.Mock;
    order: jest.Mock;
    single: jest.Mock;
    auth: {
      getUser: jest.Mock;
    };
    [key: string]: any;
  } = {
    from: jest.fn(() => mockSupabase),
    select: jest.fn(() => mockSupabase),
    insert: jest.fn(() => mockSupabase),
    update: jest.fn(() => mockSupabase),
    delete: jest.fn(() => mockSupabase),
    eq: jest.fn(() => mockSupabase),
    order: jest.fn(() => mockSupabase),
    single: jest.fn(() => mockSupabase),
    auth: {
      getUser: jest.fn(),
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (createClientServer as jest.Mock).mockResolvedValue(mockSupabase);
    // Setup default auth mock to return a test user
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: { id: 'user-1' } },
      error: null,
    });
  });

  describe('fetchCanDoItems', () => {
    it('should fetch encrypted items from the database', async () => {
      const mockItems = [
        {
          id: '1',
          user_id: 'user-1',
          encrypted_data: 'encryptedData1',
          iv: 'iv1',
          salt: 'salt1',
          created_at: '2023-01-01T12:00:00Z',
          updated_at: '2023-01-01T12:00:00Z',
        },
        {
          id: '2',
          user_id: 'user-1',
          encrypted_data: 'encryptedData2',
          iv: 'iv2',
          salt: 'salt2',
          created_at: '2023-01-02T12:00:00Z',
          updated_at: '2023-01-02T12:00:00Z',
        },
      ];

      // Setup mock implementation
      mockSupabase.order.mockResolvedValue({
        data: mockItems,
        error: null,
      });

      const result = await fetchCanDoItems();

      expect(mockSupabase.from).toHaveBeenCalledWith('can_do_list');
      expect(mockSupabase.select).toHaveBeenCalled();
      expect(mockSupabase.order).toHaveBeenCalledWith('created_at', { ascending: false });
      expect(result).toEqual(mockItems);
    });

    it('should throw an error if the fetch fails', async () => {
      mockSupabase.order.mockResolvedValue({
        data: null,
        error: { message: 'Database error' },
      });

      await expect(fetchCanDoItems(true)).rejects.toThrow('Failed to fetch can-do items: Database error');
    });
  });

  describe('addCanDoItem', () => {
    it('should add an encrypted item to the database', async () => {
      const encryptedData = 'encryptedData';
      const iv = 'iv';
      const salt = 'salt';
      
      const mockNewItem = {
        id: '1',
        user_id: 'user-1',
        encrypted_data: encryptedData,
        iv,
        salt,
        created_at: '2023-01-01T12:00:00Z',
        updated_at: '2023-01-01T12:00:00Z',
      };

      // Setup mock implementation
      mockSupabase.single.mockResolvedValue({
        data: mockNewItem,
        error: null,
      });

      const result = await addCanDoItem(encryptedData, iv, salt);

      expect(mockSupabase.from).toHaveBeenCalledWith('can_do_list');
      expect(mockSupabase.insert).toHaveBeenCalledWith({
        user_id: 'user-1',
        encrypted_data: encryptedData,
        iv,
        salt
      });
      expect(mockSupabase.select).toHaveBeenCalled();
      expect(mockSupabase.single).toHaveBeenCalled();
      expect(result).toEqual(mockNewItem);
    });

    it('should throw an error if the insert fails', async () => {
      mockSupabase.single.mockResolvedValue({
        data: null,
        error: { message: 'Insert error' },
      });

      await expect(addCanDoItem('data', 'iv', 'salt', true)).rejects.toThrow('Failed to add can-do item: Insert error');
    });

    it('should throw an error if user is not authenticated', async () => {
      // Mock unauthenticated user
      mockSupabase.auth.getUser.mockResolvedValueOnce({
        data: { user: null },
        error: null,
      });

      await expect(addCanDoItem('data', 'iv', 'salt')).rejects.toThrow('User must be authenticated to add items');
    });
  });

  describe('updateCanDoItem', () => {
    it('should update an encrypted item in the database', async () => {
      const id = '1';
      const encryptedData = 'updatedData';
      const iv = 'iv';
      const salt = 'salt';
      
      const mockUpdatedItem = {
        id,
        user_id: 'user-1',
        encrypted_data: encryptedData,
        iv,
        salt,
        created_at: '2023-01-01T12:00:00Z',
        updated_at: '2023-01-02T12:00:00Z',
      };

      // Setup mock implementation
      mockSupabase.single.mockResolvedValue({
        data: mockUpdatedItem,
        error: null,
      });

      const result = await updateCanDoItem(id, encryptedData, iv, salt);

      expect(mockSupabase.from).toHaveBeenCalledWith('can_do_list');
      expect(mockSupabase.update).toHaveBeenCalledWith({
        encrypted_data: encryptedData,
        iv,
        salt,
      });
      expect(mockSupabase.eq).toHaveBeenCalledWith('id', id);
      expect(result).toEqual(mockUpdatedItem);
    });

    it('should throw an error if the update fails', async () => {
      mockSupabase.single.mockResolvedValue({
        data: null,
        error: { message: 'Update error' },
      });

      await expect(updateCanDoItem('1', 'data', 'iv', 'salt', true)).rejects.toThrow('Failed to update can-do item: Update error');
    });
  });

  describe('deleteCanDoItem', () => {
    it('should delete an item from the database', async () => {
      const id = '1';

      mockSupabase.eq.mockResolvedValue({
        data: null,
        error: null,
      });

      await deleteCanDoItem(id);

      expect(mockSupabase.from).toHaveBeenCalledWith('can_do_list');
      expect(mockSupabase.delete).toHaveBeenCalled();
      expect(mockSupabase.eq).toHaveBeenCalledWith('id', id);
    });

    it('should throw an error if the delete fails', async () => {
      mockSupabase.eq.mockResolvedValue({
        data: null,
        error: { message: 'Delete error' },
      });

      await expect(deleteCanDoItem('1', true)).rejects.toThrow('Failed to delete can-do item: Delete error');
    });
  });
});