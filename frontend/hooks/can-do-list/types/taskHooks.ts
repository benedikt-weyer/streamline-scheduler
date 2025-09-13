import { CanDoItemDecrypted, ProjectDecrypted } from '@/utils/api/types';

export interface TaskState {
  tasks: CanDoItemDecrypted[];
  isLoading: boolean;
}

export interface TaskStateActions {
  setTasks: (tasks: CanDoItemDecrypted[] | ((prev: CanDoItemDecrypted[]) => CanDoItemDecrypted[])) => void;
  setIsLoading: (loading: boolean) => void;
}

export interface TaskLoaderHook {
  loadTasks: () => Promise<CanDoItemDecrypted[]>;
}

export interface TaskCRUDHook {
  handleAddTask: (content: string, estimatedDuration?: number, projectId?: string, impact?: number, urgency?: number, dueDate?: Date, blockedBy?: string) => Promise<boolean>;
  handleUpdateTask: (id: string, content: string, estimatedDuration?: number, projectId?: string, impact?: number, urgency?: number, dueDate?: Date, blockedBy?: string, myDay?: boolean) => Promise<boolean>;
  handleToggleComplete: (id: string, completed: boolean) => Promise<boolean>;
  handleDeleteTask: (id: string) => Promise<boolean>;
  handleMoveTaskToProject: (id: string, projectId?: string) => Promise<boolean>;
  handleBulkDeleteCompleted: (projectId?: string) => Promise<number>;
  handleReorderTasks: (sourceIndex: number, destinationIndex: number, projectId?: string) => Promise<boolean>;
}

export interface TaskSubscriptionHook {
  isSubscribed: boolean;
  skipNextTaskReload: () => void;
}

export interface CanDoListHook {
  tasks: CanDoItemDecrypted[];
  selectedProject: ProjectDecrypted | null;
  isLoading: boolean;
  error: string | null;
  loadTasks: () => Promise<CanDoItemDecrypted[]>;
  loadTasksByProject: (projectId?: string) => Promise<CanDoItemDecrypted[]>;
  handleAddTask: (content: string, estimatedDuration?: number, projectId?: string, impact?: number, urgency?: number, dueDate?: Date, blockedBy?: string) => Promise<boolean>;
  handleUpdateTask: (id: string, content: string, estimatedDuration?: number, projectId?: string, impact?: number, urgency?: number, dueDate?: Date, blockedBy?: string, myDay?: boolean) => Promise<boolean>;
  handleToggleComplete: (id: string, completed: boolean) => Promise<boolean>;
  handleDeleteTask: (id: string) => Promise<boolean>;
  handleMoveTaskToProject: (id: string, projectId?: string) => Promise<boolean>;
  handleBulkDeleteCompleted: (projectId?: string) => Promise<number>;
  handleReorderTasks: (sourceIndex: number, destinationIndex: number, projectId?: string) => Promise<boolean>;
}
