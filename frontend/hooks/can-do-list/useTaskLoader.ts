import { useCallback } from 'react';
import { Task } from '@/utils/can-do-list/can-do-list-types';
import { TaskStateActions } from './types/taskHooks';
import { useError } from '@/utils/context/ErrorContext';
import { fetchTasks, fetchTasksByProject } from '../../app/dashboard/can-do-list/actions';
import { 
  decryptData, 
  deriveKeyFromPassword 
} from '@/utils/cryptography/encryption';

/**
 * Hook for loading and decrypting can-do tasks
 */
export const useTaskLoader = (
  taskActions: TaskStateActions
) => {
  const { setError } = useError();

  const decryptTasks = useCallback((encryptedTasks: any[], key: string): Task[] => {
    return encryptedTasks
      .map(task => {
        try {
          const decryptionKey = deriveKeyFromPassword(key, task.salt);
          const decryptedData = decryptData(task.encrypted_data, decryptionKey, task.iv);
          
          if (!decryptedData) return null;
          
          return {
            id: task.id,
            content: decryptedData.content,
            completed: decryptedData.completed,
            createdAt: new Date(task.created_at),
            updatedAt: task.updated_at ? new Date(task.updated_at) : undefined,
            estimatedDuration: decryptedData.estimatedDuration,
            projectId: task.project_id,
            displayOrder: task.display_order ?? 0,
            impact: decryptedData.impact,
            urgency: decryptedData.urgency,
            dueDate: decryptedData.dueDate ? new Date(decryptedData.dueDate) : undefined,
            blockedBy: decryptedData.blockedBy
          };
        } catch (error) {
          console.error('Failed to decrypt task:', error);
          return null;
        }
      })
      .filter((task): task is NonNullable<typeof task> => task !== null);
  }, []);

  const loadTasks = useCallback(async (key: string): Promise<Task[]> => {
    try {
      taskActions.setIsLoading(true);
      const encryptedTasks = await fetchTasks();
      const decryptedTasks = decryptTasks(encryptedTasks, key);
      
      taskActions.setTasks(decryptedTasks);
      taskActions.setIsLoading(false);
      return decryptedTasks;
    } catch (error) {
      console.error('Error loading tasks:', error);
      setError('Failed to load your Can-Do List tasks');
      taskActions.setIsLoading(false);
      return [];
    }
  }, [taskActions, setError, decryptTasks]);

  const loadTasksByProject = useCallback(async (key: string, projectId?: string): Promise<Task[]> => {
    try {
      taskActions.setIsLoading(true);
      const encryptedTasks = await fetchTasksByProject(projectId);
      const decryptedTasks = decryptTasks(encryptedTasks, key);
      
      taskActions.setTasks(decryptedTasks);
      taskActions.setIsLoading(false);
      return decryptedTasks;
    } catch (error) {
      console.error('Error loading tasks by project:', error);
      setError('Failed to load your Can-Do List tasks');
      taskActions.setIsLoading(false);
      return [];
    }
  }, [taskActions, setError, decryptTasks]);

  return {
    loadTasks,
    loadTasksByProject
  };
};
