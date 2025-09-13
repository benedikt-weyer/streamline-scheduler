import { useCallback } from 'react';
import { Task } from '@/utils/can-do-list/can-do-list-types';
import { TaskStateActions } from './types/taskHooks';
import { useError } from '@/utils/context/ErrorContext';
import { fetchTasks, fetchTasksByProject } from '../../app/dashboard/can-do-list/api';

/**
 * Hook for loading can-do tasks
 */
export const useTaskLoader = (
  taskActions: TaskStateActions
) => {
  const { setError } = useError();

  const loadTasks = useCallback(async (): Promise<Task[]> => {
    try {
      taskActions.setIsLoading(true);
      const decryptedTasks = await fetchTasks();
      
      // Convert from CanDoItemDecrypted to Task type
      const tasks: Task[] = decryptedTasks.map(task => ({
        id: task.id,
        content: task.content,
        description: '', // CanDoItemDecrypted doesn't have description field
        completed: task.completed,
        createdAt: new Date(task.created_at),
        updatedAt: task.updated_at ? new Date(task.updated_at) : undefined,
        projectId: task.project_id,
        displayOrder: task.display_order ?? 0,
        user_id: task.user_id,
        // Set default values for properties not available in the API response
        estimatedDuration: task.duration_minutes,
        impact: undefined,
        urgency: undefined,
        dueDate: task.due_date ? new Date(task.due_date) : undefined,
        blockedBy: undefined,
        myDay: false
      }));
      
      taskActions.setTasks(tasks);
      taskActions.setIsLoading(false);
      return tasks;
    } catch (error) {
      console.error('Error loading tasks:', error);
      setError('Failed to load your Can-Do List tasks');
      taskActions.setIsLoading(false);
      return [];
    }
  }, [taskActions, setError]);

  const loadTasksByProject = useCallback(async (projectId?: string): Promise<Task[]> => {
    try {
      taskActions.setIsLoading(true);
      const decryptedTasks = await fetchTasksByProject(projectId ?? null);
      
      // Convert from CanDoItemDecrypted to Task type
      const tasks: Task[] = decryptedTasks.map(task => ({
        id: task.id,
        content: task.content,
        description: '', // CanDoItemDecrypted doesn't have description field
        completed: task.completed,
        createdAt: new Date(task.created_at),
        updatedAt: task.updated_at ? new Date(task.updated_at) : undefined,
        projectId: task.project_id,
        displayOrder: task.display_order ?? 0,
        user_id: task.user_id,
        // Set default values for properties not available in the API response
        estimatedDuration: task.duration_minutes,
        impact: undefined,
        urgency: undefined,
        dueDate: task.due_date ? new Date(task.due_date) : undefined,
        blockedBy: undefined,
        myDay: false
      }));
      
      taskActions.setTasks(tasks);
      taskActions.setIsLoading(false);
      return tasks;
    } catch (error) {
      console.error('Error loading tasks by project:', error);
      setError('Failed to load your Can-Do List tasks');
      taskActions.setIsLoading(false);
      return [];
    }
  }, [taskActions, setError]);

  return {
    loadTasks,
    loadTasksByProject
  };
};
