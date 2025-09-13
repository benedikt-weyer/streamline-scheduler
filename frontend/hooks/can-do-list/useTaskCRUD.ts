import { useCallback } from 'react';
import { Task } from '@/utils/can-do-list/can-do-list-types';
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
import { 
  encryptData, 
  generateIV, 
  generateSalt, 
  deriveKeyFromPassword 
} from '@/utils/cryptography/encryption';

/**
 * Hook for basic CRUD operations on can-do tasks
 */
export const useTaskCRUD = (
  tasks: Task[],
  taskActions: TaskStateActions,
  encryptionKey: string | null,
  skipNextTaskReload?: () => void
) => {
  const { setError } = useError();

  const handleAddTask = useCallback(async (content: string, estimatedDuration?: number, projectId?: string, impact?: number, urgency?: number, dueDate?: Date, blockedBy?: string): Promise<boolean> => {
    if (!encryptionKey) return false;
    try {
      if (skipNextTaskReload) {
        skipNextTaskReload();
      }
      const salt = generateSalt();
      const iv = generateIV();
      const derivedKey = deriveKeyFromPassword(encryptionKey, salt);
      const taskData = {
        content: content.trim(),
        completed: false,
        estimatedDuration: estimatedDuration,
        impact: impact,
        urgency: urgency,
        dueDate: dueDate,
        blockedBy: blockedBy
      };
      const encryptedData = encryptData(taskData, derivedKey, iv);
      const newEncryptedTask = await addTask(encryptedData, iv, salt, projectId);
      const newTask: Task = {
        id: newEncryptedTask.id,
        content: taskData.content,
        completed: taskData.completed,
        createdAt: new Date(newEncryptedTask.created_at),
        updatedAt: new Date(newEncryptedTask.updated_at),
        estimatedDuration: estimatedDuration,
        projectId: projectId,
        displayOrder: newEncryptedTask.display_order ?? 0,
        impact: impact,
        urgency: urgency,
        dueDate: dueDate,
        blockedBy: blockedBy
      };
      taskActions.setTasks(prevTasks => [newTask, ...prevTasks]);
      return true;
    } catch (error) {
      console.error('Error adding task:', error);
      setError('Failed to add new task');
      return false;
    }
  }, [encryptionKey, taskActions, setError, skipNextTaskReload]);

  const handleUpdateTask = useCallback(async (id: string, content: string, estimatedDuration?: number, projectId?: string, impact?: number, urgency?: number, dueDate?: Date, blockedBy?: string, myDay?: boolean): Promise<boolean> => {
    if (!encryptionKey) return false;
    try {
      if (skipNextTaskReload) {
        skipNextTaskReload();
      }
      
      // Get the existing task to preserve fields that aren't being updated
      const existingTask = tasks.find(task => task.id === id);
      if (!existingTask) return false;
      
      const salt = generateSalt();
      const iv = generateIV();
      const derivedKey = deriveKeyFromPassword(encryptionKey, salt);
      const taskData = {
        content: content.trim(),
        completed: existingTask.completed, // Preserve completion status
        estimatedDuration: estimatedDuration,
        impact: impact,
        urgency: urgency,
        dueDate: dueDate,
        blockedBy: blockedBy,
        myDay: myDay
      };
      const encryptedData = encryptData(taskData, derivedKey, iv);
      await updateTask(id, encryptedData, iv, salt, projectId);
      
      // Update local state
      taskActions.setTasks(prevTasks =>
        prevTasks.map(task =>
          task.id === id
            ? { 
                ...task, 
                content: taskData.content, 
                estimatedDuration: estimatedDuration,
                projectId: projectId,
                impact: impact,
                urgency: urgency,
                dueDate: dueDate,
                blockedBy: blockedBy,
                myDay: myDay,
                updatedAt: new Date() 
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
  }, [encryptionKey, tasks, taskActions, setError, skipNextTaskReload]);

  const handleToggleComplete = useCallback(async (id: string, completed: boolean): Promise<boolean> => {
    if (!encryptionKey) return false;
    
    try {
      if (skipNextTaskReload) {
        skipNextTaskReload();
      }
      
      const task = tasks.find(task => task.id === id);
      if (!task) return false;
      
      // Find the corresponding encrypted task to get salt and IV
      const encryptedTasks = await fetchTasks();
      const encryptedTask = encryptedTasks.find(task => task.id === id);
      if (!encryptedTask) return false;
      
      const salt = encryptedTask.salt;
      const iv = encryptedTask.iv;
      const derivedKey = deriveKeyFromPassword(encryptionKey, salt);
      
      const updatedTaskData = {
        content: task.content,
        completed: completed,
        estimatedDuration: task.estimatedDuration,
        impact: task.impact,
        urgency: task.urgency,
        dueDate: task.dueDate,
        blockedBy: task.blockedBy
      };
      
      const encryptedData = encryptData(updatedTaskData, derivedKey, iv);
      
      // Use the new action that handles display order and reordering
      await toggleTaskCompleteWithReorder(id, completed);
      
      if (completed) {
        // When completing a task, update local state to show it as completed
        // The backend will assign a negative display order
        taskActions.setTasks(prevTasks =>
          prevTasks.map(prevTask =>
            prevTask.id === id
              ? { ...prevTask, completed: completed, displayOrder: -1 }
              : prevTask
          )
        );
      } else {
        // When uncompleting a task, it will get a new positive display order from the backend
        // We'll let the subscription or next reload handle the proper ordering
        taskActions.setTasks(prevTasks =>
          prevTasks.map(prevTask =>
            prevTask.id === id
              ? { ...prevTask, completed: completed }
              : prevTask
          )
        );
      }
      return true;
    } catch (error) {
      console.error('Error toggling task completion:', error);
      setError('Failed to update task');
      return false;
    }
  }, [encryptionKey, tasks, taskActions, setError, skipNextTaskReload]);

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
          // If no project is selected, include tasks without projectId
          return isCompleted && !task.projectId;
        } else {
          // If project is selected, include tasks with matching projectId
          return isCompleted && task.projectId === projectId;
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
