import { useCallback, useMemo } from 'react';
import { CanDoListHook } from './types/itemHooks';
import { useItemState } from './useItemState';
import { useItemLoader } from './useItemLoader';
import { useItemCRUD } from './useItemCRUD';
import { useItemSubscriptions } from './useItemSubscriptions';

/**
 * Main orchestrating hook for can-do list
 * Coordinates all item-related operations through smaller, focused hooks
 */
export function useCanDoList(
  encryptionKey: string | null
): CanDoListHook {
  // Initialize item state management
  const [items, isLoading, itemActions] = useItemState();

  // Initialize specialized hooks
  const { loadItems } = useItemLoader(itemActions);
  
  // Create a stable wrapper for loadItems that returns void for subscription
  const loadItemsForSubscription = useCallback(async (key: string): Promise<void> => {
    await loadItems(key);
  }, [loadItems]);
  
  const { isSubscribed, skipNextItemReload } = useItemSubscriptions(encryptionKey, loadItemsForSubscription);
  
  const { 
    handleAddItem, 
    handleToggleComplete, 
    handleDeleteItem 
  } = useItemCRUD(items, itemActions, encryptionKey, skipNextItemReload);

  // Memoize the returned object to prevent unnecessary re-renders
  return useMemo(() => ({
    items,
    isLoading,
    loadItems,
    handleAddItem,
    handleToggleComplete,
    handleDeleteItem,
    isSubscribed,
    skipNextItemReload
  }), [
    items,
    isLoading,
    loadItems,
    handleAddItem,
    handleToggleComplete,
    handleDeleteItem,
    isSubscribed,
    skipNextItemReload
  ]);
}
