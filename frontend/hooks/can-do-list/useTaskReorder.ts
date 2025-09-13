import { useCallback } from 'react';
import { CanDoItemDecrypted } from '@/utils/api/types';
import { TaskStateActions } from './types/taskHooks';
import { useError } from '@/utils/context/ErrorContext';
import { bulkUpdateTaskOrder } from '../../app/dashboard/can-do-list/api';

/**
 * Hook for handling task reordering via drag and drop
 */
export const useTaskReorder = (
  tasks: CanDoItemDecrypted[],
  taskActions: TaskStateActions,
  skipNextTaskReload?: () => void
) => {
  const { setError } = useError();

  const reorderTasks = useCallback(async (
    sourceIndex: number,
    destinationIndex: number,
    projectId?: string
  ): Promise<boolean> => {
    try {
      if (skipNextTaskReload) {
        skipNextTaskReload();
      }

      // Filter tasks for the current project
      const projectTasks = tasks.filter(task => 
        projectId ? task.project_id === projectId : !task.project_id
      );

      if (sourceIndex < 0 || sourceIndex >= projectTasks.length ||
          destinationIndex < 0 || destinationIndex >= projectTasks.length) {
        return false;
      }

      // Create a new array with reordered tasks
      const reorderedTasks = [...projectTasks];
      const [movedTask] = reorderedTasks.splice(sourceIndex, 1);
      reorderedTasks.splice(destinationIndex, 0, movedTask);

      // Create updates for bulk update
      const updates = reorderedTasks.map((task, index) => ({
        id: task.id,
        order: index
      }));

      // Update the database
      await bulkUpdateTaskOrder(updates);

      // Update local state - merge the reordered project tasks back into the full task list
      const otherTasks = tasks.filter(task => 
        projectId ? task.project_id !== projectId : !!task.project_id
      );

      const updatedProjectTasks = reorderedTasks.map((task, index) => ({
        ...task,
        display_order: index
      }));

      // Combine and sort all tasks by project and display order
      const allUpdatedTasks = [...otherTasks, ...updatedProjectTasks].sort((a, b) => {
        // First sort by project (null/undefined projects first, then by projectId)
        if (!a.project_id && !b.project_id) {
          return a.display_order - b.display_order;
        }
        if (!a.project_id) return -1;
        if (!b.project_id) return 1;
        if (a.project_id !== b.project_id) {
          return a.project_id.localeCompare(b.project_id);
        }
        // Within the same project, sort by display order
        return a.display_order - b.display_order;
      });

      taskActions.setTasks(allUpdatedTasks);
      return true;
    } catch (error) {
      console.error('Error reordering tasks:', error);
      setError('Failed to reorder tasks');
      return false;
    }
  }, [tasks, taskActions, setError, skipNextTaskReload]);

  return {
    reorderTasks
  };
};
