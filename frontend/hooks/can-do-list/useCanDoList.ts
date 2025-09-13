import { useCallback, useMemo } from 'react';
import { CanDoListHook } from './types/taskHooks';
import { useTaskState } from './useTaskState';
import { useTaskLoader } from './useTaskLoader';
import { useTaskCRUD } from './useTaskCRUD';
import { useTaskReorder } from './useTaskReorder';
import { useTaskSubscriptions } from './useTaskSubscriptions';

/**
 * Main orchestrating hook for can-do list
 * Coordinates all task-related operations through smaller, focused hooks
 */
export function useCanDoList(
  encryptionKey: string | null
): CanDoListHook {
  // Initialize task state management
  const [tasks, isLoading, taskActions] = useTaskState();

  // Initialize specialized hooks
  const { loadTasks, loadTasksByProject } = useTaskLoader(taskActions);
  
  // Create a stable wrapper for loadTasks that returns void for subscription
  const loadTasksForSubscription = useCallback(async (): Promise<void> => {
    await loadTasks();
  }, [loadTasks]);
  
  const { isSubscribed, skipNextTaskReload } = useTaskSubscriptions(encryptionKey, loadTasksForSubscription);
  
  const { 
    handleAddTask, 
    handleUpdateTask,
    handleToggleComplete,
    handleDeleteTask,
    handleMoveTaskToProject,
    handleBulkDeleteCompleted
  } = useTaskCRUD(tasks, taskActions, skipNextTaskReload);  const { reorderTasks } = useTaskReorder(tasks, taskActions, skipNextTaskReload);

  // Memoize the returned object to prevent unnecessary re-renders
  return useMemo(() => ({
    tasks,
    selectedProject: null, // Not implemented in this hook
    isLoading,
    error: null, // Error handling is done at component level
    loadTasks,
    loadTasksByProject,
    handleAddTask,
    handleUpdateTask,
    handleToggleComplete,
    handleDeleteTask,
    handleMoveTaskToProject,
    handleBulkDeleteCompleted,
    handleReorderTasks: reorderTasks
  }), [
    tasks,
    isLoading,
    loadTasks,
    loadTasksByProject,
    handleAddTask,
    handleUpdateTask,
    handleToggleComplete,
    handleDeleteTask,
    handleMoveTaskToProject,
    handleBulkDeleteCompleted,
    reorderTasks
  ]);
}
