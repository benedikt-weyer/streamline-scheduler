import { Task, Project } from '@/utils/can-do-list/can-do-list-types';

export interface TaskState {
  tasks: Task[];
  isLoading: boolean;
}

export interface TaskStateActions {
  setTasks: (tasks: Task[] | ((prev: Task[]) => Task[])) => void;
  setIsLoading: (loading: boolean) => void;
}

export interface TaskLoaderHook {
  loadTasks: () => Promise<Task[]>;
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
  tasks: Task[];
  selectedProject: Project | null;
  isLoading: boolean;
  error: string | null;
  loadTasks: () => Promise<Task[]>;
  loadTasksByProject: (projectId?: string) => Promise<Task[]>;
  handleAddTask: (content: string, estimatedDuration?: number, projectId?: string, impact?: number, urgency?: number, dueDate?: Date, blockedBy?: string) => Promise<boolean>;
  handleUpdateTask: (id: string, content: string, estimatedDuration?: number, projectId?: string, impact?: number, urgency?: number, dueDate?: Date, blockedBy?: string, myDay?: boolean) => Promise<boolean>;
  handleToggleComplete: (id: string, completed: boolean) => Promise<boolean>;
  handleDeleteTask: (id: string) => Promise<boolean>;
  handleMoveTaskToProject: (id: string, projectId?: string) => Promise<boolean>;
  handleBulkDeleteCompleted: (projectId?: string) => Promise<number>;
  handleReorderTasks: (sourceIndex: number, destinationIndex: number, projectId?: string) => Promise<boolean>;
}
