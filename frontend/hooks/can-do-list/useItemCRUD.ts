import { useCallback } from 'react';
import { CanDoItem } from '@/utils/can-do-list/can-do-list-types';
import { ItemStateActions } from './types/itemHooks';
import { useError } from '@/utils/context/ErrorContext';
import { 
  addCanDoItem, 
  updateCanDoItem, 
  deleteCanDoItem,
  fetchCanDoItems,
  moveCanDoItemToProject,
  bulkDeleteCanDoItems
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

  const handleAddItem = useCallback(async (content: string, estimatedDuration?: number, projectId?: string): Promise<boolean> => {
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
        completed: false,
        estimatedDuration: estimatedDuration
      };
      const encryptedData = encryptData(itemData, derivedKey, iv);
      const newEncryptedItem = await addCanDoItem(encryptedData, iv, salt, projectId);
      const newItem: CanDoItem = {
        id: newEncryptedItem.id,
        content: itemData.content,
        completed: itemData.completed,
        createdAt: new Date(newEncryptedItem.created_at),
        updatedAt: new Date(newEncryptedItem.updated_at),
        estimatedDuration: estimatedDuration,
        projectId: projectId
      };
      itemActions.setItems(prevItems => [newItem, ...prevItems]);
      return true;
    } catch (error) {
      console.error('Error adding item:', error);
      setError('Failed to add new item');
      return false;
    }
  }, [encryptionKey, itemActions, setError, skipNextItemReload]);

  const handleUpdateItem = useCallback(async (id: string, content: string, estimatedDuration?: number, projectId?: string): Promise<boolean> => {
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
        content: content.trim(),
        completed: item.completed,
        estimatedDuration: estimatedDuration
      };
      
      const encryptedData = encryptData(updatedItemData, derivedKey, iv);
      
      await updateCanDoItem(id, encryptedData, iv, salt, projectId);
      
      itemActions.setItems(prevItems =>
        prevItems.map(item =>
          item.id === id
            ? { ...item, content: content.trim(), estimatedDuration: estimatedDuration, projectId: projectId }
            : item
        )
      );
      return true;
    } catch (error) {
      console.error('Error updating item:', error);
      setError('Failed to update item');
      return false;
    }
  }, [encryptionKey, items, itemActions, setError, skipNextItemReload]);

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
        completed: completed
      };
      
      const encryptedData = encryptData(updatedItemData, derivedKey, iv);
      
      await updateCanDoItem(id, encryptedData, iv, salt);
      
      itemActions.setItems(prevItems =>
        prevItems.map(item =>
          item.id === id
            ? { ...item, completed: completed }
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

  const handleMoveItemToProject = useCallback(async (id: string, projectId?: string): Promise<boolean> => {
    try {
      if (skipNextItemReload) {
        skipNextItemReload();
      }
      
      await moveCanDoItemToProject(id, projectId);
      
      itemActions.setItems(prevItems =>
        prevItems.map(item =>
          item.id === id
            ? { ...item, projectId: projectId }
            : item
        )
      );
      return true;
    } catch (error) {
      console.error('Error moving item to project:', error);
      setError('Failed to move item to project');
      return false;
    }
  }, [itemActions, setError, skipNextItemReload]);

  const handleBulkDeleteCompleted = useCallback(async (projectId?: string): Promise<number> => {
    try {
      if (skipNextItemReload) {
        skipNextItemReload();
      }
      
      // Filter completed items for the given project (or all items if no project)
      const completedItems = items.filter(item => {
        const isCompleted = item.completed;
        if (projectId === undefined) {
          // If no project is selected, include items without projectId
          return isCompleted && !item.projectId;
        } else {
          // If project is selected, include items with matching projectId
          return isCompleted && item.projectId === projectId;
        }
      });
      
      if (completedItems.length === 0) {
        return 0;
      }
      
      const idsToDelete = completedItems.map(item => item.id);
      await bulkDeleteCanDoItems(idsToDelete);
      
      itemActions.setItems(prevItems => 
        prevItems.filter(item => !idsToDelete.includes(item.id))
      );
      
      return completedItems.length;
    } catch (error) {
      console.error('Error bulk deleting completed items:', error);
      setError('Failed to delete completed items');
      return 0;
    }
  }, [items, itemActions, setError, skipNextItemReload]);

  return {
    handleAddItem,
    handleUpdateItem,
    handleToggleComplete,
    handleDeleteItem,
    handleMoveItemToProject,
    handleBulkDeleteCompleted
  };
};
