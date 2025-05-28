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
  handleAddItem: (content: string, estimatedDuration?: number, projectId?: string) => Promise<boolean>;
  handleUpdateItem: (id: string, content: string, estimatedDuration?: number, projectId?: string) => Promise<boolean>;
  handleToggleComplete: (id: string, completed: boolean) => Promise<boolean>;
  handleDeleteItem: (id: string) => Promise<boolean>;
  handleMoveItemToProject: (id: string, projectId?: string) => Promise<boolean>;
  handleBulkDeleteCompleted: (projectId?: string) => Promise<number>;
}

export interface ItemSubscriptionHook {
  isSubscribed: boolean;
  skipNextItemReload: () => void;
}

export interface CanDoListHook extends ItemState, ItemCRUDHook {
  loadItems: (key: string) => Promise<CanDoItem[]>;
  loadItemsByProject: (key: string, projectId?: string) => Promise<CanDoItem[]>;
  isSubscribed: boolean;
  skipNextItemReload: () => void;
}
