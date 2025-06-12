import { useState, useCallback, useMemo } from 'react';
import { Task } from '@/utils/can-do-list/can-do-list-types';
import { TaskStateActions } from './types/taskHooks';

/**
 * Hook for managing can-do task state
 */
export const useTaskState = (): [Task[], boolean, TaskStateActions] => {
  const [tasks, setTasksInternal] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const setTasks = useCallback((tasksOrUpdater: Task[] | ((prev: Task[]) => Task[])) => {
    setTasksInternal(prevTasks => {
      const newTasks = typeof tasksOrUpdater === 'function' 
        ? tasksOrUpdater(prevTasks) 
        : tasksOrUpdater;
      
      // Sort tasks by display order, with fallback to creation date for same display order
      return newTasks.sort((a, b) => {
        // First compare by display order
        if (a.displayOrder !== b.displayOrder) {
          return a.displayOrder - b.displayOrder;
        }
        // If display order is the same, sort by creation date (newest first as fallback)
        return b.createdAt.getTime() - a.createdAt.getTime();
      });
    });
  }, []);

  const actions: TaskStateActions = useMemo(() => ({
    setTasks,
    setIsLoading
  }), [setTasks]);

  return [tasks, isLoading, actions];
};
