import { useCallback } from 'react';
import { CanDoItemDecrypted } from '@/utils/api/types';
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

  const loadTasks = useCallback(async (): Promise<CanDoItemDecrypted[]> => {
    try {
      taskActions.setIsLoading(true);
      const decryptedTasks = await fetchTasks();
      
      // Use the decrypted tasks directly - no mapping needed
      const tasks: CanDoItemDecrypted[] = decryptedTasks;
      
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

  const loadTasksByProject = useCallback(async (projectId?: string): Promise<CanDoItemDecrypted[]> => {
    try {
      taskActions.setIsLoading(true);
      const decryptedTasks = await fetchTasksByProject(projectId ?? null);
      
      // Use the decrypted tasks directly - no mapping needed
      const tasks: CanDoItemDecrypted[] = decryptedTasks;
      
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
