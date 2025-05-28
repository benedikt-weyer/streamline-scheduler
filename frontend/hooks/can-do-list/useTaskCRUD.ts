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
  bulkDeleteTasks
} from '../../app/dashboard/can-do-list/actions';
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

  const handleAddTask = useCallback(async (content: string, estimatedDuration?: number, projectId?: string): Promise<boolean> => {
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
        estimatedDuration: estimatedDuration
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
        projectId: projectId
      };
      taskActions.setTasks(prevTasks => [newTask, ...prevTasks]);
      return true;
    } catch (error) {
      console.error('Error adding task:', error);
      setError('Failed to add new task');
      return false;
    }
  }, [encryptionKey, taskActions, setError, skipNextTaskReload]);

  const handleUpdateTask = useCallback(async (id: string, content: string, estimatedDuration?: number, projectId?: string): Promise<boolean> => {
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
        content: content.trim(),
        completed: task.completed,
        estimatedDuration: estimatedDuration
      };
      
      const encryptedData = encryptData(updatedTaskData, derivedKey, iv);
      
      await updateTask(id, encryptedData, iv, salt, projectId);
      
      taskActions.setTasks(prevTasks =>
        prevTasks.map(task =>
          task.id === id
            ? { ...task, content: content.trim(), estimatedDuration: estimatedDuration, projectId: projectId }
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
        completed: completed
      };
      
      const encryptedData = encryptData(updatedTaskData, derivedKey, iv);
      
      await updateTask(id, encryptedData, iv, salt);
      
      taskActions.setTasks(prevTasks =>
        prevTasks.map(task =>
          task.id === id
            ? { ...task, completed: completed }
            : task
        )
      );
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
      
      await moveTaskToProject(id, projectId);
      
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
