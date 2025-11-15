'use client';

import { useEffect, useCallback, useState, useRef } from 'react';
import { useEncryptionKey } from '@/hooks/cryptography/useEncryptionKey';
import { ErrorProvider, useError } from '@/utils/context/ErrorContext';
import { CanDoItemDecrypted, ProjectDecrypted, RealtimeSubscription, RealtimeMessage } from '@/utils/api/types';
import { CanDoListPageService } from './can-do-list-page-service';
import { getDecryptedBackend } from '@/utils/api/decrypted-backend';
import CanDoListMain from '@/components/can-do-list/can-do-list-main';

function CanDoListContent() {
  const { encryptionKey, isLoading: isLoadingKey } = useEncryptionKey();
  const { error, setError } = useError();

  const [tasks, setTasks] = useState<CanDoItemDecrypted[]>([]);
  const [projects, setProjects] = useState<ProjectDecrypted[]>([]);
  const [isLoadingTasks, setIsLoadingTasks] = useState(false);
  const [isLoadingProjects, setIsLoadingProjects] = useState(false);

  // Initialize service with backend (only in browser)
  const [canDoListPageService] = useState(() => {
    if (typeof window !== 'undefined') {
      return new CanDoListPageService(getDecryptedBackend());
    }
    return null;
  });

  // Store websocket subscriptions
  const subscriptionsRef = useRef<RealtimeSubscription[]>([]);

  // Load data when encryption key becomes available
  useEffect(() => {
    const loadData = async () => {
      if (!canDoListPageService || !encryptionKey) {
        return;
      }

      try {
        setIsLoadingTasks(true);
        setIsLoadingProjects(true);
        
        // Load all tasks and projects together
        const { tasks, projects } = await canDoListPageService.loadCanDoListData();
        
        setTasks(tasks);
        setProjects(projects);
        setError(null);
      } catch (error) {
        console.error('Failed to load can-do list data:', error);
        setError(error instanceof Error ? error.message : 'Failed to load data');
      } finally {
        setIsLoadingTasks(false);
        setIsLoadingProjects(false);
      }
    };

    loadData();
  }, [encryptionKey, canDoListPageService, setError]);

  // Set up websocket subscriptions for real-time updates
  useEffect(() => {
    if (!canDoListPageService || !encryptionKey) return;

    const backend = getDecryptedBackend();
    
    // Subscribe to can-do list changes
    const canDoSubscription = backend.canDoList.subscribe((payload: RealtimeMessage<CanDoItemDecrypted>) => {
      console.log('Can-do item websocket message:', payload);
      
      switch (payload.eventType) {
        case 'INSERT':
          if (payload.new) {
            setTasks(prev => {
              // Check if task already exists to avoid duplicates
              const exists = prev.some(task => task.id === payload.new!.id);
              if (!exists) {
                return [...prev, payload.new!];
              }
              return prev;
            });
          }
          break;
          
        case 'UPDATE':
          if (payload.new) {
            setTasks(prev => prev.map(task => 
              task.id === payload.new!.id ? payload.new! : task
            ));
          }
          break;
          
        case 'DELETE':
          if (payload.old) {
            setTasks(prev => prev.filter(task => task.id !== payload.old!.id));
          }
          break;
      }
    });

    // Subscribe to project changes
    const projectSubscription = backend.projects.subscribe((payload: RealtimeMessage<ProjectDecrypted>) => {
      console.log('Project websocket message:', payload);
      
      switch (payload.eventType) {
        case 'INSERT':
          if (payload.new) {
            setProjects(prev => {
              // Check if project already exists to avoid duplicates
              const exists = prev.some(project => project.id === payload.new!.id);
              if (!exists) {
                return [...prev, payload.new!];
              }
              return prev;
            });
          }
          break;
          
        case 'UPDATE':
          if (payload.new) {
            setProjects(prev => prev.map(project => 
              project.id === payload.new!.id ? payload.new! : project
            ));
          }
          break;
          
        case 'DELETE':
          if (payload.old) {
            setProjects(prev => prev.filter(project => project.id !== payload.old!.id));
          }
          break;
      }
    });

    // Store subscriptions for cleanup
    subscriptionsRef.current = [canDoSubscription, projectSubscription];

    // Cleanup function
    return () => {
      subscriptionsRef.current.forEach(subscription => {
        subscription.unsubscribe();
      });
      subscriptionsRef.current = [];
    };
  }, [canDoListPageService, encryptionKey]);

  // Service methods wrapped for the component
  const handleAddTask = useCallback(async (
    content: string,
    duration?: number,
    projectId?: string,
    impact?: number,
    urgency?: number,
    dueDate?: Date,
    blockedBy?: string,
    myDay?: boolean
  ): Promise<boolean> => {
    if (!canDoListPageService) return false;

    try {
      const { task, shouldRefreshProjects } = await canDoListPageService.createTask(
        content, duration, projectId, impact, urgency, dueDate, blockedBy, myDay
      );
      
      setTasks(prev => [...prev, task]);
      
      if (shouldRefreshProjects) {
        const updatedProjects = await canDoListPageService.projectService.getProjects();
        setProjects(updatedProjects);
      }
      
      return true;
    } catch (error) {
      console.error('Failed to add task:', error);
      setError(error instanceof Error ? error.message : 'Failed to add task');
      return false;
    }
  }, [canDoListPageService, setError]);

  const handleUpdateTask = useCallback(async (
    id: string,
    content?: string,
    duration?: number,
    projectId?: string,
    impact?: number,
    urgency?: number,
    dueDate?: Date,
    blockedBy?: string,
    myDay?: boolean
  ): Promise<boolean> => {
    if (!canDoListPageService) return false;

    try {
      const updatedTask = await canDoListPageService.updateTask(
        id, content, duration, projectId, impact, urgency, dueDate, blockedBy, myDay
      );
      
      setTasks(prev => prev.map(task => task.id === id ? updatedTask : task));
      return true;
    } catch (error) {
      console.error('Failed to update task:', error);
      setError(error instanceof Error ? error.message : 'Failed to update task');
      return false;
    }
  }, [canDoListPageService, setError]);

  const handleToggleComplete = useCallback(async (id: string, completed: boolean): Promise<boolean> => {
    if (!canDoListPageService) return false;

    try {
      const updatedTask = await canDoListPageService.toggleTaskComplete(id, completed);
      setTasks(prev => prev.map(task => task.id === id ? updatedTask : task));
      return true;
    } catch (error) {
      console.error('Failed to toggle task complete:', error);
      setError(error instanceof Error ? error.message : 'Failed to update task');
      return false;
    }
  }, [canDoListPageService, setError]);

  const handleDeleteTask = useCallback(async (id: string): Promise<boolean> => {
    if (!canDoListPageService) return false;

    try {
      await canDoListPageService.deleteTask(id);
      setTasks(prev => prev.filter(task => task.id !== id));
      return true;
    } catch (error) {
      console.error('Failed to delete task:', error);
      setError(error instanceof Error ? error.message : 'Failed to delete task');
      return false;
    }
  }, [canDoListPageService, setError]);

  const handleBulkDeleteCompleted = useCallback(async (projectId?: string): Promise<number> => {
    if (!canDoListPageService) return 0;

    try {
      const deletedCount = await canDoListPageService.bulkDeleteCompletedTasks(projectId);
      
      // Refresh tasks to reflect deletions
      const updatedTasks = await canDoListPageService.taskService.getTasks();
      setTasks(updatedTasks);
      
      return deletedCount;
    } catch (error) {
      console.error('Failed to bulk delete completed tasks:', error);
      setError(error instanceof Error ? error.message : 'Failed to delete tasks');
      return 0;
    }
  }, [canDoListPageService, setError]);

  const handleReorderTasks = useCallback(async (sourceIndex: number, destinationIndex: number, projectId?: string): Promise<boolean> => {
    if (!canDoListPageService) return false;

    try {
      const success = await canDoListPageService.reorderTasks(sourceIndex, destinationIndex, projectId);
      
      if (success) {
        // Refresh tasks to reflect new order
        const updatedTasks = await canDoListPageService.taskService.getTasks();
        setTasks(updatedTasks);
      }
      
      return success;
    } catch (error) {
      console.error('Failed to reorder tasks:', error);
      setError(error instanceof Error ? error.message : 'Failed to reorder tasks');
      return false;
    }
  }, [canDoListPageService, setError]);

  // Project methods
  const handleAddProject = useCallback(async (name: string, description?: string, color?: string, parentId?: string): Promise<boolean> => {
    if (!canDoListPageService) return false;

    try {
      const { project } = await canDoListPageService.createProject(name, description, color, parentId);
      setProjects(prev => [...prev, project]);
      return true;
    } catch (error) {
      console.error('Failed to add project:', error);
      setError(error instanceof Error ? error.message : 'Failed to add project');
      return false;
    }
  }, [canDoListPageService, setError]);

  const handleUpdateProject = useCallback(async (id: string, updateData: any): Promise<boolean> => {
    if (!canDoListPageService) return false;

    try {
      const updatedProject = await canDoListPageService.updateProject(id, updateData);
      setProjects(prev => prev.map(project => project.id === id ? updatedProject : project));
      return true;
    } catch (error) {
      console.error('Failed to update project:', error);
      setError(error instanceof Error ? error.message : 'Failed to update project');
      return false;
    }
  }, [canDoListPageService, setError]);

  const handleDeleteProject = useCallback(async (id: string): Promise<boolean> => {
    if (!canDoListPageService) return false;

    try {
      const targetProjectId = await canDoListPageService.deleteProjectWithTasks(id);
      
      // Refresh both projects and tasks
      const [updatedProjects, updatedTasks] = await Promise.all([
        canDoListPageService.projectService.getProjects(),
        canDoListPageService.taskService.getTasks()
      ]);
      
      // Update state in a single batch to prevent UI inconsistencies
      setProjects(updatedProjects);
      setTasks(updatedTasks);
      
      // Clear any existing errors
      setError(null);
      
      return true;
    } catch (error) {
      console.error('Failed to delete project:', error);
      setError(error instanceof Error ? error.message : 'Failed to delete project');
      return false;
    }
  }, [canDoListPageService, setError]);

  const handleBulkReorderProjects = useCallback(async (projectUpdates: Array<{ id: string; displayOrder: number; parentId?: string }>): Promise<boolean> => {
    if (!canDoListPageService) return false;

    try {
      await canDoListPageService.reorderProjects(projectUpdates);
      
      // Refresh projects to reflect new order
      const updatedProjects = await canDoListPageService.projectService.getProjects();
      setProjects(updatedProjects);
      
      return true;
    } catch (error) {
      console.error('Failed to reorder projects:', error);
      setError(error instanceof Error ? error.message : 'Failed to reorder projects');
      return false;
    }
  }, [canDoListPageService, setError]);

  const handleUpdateProjectCollapsedState = useCallback(async (id: string, isCollapsed: boolean): Promise<boolean> => {
    if (!canDoListPageService) return false;

    try {
      const updatedProject = await canDoListPageService.toggleProjectCollapse(id, isCollapsed);
      setProjects(prev => prev.map(project => project.id === id ? updatedProject : project));
      return true;
    } catch (error) {
      console.error('Failed to update project collapsed state:', error);
      setError(error instanceof Error ? error.message : 'Failed to update project');
      return false;
    }
  }, [canDoListPageService, setError]);

  // Load functions for compatibility with existing components
  const loadTasks = useCallback(async () => {
    if (!canDoListPageService) return;

    try {
      setIsLoadingTasks(true);
      const updatedTasks = await canDoListPageService.taskService.getTasks();
      setTasks(updatedTasks);
    } catch (error) {
      console.error('Failed to load tasks:', error);
      setError(error instanceof Error ? error.message : 'Failed to load tasks');
    } finally {
      setIsLoadingTasks(false);
    }
  }, [canDoListPageService, setError]);

  const loadProjects = useCallback(async () => {
    if (!canDoListPageService) return;

    try {
      setIsLoadingProjects(true);
      const updatedProjects = await canDoListPageService.projectService.getProjects();
      setProjects(updatedProjects);
    } catch (error) {
      console.error('Failed to load projects:', error);
      setError(error instanceof Error ? error.message : 'Failed to load projects');
    } finally {
      setIsLoadingProjects(false);
    }
  }, [canDoListPageService, setError]);

  return (
    <CanDoListMain
      // Data
      tasks={tasks}
      projects={projects}
      isLoadingTasks={isLoadingTasks}
      isLoadingProjects={isLoadingProjects}
      isLoadingKey={isLoadingKey}
      encryptionKey={encryptionKey}
      
      // Task methods
      handleAddTask={handleAddTask}
      handleUpdateTask={handleUpdateTask}
      handleToggleComplete={handleToggleComplete}
      handleDeleteTask={handleDeleteTask}
      handleBulkDeleteCompleted={handleBulkDeleteCompleted}
      handleReorderTasks={handleReorderTasks}
      loadTasks={loadTasks}
      
      // Project methods
      handleAddProject={handleAddProject}
      handleUpdateProject={handleUpdateProject}
      handleDeleteProject={handleDeleteProject}
      handleBulkReorderProjects={handleBulkReorderProjects}
      handleUpdateProjectCollapsedState={handleUpdateProjectCollapsedState}
      loadProjects={loadProjects}
    />
  );
}

export default function CanDoListPage() {
  return (
    <div className="w-full h-full">
      <ErrorProvider>
        <CanDoListContent />
      </ErrorProvider>
    </div>
  );
}