import { useState, useCallback, useMemo } from 'react';
import { CanDoItem } from '@/utils/can-do-list/can-do-list-types';
import { ItemStateActions } from './types/itemHooks';

/**
 * Hook for managing can-do item state
 */
export const useItemState = (): [CanDoItem[], boolean, ItemStateActions] => {
  const [items, setItemsInternal] = useState<CanDoItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const setItems = useCallback((itemsOrUpdater: CanDoItem[] | ((prev: CanDoItem[]) => CanDoItem[])) => {
    setItemsInternal(prevItems => {
      const newItems = typeof itemsOrUpdater === 'function' 
        ? itemsOrUpdater(prevItems) 
        : itemsOrUpdater;
      
      // Sort items by creation date (newest first)
      return newItems.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    });
  }, []);

  const actions: ItemStateActions = useMemo(() => ({
    setItems,
    setIsLoading
  }), [setItems]);

  return [items, isLoading, actions];
};
