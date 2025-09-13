'use client';

import { getDecryptedBackend } from '@/utils/api/decrypted-backend';
import { CanDoItemDecrypted, CreateCanDoItemDecryptedRequest, UpdateCanDoItemDecryptedRequest } from '@/utils/api/types';

// Fetch all tasks for the current user (automatically decrypted)
export async function fetchTasks(silent = false): Promise<CanDoItemDecrypted[]> {
  try {
    const backend = getDecryptedBackend();
    const { data: tasks } = await backend.canDoList.getAll();
    return tasks;
  } catch (error) {
    if (!silent) {
      console.error('Failed to fetch tasks:', error);
    }
    throw error;
  }
}

// Add a new task with decrypted data
export async function addTask(
  taskData: CreateCanDoItemDecryptedRequest
): Promise<CanDoItemDecrypted> {
  try {
    const backend = getDecryptedBackend();
    const { data: task } = await backend.canDoList.create(taskData);
    if (!task) {
      throw new Error('Failed to create task - no data returned');
    }
    return task;
  } catch (error) {
    console.error('Failed to add task:', error);
    throw error;
  }
}

// Update an existing task with decrypted data
export async function updateTask(
  updateData: UpdateCanDoItemDecryptedRequest
): Promise<CanDoItemDecrypted> {
  try {
    const backend = getDecryptedBackend();
    const { data: task } = await backend.canDoList.update(updateData);
    if (!task) {
      throw new Error('Failed to update task - no data returned');
    }
    return task;
  } catch (error) {
    console.error('Failed to update task:', error);
    throw error;
  }
}

// Delete a task
export async function deleteTask(id: string): Promise<void> {
  try {
    const backend = getDecryptedBackend();
    await backend.canDoList.delete(id);
  } catch (error) {
    console.error('Failed to delete task:', error);
    throw error;
  }
}

// Reorder tasks
export async function reorderTasks(taskUpdates: Array<{ id: string; displayOrder: number }>): Promise<void> {
  try {
    const backend = getDecryptedBackend();
    
    // Update each task's display order
    for (const update of taskUpdates) {
      await backend.canDoList.update({
        id: update.id,
        display_order: update.displayOrder,
      });
    }
  } catch (error) {
    console.error('Failed to reorder tasks:', error);
    throw error;
  }
}

// Move task to project
export async function moveTaskToProject(taskId: string, projectId: string | null): Promise<CanDoItemDecrypted> {
  try {
    const backend = getDecryptedBackend();
    const { data: task } = await backend.canDoList.update({
      id: taskId,
      project_id: projectId || undefined,
    });
    if (!task) {
      throw new Error('Failed to move task - no data returned');
    }
    return task;
  } catch (error) {
    console.error('Failed to move task to project:', error);
    throw error;
  }
}

// Toggle task complete with reorder
export async function toggleTaskCompleteWithReorder(taskId: string, completed: boolean): Promise<CanDoItemDecrypted> {
  try {
    const backend = getDecryptedBackend();
    const { data: task } = await backend.canDoList.update({
      id: taskId,
      completed: completed,
    });
    if (!task) {
      throw new Error('Failed to toggle task complete - no data returned');
    }
    return task;
  } catch (error) {
    console.error('Failed to toggle task complete:', error);
    throw error;
  }
}

// Bulk delete tasks
export async function bulkDeleteTasks(taskIds: string[]): Promise<void> {
  try {
    const backend = getDecryptedBackend();
    for (const taskId of taskIds) {
      await backend.canDoList.delete(taskId);
    }
  } catch (error) {
    console.error('Failed to bulk delete tasks:', error);
    throw error;
  }
}

// Fetch tasks by project
export async function fetchTasksByProject(projectId: string | null): Promise<CanDoItemDecrypted[]> {
  try {
    const backend = getDecryptedBackend();
    // First fetch all tasks, then filter by project
    const { data: tasks } = await backend.canDoList.getAll();
    return tasks.filter(task => task.project_id === projectId);
  } catch (error) {
    console.error('Failed to fetch tasks by project:', error);
    throw error;
  }
}

// Bulk update task order
export async function bulkUpdateTaskOrder(taskUpdates: { id: string; order: number }[]): Promise<void> {
  try {
    const backend = getDecryptedBackend();
    for (const { id, order } of taskUpdates) {
      await backend.canDoList.update({
        id,
        display_order: order,
      });
    }
  } catch (error) {
    console.error('Failed to bulk update task order:', error);
    throw error;
  }
}