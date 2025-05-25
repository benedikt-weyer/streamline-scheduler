import { useCallback } from 'react';
import { CanDoItem } from '@/utils/can-do-list/can-do-list-types';
import { ItemStateActions } from './types/itemHooks';
import { useError } from '@/utils/context/ErrorContext';
import { fetchCanDoItems } from '../../app/dashboard/can-do-list/actions';
import { 
  decryptData, 
  deriveKeyFromPassword 
} from '@/utils/cryptography/encryption';

/**
 * Hook for loading and decrypting can-do items
 */
export const useItemLoader = (
  itemActions: ItemStateActions
) => {
  const { setError } = useError();

  const loadItems = useCallback(async (key: string): Promise<CanDoItem[]> => {
    try {
      itemActions.setIsLoading(true);
      const encryptedItems = await fetchCanDoItems();
      
      const decryptedItems = encryptedItems
        .map(item => {
          try {
            const decryptionKey = deriveKeyFromPassword(key, item.salt);
            const decryptedData = decryptData(item.encrypted_data, decryptionKey, item.iv);
            
            if (!decryptedData) return null;
            
            return {
              id: item.id,
              content: decryptedData.content,
              completed: decryptedData.completed,
              createdAt: new Date(item.created_at),
              updatedAt: item.updated_at ? new Date(item.updated_at) : undefined,
              estimatedDuration: decryptedData.estimatedDuration
            };
          } catch (error) {
            console.error('Failed to decrypt item:', error);
            return null;
          }
        })
        .filter((item): item is NonNullable<typeof item> => item !== null);
      
      itemActions.setItems(decryptedItems);
      itemActions.setIsLoading(false);
      return decryptedItems;
    } catch (error) {
      console.error('Error loading items:', error);
      setError('Failed to load your Can-Do List items');
      itemActions.setIsLoading(false);
      return [];
    }
  }, [itemActions, setError]);

  return {
    loadItems
  };
};
