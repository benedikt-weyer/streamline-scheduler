import { CanDoItem } from '@/utils/can-do-list/can-do-list-types';

export interface ItemState {
  items: CanDoItem[];
  isLoading: boolean;
}

export interface ItemStateActions {
  setItems: (items: CanDoItem[] | ((prev: CanDoItem[]) => CanDoItem[])) => void;
  setIsLoading: (loading: boolean) => void;
}

export interface ItemLoaderHook {
  loadItems: (key: string) => Promise<CanDoItem[]>;
}

export interface ItemCRUDHook {
  handleAddItem: (content: string) => Promise<boolean>;
  handleUpdateItem: (id: string, content: string) => Promise<boolean>;
  handleToggleComplete: (id: string, completed: boolean) => Promise<boolean>;
  handleDeleteItem: (id: string) => Promise<boolean>;
}

export interface ItemSubscriptionHook {
  isSubscribed: boolean;
  skipNextItemReload: () => void;
}

export interface CanDoListHook extends ItemState, ItemCRUDHook {
  loadItems: (key: string) => Promise<CanDoItem[]>;
  isSubscribed: boolean;
  skipNextItemReload: () => void;
}
