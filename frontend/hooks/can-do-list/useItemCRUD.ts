import { useCallback } from 'react';
import { CanDoItem } from '@/utils/can-do-list/can-do-list-types';
import { ItemStateActions } from './types/itemHooks';
import { useError } from '@/utils/context/ErrorContext';
import { 
  addCanDoItem, 
  updateCanDoItem, 
  deleteCanDoItem,
  fetchCanDoItems
} from '../../app/dashboard/can-do-list/actions';
import { 
  encryptData, 
  generateIV, 
  generateSalt, 
  deriveKeyFromPassword 
} from '@/utils/cryptography/encryption';

/**
 * Hook for basic CRUD operations on can-do items
 */
export const useItemCRUD = (
  items: CanDoItem[],
  itemActions: ItemStateActions,
  encryptionKey: string | null,
  skipNextItemReload?: () => void
) => {
  const { setError } = useError();

  const handleAddItem = useCallback(async (content: string): Promise<boolean> => {
    if (!encryptionKey) return false;
    
    try {
      if (skipNextItemReload) {
        skipNextItemReload();
      }
      
      const salt = generateSalt();
      const iv = generateIV();
      const derivedKey = deriveKeyFromPassword(encryptionKey, salt);
      
      const itemData = {
        content: content.trim(),
        completed: false
      };
      
      const encryptedData = encryptData(itemData, derivedKey, iv);
      
      const newEncryptedItem = await addCanDoItem(encryptedData, iv, salt);
      
      const newItem: CanDoItem = {
        id: newEncryptedItem.id,
        content: itemData.content,
        completed: itemData.completed,
        createdAt: new Date(newEncryptedItem.created_at),
        updatedAt: new Date(newEncryptedItem.updated_at)
      };
      
      itemActions.setItems(prevItems => [newItem, ...prevItems]);
      return true;
    } catch (error) {
      console.error('Error adding item:', error);
      setError('Failed to add new item');
      return false;
    }
  }, [encryptionKey, itemActions, setError, skipNextItemReload]);

  const handleToggleComplete = useCallback(async (id: string, completed: boolean): Promise<boolean> => {
    if (!encryptionKey) return false;
    
    try {
      if (skipNextItemReload) {
        skipNextItemReload();
      }
      
      const item = items.find(item => item.id === id);
      if (!item) return false;
      
      // Find the corresponding encrypted item to get salt and IV
      const encryptedItems = await fetchCanDoItems();
      const encryptedItem = encryptedItems.find(item => item.id === id);
      if (!encryptedItem) return false;
      
      const salt = encryptedItem.salt;
      const iv = encryptedItem.iv;
      const derivedKey = deriveKeyFromPassword(encryptionKey, salt);
      
      const updatedItemData = {
        content: item.content,
        completed: !completed
      };
      
      const encryptedData = encryptData(updatedItemData, derivedKey, iv);
      
      await updateCanDoItem(id, encryptedData, iv, salt);
      
      itemActions.setItems(prevItems =>
        prevItems.map(item =>
          item.id === id
            ? { ...item, completed: !completed }
            : item
        )
      );
      return true;
    } catch (error) {
      console.error('Error toggling item completion:', error);
      setError('Failed to update item');
      return false;
    }
  }, [encryptionKey, items, itemActions, setError, skipNextItemReload]);

  const handleDeleteItem = useCallback(async (id: string): Promise<boolean> => {
    try {
      if (skipNextItemReload) {
        skipNextItemReload();
      }
      
      await deleteCanDoItem(id);
      itemActions.setItems(prevItems => prevItems.filter(item => item.id !== id));
      return true;
    } catch (error) {
      console.error('Error deleting item:', error);
      setError('Failed to delete item');
      return false;
    }
  }, [itemActions, setError, skipNextItemReload]);

  return {
    handleAddItem,
    handleToggleComplete,
    handleDeleteItem
  };
};
