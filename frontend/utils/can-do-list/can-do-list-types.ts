export interface Task {
  id: string;
  content: string;
  completed: boolean;
  createdAt: Date;
  updatedAt?: Date;
  estimatedDuration?: number; // in minutes
  projectId?: string; // Reference to project
  displayOrder: number;
  impact?: number; // 1-10, how important the task is
  urgency?: number; // 1-10, how urgent the task is
  dueDate?: Date; // when the task is due
  blockedBy?: string; // Reference to task that blocks this task
}

export interface EncryptedTask {
  id: string;
  user_id: string;
  encrypted_data: string;
  iv: string;
  salt: string;
  created_at: string;
  updated_at: string;
  project_id?: string; // Reference to project
  display_order: number;
}

export interface Project {
  id: string;
  name: string;
  color: string;
  parentId?: string;
  displayOrder: number;
  isCollapsed: boolean;
  createdAt: Date;
  updatedAt?: Date;
}

export interface EncryptedProject {
  id: string;
  user_id: string;
  encrypted_data: string;
  iv: string;
  salt: string;
  created_at: string;
  updated_at: string;
  parent_id?: string;
  display_order: number;
  is_collapsed: boolean;
}

export interface CanDoList {
  tasks: Task[];
}

// Default project constant
export const DEFAULT_PROJECT_NAME = 'Inbox';
export const DEFAULT_PROJECT_COLOR = '#6b7280'; // gray-500