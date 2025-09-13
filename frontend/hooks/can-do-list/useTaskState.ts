import { useState, useCallback, useMemo } from 'react';
import { CanDoItemDecrypted } from '@/utils/api/types';
import { TaskStateActions } from './types/taskHooks';

/**
 * Hook for managing can-do task state
 */
export const useTaskState = (): [CanDoItemDecrypted[], boolean, TaskStateActions] => {
  const [tasks, setTasksInternal] = useState<CanDoItemDecrypted[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const setTasks = useCallback((tasksOrUpdater: CanDoItemDecrypted[] | ((prev: CanDoItemDecrypted[]) => CanDoItemDecrypted[])) => {
    setTasksInternal(prevTasks => {
      const newTasks = typeof tasksOrUpdater === 'function' 
        ? tasksOrUpdater(prevTasks) 
        : tasksOrUpdater;
      
      // Sort tasks by display order, with fallback to creation date for same display order
      return newTasks.sort((a, b) => {
        // First compare by display order
        if (a.display_order !== b.display_order) {
          return a.display_order - b.display_order;
        }
        // If display order is the same, sort by creation date (newest first as fallback)
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });
    });
  }, []);

  const actions: TaskStateActions = useMemo(() => ({
    setTasks,
    setIsLoading
  }), [setTasks]);

  return [tasks, isLoading, actions];
};
