import { CanDoItemDecrypted, CanDoItemEncrypted, ProjectDecrypted, ProjectEncrypted } from '@/utils/api/types';

// Domain-specific extensions for tasks and projects
export interface Task extends Omit<CanDoItemDecrypted, 'created_at' | 'updated_at' | 'project_id' | 'display_order'> {
  createdAt: Date;
  updatedAt?: Date;
  estimatedDuration?: number; // in minutes
  projectId?: string; // Reference to project
  displayOrder: number;
  impact?: number; // 1-10, how important the task is
  urgency?: number; // 1-10, how urgent the task is
  dueDate?: Date; // when the task is due
  blockedBy?: string; // Reference to task that blocks this task
  myDay?: boolean; // whether the task is added to My Day
}

export interface Project extends Omit<ProjectDecrypted, 'created_at' | 'updated_at' | 'parent_id' | 'collapsed'> {
  parentId?: string;
  isCollapsed: boolean;
  createdAt: Date;
  updatedAt?: Date;
}



export interface CanDoList {
  tasks: Task[];
}

// Default project constant
export const DEFAULT_PROJECT_NAME = 'Inbox';
export const DEFAULT_PROJECT_COLOR = '#6b7280'; // gray-500