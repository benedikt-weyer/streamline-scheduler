import { Task } from '@/utils/can-do-list/can-do-list-types';

export interface TaskState {
  tasks: Task[];
  isLoading: boolean;
}

export interface TaskStateActions {
  setTasks: (tasks: Task[] | ((prev: Task[]) => Task[])) => void;
  setIsLoading: (loading: boolean) => void;
}

export interface TaskLoaderHook {
  loadTasks: (key: string) => Promise<Task[]>;
}

export interface TaskCRUDHook {
  handleAddTask: (content: string, estimatedDuration?: number, projectId?: string) => Promise<boolean>;
  handleUpdateTask: (id: string, content: string, estimatedDuration?: number, projectId?: string) => Promise<boolean>;
  handleToggleComplete: (id: string, completed: boolean) => Promise<boolean>;
  handleDeleteTask: (id: string) => Promise<boolean>;
  handleMoveTaskToProject: (id: string, projectId?: string) => Promise<boolean>;
  handleBulkDeleteCompleted: (projectId?: string) => Promise<number>;
}

export interface TaskSubscriptionHook {
  isSubscribed: boolean;
  skipNextTaskReload: () => void;
}

export interface CanDoListHook extends TaskState, TaskCRUDHook {
  loadTasks: (key: string) => Promise<Task[]>;
  loadTasksByProject: (key: string, projectId?: string) => Promise<Task[]>;
  isSubscribed: boolean;
  skipNextTaskReload: () => void;
}
