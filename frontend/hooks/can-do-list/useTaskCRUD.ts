import { useCallback } from 'react';
import { CanDoItemDecrypted } from '@/utils/api/types';
import { TaskStateActions } from './types/taskHooks';
import { useError } from '@/utils/context/ErrorContext';
import { 
  addTask, 
  updateTask, 
  deleteTask,
  fetchTasks,
  moveTaskToProject,
  bulkDeleteTasks,
  toggleTaskCompleteWithReorder
} from '../../app/dashboard/can-do-list/api';
import { getCurrentUserId } from '@/utils/auth/current-user';

/**
 * Hook for basic CRUD operations on can-do tasks
 */
export const useTaskCRUD = (
  tasks: CanDoItemDecrypted[],
  taskActions: TaskStateActions,
  skipNextTaskReload?: () => void
) => {
  const { setError } = useError();

  const handleAddTask = useCallback(async (content: string, estimatedDuration?: number, projectId?: string, impact?: number, urgency?: number, dueDate?: Date, blockedBy?: string): Promise<boolean> => {
    try {
      const userId = getCurrentUserId();
      if (!userId) {
        setError("User not authenticated");
        return false;
      }

      if (skipNextTaskReload) {
        skipNextTaskReload();
      }

      const taskData = {
        content: content.trim(),
        project_id: projectId,
        completed: false,
        due_date: dueDate?.toISOString(),
        duration_minutes: estimatedDuration,
        display_order: 0
      };

      const newTask = await addTask(taskData);
      
      // Use the task directly from API (it's already the correct type)
      const localTask: CanDoItemDecrypted = newTask;
      
      taskActions.setTasks(prevTasks => [localTask, ...prevTasks]);
      return true;
    } catch (error) {
      console.error('Error adding task:', error);
      setError('Failed to add new task');
      return false;
    }
  }, [taskActions, setError, skipNextTaskReload]);

  const handleUpdateTask = useCallback(async (id: string, content: string, estimatedDuration?: number, projectId?: string, impact?: number, urgency?: number, dueDate?: Date, blockedBy?: string, myDay?: boolean): Promise<boolean> => {
    try {
      const userId = getCurrentUserId();
      if (!userId) {
        setError("User not authenticated");
        return false;
      }

      if (skipNextTaskReload) {
        skipNextTaskReload();
      }
      
      // Get the existing task to preserve fields that aren't being updated
      const existingTask = tasks.find(task => task.id === id);
      if (!existingTask) return false;
      
      const taskData = {
        id,
        content: content.trim(),
        completed: existingTask.completed, // Preserve completion status
        project_id: projectId,
        due_date: dueDate?.toISOString(),
        duration_minutes: estimatedDuration,
        impact: impact !== undefined ? impact : existingTask.impact, // Include impact
        urgency: urgency !== undefined ? urgency : existingTask.urgency, // Include urgency
        blocked_by: blockedBy !== undefined ? blockedBy : existingTask.blocked_by, // Include blocked_by
        display_order: existingTask.display_order,
        my_day: myDay !== undefined ? myDay : existingTask.my_day // Include my_day field
      };

      const updatedTask = await updateTask(taskData);
      
      // Update local state
      taskActions.setTasks(prevTasks =>
        prevTasks.map(task =>
          task.id === id
            ? { 
                ...task, 
                content: updatedTask.content, 
                duration_minutes: updatedTask.duration_minutes,
                project_id: updatedTask.project_id,
                impact: impact !== undefined ? impact : task.impact,
                urgency: urgency !== undefined ? urgency : task.urgency,
                due_date: updatedTask.due_date,
                blocked_by: blockedBy !== undefined ? blockedBy : task.blocked_by,
                my_day: updatedTask.my_day,
                updated_at: updatedTask.updated_at 
              }
            : task
        )
      );
      return true;
    } catch (error) {
      console.error('Error updating task:', error);
      setError('Failed to update task');
      return false;
    }
  }, [tasks, taskActions, setError, skipNextTaskReload]);

  const handleToggleComplete = useCallback(async (id: string, completed: boolean): Promise<boolean> => {
    try {
      const userId = getCurrentUserId();
      if (!userId) {
        setError("User not authenticated");
        return false;
      }
      
      if (skipNextTaskReload) {
        skipNextTaskReload();
      }
      
      const task = tasks.find(task => task.id === id);
      if (!task) return false;
      
      // Use the new action that handles display order and reordering
      const updatedTask = await toggleTaskCompleteWithReorder(id, completed);
      
      // Update local state with the updated task from API
      taskActions.setTasks(prevTasks =>
        prevTasks.map(prevTask =>
          prevTask.id === id
            ? { 
                ...prevTask, 
                completed: updatedTask.completed,
                display_order: updatedTask.display_order ?? prevTask.display_order,
                updatedAt: new Date(updatedTask.updated_at)
              }
            : prevTask
        )
      );
      
      return true;
    } catch (error) {
      console.error('Error toggling task completion:', error);
      setError('Failed to update task');
      return false;
    }
  }, [tasks, taskActions, setError, skipNextTaskReload]);

  const handleDeleteTask = useCallback(async (id: string): Promise<boolean> => {
    try {
      if (skipNextTaskReload) {
        skipNextTaskReload();
      }
      
      await deleteTask(id);
      taskActions.setTasks(prevTasks => prevTasks.filter(task => task.id !== id));
      return true;
    } catch (error) {
      console.error('Error deleting task:', error);
      setError('Failed to delete task');
      return false;
    }
  }, [taskActions, setError, skipNextTaskReload]);

  const handleMoveTaskToProject = useCallback(async (id: string, projectId?: string): Promise<boolean> => {
    try {
      if (skipNextTaskReload) {
        skipNextTaskReload();
      }
      
      await moveTaskToProject(id, projectId ?? null);
      
      taskActions.setTasks(prevTasks =>
        prevTasks.map(task =>
          task.id === id
            ? { ...task, projectId: projectId }
            : task
        )
      );
      return true;
    } catch (error) {
      console.error('Error moving task to project:', error);
      setError('Failed to move task to project');
      return false;
    }
  }, [taskActions, setError, skipNextTaskReload]);

  const handleBulkDeleteCompleted = useCallback(async (projectId?: string): Promise<number> => {
    try {
      if (skipNextTaskReload) {
        skipNextTaskReload();
      }
      
      // Filter completed tasks for the given project (or all tasks if no project)
      const completedTasks = tasks.filter(task => {
        const isCompleted = task.completed;
        if (projectId === undefined) {
          // If no project is selected, include tasks without project_id
          return isCompleted && !task.project_id;
        } else {
          // If project is selected, include tasks with matching project_id
          return isCompleted && task.project_id === projectId;
        }
      });
      
      if (completedTasks.length === 0) {
        return 0;
      }
      
      const idsToDelete = completedTasks.map(task => task.id);
      await bulkDeleteTasks(idsToDelete);
      
      taskActions.setTasks(prevTasks => 
        prevTasks.filter(task => !idsToDelete.includes(task.id))
      );
      
      return completedTasks.length;
    } catch (error) {
      console.error('Error bulk deleting completed tasks:', error);
      setError('Failed to delete completed tasks');
      return 0;
    }
  }, [tasks, taskActions, setError, skipNextTaskReload]);

  return {
    handleAddTask,
    handleUpdateTask,
    handleToggleComplete,
    handleDeleteTask,
    handleMoveTaskToProject,
    handleBulkDeleteCompleted
  };
};
