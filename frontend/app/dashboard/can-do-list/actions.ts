'use client';

import { getBackend } from '@/utils/api/backend-interface';
import { EncryptedTask } from '@/utils/can-do-list/can-do-list-types';

// Fetch all encrypted tasks for the current user
export async function fetchTasks(silent = false): Promise<EncryptedTask[]> {
  try {
    const backend = getBackend();
    const { data: tasks } = await backend.canDoList.getAll();
    return tasks as unknown as EncryptedTask[];
  } catch (error) {
    if (!silent) {
      console.error('Failed to fetch tasks:', error);
    }
    throw error;
  }
}

// Add a new encrypted task
export async function addTask(
  encryptedData: string,
  iv: string,
  salt: string,
  projectId?: string,
  displayOrder?: number
): Promise<EncryptedTask> {
  try {
    const backend = getBackend();
    const { data: task } = await backend.canDoList.create({
      encrypted_data: encryptedData,
      iv,
      salt,
      project_id: projectId,
      display_order: displayOrder,
    });
    return task as EncryptedTask;
  } catch (error) {
    console.error('Failed to add task:', error);
    throw error;
  }
}

// Update an existing encrypted task
export async function updateTask(
  id: string,
  encryptedData?: string,
  iv?: string,
  salt?: string,
  projectId?: string,
  displayOrder?: number
): Promise<EncryptedTask> {
  try {
    const backend = getBackend();
    const updateData: any = {};
    
    if (encryptedData !== undefined) updateData.encrypted_data = encryptedData;
    if (iv !== undefined) updateData.iv = iv;
    if (salt !== undefined) updateData.salt = salt;
    if (projectId !== undefined) updateData.project_id = projectId;
    if (displayOrder !== undefined) updateData.display_order = displayOrder;

    const { data: task } = await backend.canDoList.update(id, updateData);
    return task as EncryptedTask;
  } catch (error) {
    console.error('Failed to update task:', error);
    throw error;
  }
}

// Delete a task
export async function deleteTask(id: string): Promise<void> {
  try {
    const backend = getBackend();
    await backend.canDoList.delete(id);
  } catch (error) {
    console.error('Failed to delete task:', error);
    throw error;
  }
}

// Reorder tasks
export async function reorderTasks(taskUpdates: Array<{ id: string; displayOrder: number }>): Promise<void> {
  try {
    const backend = getBackend();
    
    // Update each task's display order
    for (const update of taskUpdates) {
      await backend.canDoList.update(update.id, {
        display_order: update.displayOrder,
      });
    }
  } catch (error) {
    console.error('Failed to reorder tasks:', error);
    throw error;
  }
}

// Move task to project
export async function moveTaskToProject(taskId: string, projectId: string | null): Promise<EncryptedTask> {
  try {
    const backend = getBackend();
    const { data: task } = await backend.canDoList.update({
      id: taskId,
      project_id: projectId || undefined,
    });
    return task as unknown as EncryptedTask;
  } catch (error) {
    console.error('Failed to move task to project:', error);
    throw error;
  }
}

// Toggle task complete with reorder
export async function toggleTaskCompleteWithReorder(taskId: string, completed: boolean): Promise<EncryptedTask> {
  try {
    const backend = getBackend();
    const { data: task } = await backend.canDoList.update({
      id: taskId,
      completed,
    });
    return task as unknown as EncryptedTask;
  } catch (error) {
    console.error('Failed to toggle task complete:', error);
    throw error;
  }
}

// Bulk delete tasks
export async function bulkDeleteTasks(taskIds: string[]): Promise<void> {
  try {
    const backend = getBackend();
    for (const taskId of taskIds) {
      await backend.canDoList.delete(taskId);
    }
  } catch (error) {
    console.error('Failed to bulk delete tasks:', error);
    throw error;
  }
}

// Fetch tasks by project
export async function fetchTasksByProject(projectId: string | null): Promise<EncryptedTask[]> {
  try {
    const backend = getBackend();
    // First fetch all tasks, then filter by project
    const { data: tasks } = await backend.canDoList.getAll();
    return (tasks as unknown as EncryptedTask[]).filter(task => task.project_id === projectId);
  } catch (error) {
    console.error('Failed to fetch tasks by project:', error);
    throw error;
  }
}

// Bulk update task order
export async function bulkUpdateTaskOrder(taskUpdates: { id: string; order: number }[]): Promise<void> {
  try {
    const backend = getBackend();
    for (const { id, order } of taskUpdates) {
      await backend.canDoList.update({
        id,
        order,
      });
    }
  } catch (error) {
    console.error('Failed to bulk update task order:', error);
    throw error;
  }
}