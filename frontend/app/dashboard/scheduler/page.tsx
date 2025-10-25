'use client';

import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { CanDoListPageService } from '../can-do-list/can-do-list-page-service';
import { useEncryptionKey } from '@/hooks/cryptography/useEncryptionKey';
import { ErrorProvider, useError } from '@/utils/context/ErrorContext';
import { SchedulerPageService } from './scheduler-page-service';
import { getDecryptedBackend } from '@/utils/api/decrypted-backend';
import { CanDoItemDecrypted, ProjectDecrypted, RealtimeSubscription, RealtimeMessage } from '@/utils/api/types';
import { CalendarEvent, Calendar } from '@/utils/calendar/calendar-types';
import { DndContext, DragEndEvent, DragStartEvent, DragOverlay, pointerWithin } from '@dnd-kit/core';
import { SchedulerTaskList, SchedulerCalendar, SchedulerTaskItem, SchedulerMobile } from '@/components/dashboard/scheduler';
import ProjectSidebarDynamic from '@/components/dashboard/can-do-list/project-bar/project-sidebar-dynamic';
import { addMinutes, format } from 'date-fns';
import { List } from 'lucide-react';
import TaskListItem from '@/components/dashboard/can-do-list/task-list-item';
import { TaskSearchInput, TaskSearchWithFilter } from '@/components/dashboard/shared/task-search-input';
import { getRecommendedTasks } from '@/utils/can-do-list/recommendation-utils';


function SchedulerPageContent() {
  const { encryptionKey, isLoading: isLoadingKey } = useEncryptionKey();
  const { setError } = useError();

  // Initialize scheduler service (only in browser)
  const [schedulerPageService] = useState(() => {
    if (typeof window !== 'undefined') {
      return new SchedulerPageService(getDecryptedBackend());
    }
    return null;
  });

  // Calendar state
  const [calendars, setCalendars] = useState<Calendar[]>([]);
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);
  const [icsEvents, setIcsEvents] = useState<CalendarEvent[]>([]);
  const [isLoadingCalendar, setIsLoadingCalendar] = useState(false);

  // Can-do list state
  const [tasks, setTasks] = useState<CanDoItemDecrypted[]>([]);
  const [projects, setProjects] = useState<ProjectDecrypted[]>([]);
  const [isLoadingTasks, setIsLoadingTasks] = useState(false);
  const [isLoadingProjects, setIsLoadingProjects] = useState(false);

  // Initialize can-do list service (only in browser)
  const [canDoListPageService] = useState(() => {
    if (typeof window !== 'undefined') {
      return new CanDoListPageService(getDecryptedBackend());
    }
    return null;
  });

  // Store websocket subscriptions
  const subscriptionsRef = useRef<RealtimeSubscription[]>([]);

  // Load can-do list data when encryption key becomes available
  useEffect(() => {
    const loadCanDoListData = async () => {
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
      } catch (error) {
        console.error('Failed to load can-do list data:', error);
        setError(error instanceof Error ? error.message : 'Failed to load data');
      } finally {
        setIsLoadingTasks(false);
        setIsLoadingProjects(false);
      }
    };

    loadCanDoListData();
  }, [encryptionKey, canDoListPageService, setError]);

  // Set up websocket subscriptions for real-time updates
  useEffect(() => {
    if (!canDoListPageService || !encryptionKey) return;

    const backend = getDecryptedBackend();
    
    // Subscribe to can-do list changes
    const canDoSubscription = backend.canDoList.subscribe((payload: RealtimeMessage<CanDoItemDecrypted>) => {
      console.log('Can-do item websocket message (scheduler):', payload);
      
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
      console.log('Project websocket message (scheduler):', payload);
      
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

  // Wrapper functions to match expected signatures
  const handleToggleComplete = async (id: string, completed: boolean): Promise<void> => {
    if (!canDoListPageService) return;

    try {
      const updatedTask = await canDoListPageService.toggleTaskComplete(id, completed);
      setTasks(prev => prev.map(task => task.id === id ? updatedTask : task));
    } catch (error) {
      console.error('Failed to toggle task complete:', error);
      setError(error instanceof Error ? error.message : 'Failed to update task');
    }
  };

  const handleDeleteTask = async (id: string): Promise<void> => {
    if (!canDoListPageService) return;

    try {
      await canDoListPageService.deleteTask(id);
      setTasks(prev => prev.filter(task => task.id !== id));
    } catch (error) {
      console.error('Failed to delete task:', error);
      setError(error instanceof Error ? error.message : 'Failed to delete task');
    }
  };

  const handleUpdateTask = async (id: string, content: string, estimatedDuration?: number, projectId?: string, impact?: number, urgency?: number, dueDate?: Date, blockedBy?: string, myDay?: boolean): Promise<void> => {
    if (!canDoListPageService) return;

    try {
      const updatedTask = await canDoListPageService.updateTask(
        id, content, estimatedDuration, projectId, impact, urgency, dueDate, blockedBy, myDay
      );
      setTasks(prev => prev.map(task => task.id === id ? updatedTask : task));
    } catch (error) {
      console.error('Failed to update task:', error);
      setError(error instanceof Error ? error.message : 'Failed to update task');
    }
  };

  const handleAddTask = async (
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
  };

  const handleReorderTasks = async (sourceIndex: number, destinationIndex: number, projectId?: string): Promise<boolean> => {
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
  };

  // Project wrapper functions
  const handleAddProject = async (name: string, description?: string, color?: string, parentId?: string): Promise<boolean> => {
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
  };

  const handleUpdateProject = async (id: string, updateData: any): Promise<boolean> => {
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
  };

  const handleDeleteProject = async (id: string): Promise<boolean> => {
    if (!canDoListPageService) return false;

    try {
      await canDoListPageService.deleteProjectWithTasks(id);
      
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
  };

  const handleBulkReorderProjects = async (projectUpdates: Array<{ id: string; displayOrder: number; parentId?: string }>): Promise<boolean> => {
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
  };

  const handleUpdateProjectCollapsedState = async (id: string, isCollapsed: boolean): Promise<boolean> => {
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
  };

  // Load functions for compatibility
  const loadTasks = async (): Promise<CanDoItemDecrypted[]> => {
    if (!canDoListPageService) return [];

    try {
      setIsLoadingTasks(true);
      const updatedTasks = await canDoListPageService.taskService.getTasks();
      setTasks(updatedTasks);
      return updatedTasks;
    } catch (error) {
      console.error('Failed to load tasks:', error);
      setError(error instanceof Error ? error.message : 'Failed to load tasks');
      return [];
    } finally {
      setIsLoadingTasks(false);
    }
  };

  const loadProjects = async (): Promise<ProjectDecrypted[]> => {
    if (!canDoListPageService) return [];

    try {
      setIsLoadingProjects(true);
      const updatedProjects = await canDoListPageService.projectService.getProjects();
      setProjects(updatedProjects);
      return updatedProjects;
    } catch (error) {
      console.error('Failed to load projects:', error);
      setError(error instanceof Error ? error.message : 'Failed to load projects');
      return [];
    } finally {
      setIsLoadingProjects(false);
    }
  };

  // Handle toggling My Day status for a task
  const handleToggleMyDay = async (id: string) => {
    const task = tasks.find(t => t.id === id);
    if (!task) return;
    
    const newMyDayStatus = !task.my_day;
    await handleUpdateTask(
      id, 
      task.content, 
      task.duration_minutes, 
      task.project_id, 
      undefined, // impact 
      undefined, // urgency
      task.due_date ? new Date(task.due_date) : undefined, 
      task.blocked_by, 
      newMyDayStatus
    );
  };

  // Load calendar data
  useEffect(() => {
    const loadCalendarData = async () => {
      if (!schedulerPageService) {
        console.error('Scheduler page service not initialized');
        return;
      }

      try {
        setIsLoadingCalendar(true);
        
        // Load all calendar and event data together
        const { calendars, events } = await schedulerPageService.loadSchedulerData();
        setCalendars(calendars);
        setCalendarEvents(events);
        
        // Load ICS events
        const icsEventsData = await schedulerPageService.fetchAllICSEvents(calendars);
        setIcsEvents(icsEventsData);
      } catch (error) {
        console.error('Failed to load calendar data:', error);
        setError('Failed to load calendar data');
      } finally {
        setIsLoadingCalendar(false);
      }
    };
    
    loadCalendarData();
  }, [schedulerPageService, setError]);

  // Calendar handlers
  const handleCalendarToggle = useCallback(async (calendarId: string, isVisible: boolean): Promise<void> => {
    if (!schedulerPageService) return;
    
    try {
      const updatedCalendar = await schedulerPageService.toggleCalendarVisibility(calendarId, isVisible);
      setCalendars(prev => prev.map(cal => 
        cal.id === calendarId 
          ? { ...cal, ...updatedCalendar }
          : cal
      ));
    } catch (error) {
      setError('Failed to update calendar visibility');
    }
  }, [schedulerPageService, setError]);

  const handleCalendarCreate = useCallback(async (name: string, color: string): Promise<Calendar> => {
    if (!schedulerPageService) throw new Error('Service not available');
    
    try {
      const { calendar, shouldRefreshEvents } = await schedulerPageService.createCalendar(name, color);
      setCalendars(prev => [...prev, calendar]);
      
      if (shouldRefreshEvents) {
        const { events } = await schedulerPageService.loadSchedulerData();
        setCalendarEvents(events);
      }
      
      return calendar;
    } catch (error) {
      setError('Failed to create calendar');
      throw error;
    }
  }, [schedulerPageService, setError]);

  const handleICSCalendarCreate = useCallback(async (name: string, color: string, icsUrl: string): Promise<Calendar> => {
    if (!schedulerPageService) throw new Error('Service not available');
    
    try {
      const { calendar, shouldRefreshEvents } = await schedulerPageService.createICSCalendar(name, color, icsUrl);
      setCalendars(prev => [...prev, calendar]);
      
      if (shouldRefreshEvents) {
        const icsEventsData = await schedulerPageService.fetchICSEventsForCalendar(calendar);
        setIcsEvents(prev => [...prev, ...icsEventsData]);
      }
      
      return calendar;
    } catch (error) {
      setError('Failed to create ICS calendar');
      throw error;
    }
  }, [schedulerPageService, setError]);

  const handleICSCalendarRefresh = useCallback(async (calendarId: string): Promise<void> => {
    if (!schedulerPageService) return;
    
    try {
      const { events, calendar } = await schedulerPageService.refreshICSEventsForCalendar(calendarId, calendars);
      setCalendars(prev => prev.map(cal => cal.id === calendarId ? calendar : cal));
      
      // Update ICS events
      setIcsEvents(prev => [
        ...prev.filter(event => event.calendar_id !== calendarId),
        ...events
      ]);
    } catch (error) {
      setError('Failed to refresh ICS calendar');
    }
  }, [schedulerPageService, calendars, setError]);

  const handleCalendarEdit = useCallback(async (id: string, name: string, color: string): Promise<void> => {
    if (!schedulerPageService) return;
    
    try {
      const updatedCalendar = await schedulerPageService.editCalendar(id, name, color);
      setCalendars(prev => prev.map(cal => 
        cal.id === id 
          ? { ...cal, ...updatedCalendar }
          : cal
      ));
    } catch (error) {
      setError('Failed to update calendar');
    }
  }, [schedulerPageService, setError]);

  const handleCalendarDelete = useCallback(async (calendarId: string): Promise<string | undefined> => {
    if (!schedulerPageService) return undefined;
    
    try {
      const targetCalendarId = await schedulerPageService.deleteCalendarWithEvents(
        calendarId,
        async (eventId: string, targetCalId: string) => {
          // Move event to target calendar (implementation depends on your requirements)
          await schedulerPageService.moveEventToCalendar(eventId, targetCalId);
        }
      );
      
      // Remove calendar from state
      setCalendars(prev => prev.filter(cal => cal.id !== calendarId));
      
      // Remove events for deleted calendar and refresh events from target calendar
      if (targetCalendarId) {
        const { events: updatedEvents } = await schedulerPageService.loadSchedulerData();
        setCalendarEvents(updatedEvents);
      }
      
      return targetCalendarId;
    } catch (error) {
      setError('Failed to delete calendar');
      return undefined;
    }
  }, [schedulerPageService, setError]);

  const handleSetDefaultCalendar = useCallback(async (calendarId: string): Promise<void> => {
    if (!schedulerPageService) return;
    
    try {
      await schedulerPageService.setDefaultCalendar(calendarId);
      // Update all calendars - unset previous default and set new one
      setCalendars(prev => prev.map(cal => ({
        ...cal,
        is_default: cal.id === calendarId
      })));
    } catch (error) {
      setError('Failed to set default calendar');
    }
  }, [schedulerPageService, setError]);

  const handleSubmitEvent = useCallback(async (values: any): Promise<boolean> => {
    if (!schedulerPageService) return false;
    
    try {
      const { event, isUpdate } = await schedulerPageService.submitEvent(values);
      
      if (isUpdate) {
        setCalendarEvents(prev => prev.map(e => e.id === event.id ? event : e));
      } else {
        setCalendarEvents(prev => [...prev, event]);
      }
      
      return true;
    } catch (error) {
      setError('Failed to save event');
      return false;
    }
  }, [schedulerPageService, setError]);

  const handleDeleteEvent = useCallback(async (eventId: string): Promise<boolean> => {
    if (!schedulerPageService) return false;
    
    try {
      await schedulerPageService.deleteEvent(eventId);
      setCalendarEvents(prev => prev.filter(event => event.id !== eventId));
      return true;
    } catch (error) {
      setError('Failed to delete event');
      return false;
    }
  }, [schedulerPageService, setError]);

  const handleCloneEvent = useCallback(async (event: CalendarEvent): Promise<boolean> => {
    if (!schedulerPageService) return false;
    
    try {
      const clonedEvent = await schedulerPageService.cloneEvent(event);
      setCalendarEvents(prev => [...prev, clonedEvent]);
      return true;
    } catch (error) {
      setError('Failed to clone event');
      return false;
    }
  }, [schedulerPageService, setError]);

  const onEventUpdate = useCallback(async (updatedEvent: CalendarEvent): Promise<boolean> => {
    if (!schedulerPageService) {
      console.error('No scheduler page service available');
      return false;
    }
    
    try {
      console.log('Scheduler onEventUpdate called with:', updatedEvent);
      const updateData = {
        title: updatedEvent.title,
        description: updatedEvent.description,
        location: updatedEvent.location,
        calendarId: updatedEvent.calendar_id, // IMPORTANT: Include calendar_id
        startTime: new Date(updatedEvent.start_time),
        endTime: new Date(updatedEvent.end_time),
        isAllDay: updatedEvent.all_day
      };
      console.log('Sending update data to service:', updateData);
      const eventWithUpdates = await schedulerPageService.updateEvent(updatedEvent.id, updateData);
      
      console.log('Event updated successfully:', eventWithUpdates);
      setCalendarEvents(prev => {
        const updated = prev.map(event => event.id === updatedEvent.id ? eventWithUpdates : event);
        console.log('Updated calendar events:', updated);
        return updated;
      });
      return true;
    } catch (error) {
      console.error('Error updating event:', error);
      setError('Failed to update event');
      return false;
    }
  }, [schedulerPageService, setError]);

  const moveEventToCalendar = useCallback(async (eventId: string, targetCalendarId: string): Promise<void> => {
    if (!schedulerPageService) return;
    
    try {
      const updatedEvent = await schedulerPageService.moveEventToCalendar(eventId, targetCalendarId);
      setCalendarEvents(prev => prev.map(event => event.id === eventId ? updatedEvent : event));
    } catch (error) {
      setError('Failed to move event');
    }
  }, [schedulerPageService, setError]);

  // Drag and drop state
  const [activeTask, setActiveTask] = useState<CanDoItemDecrypted | null>(null);
  const [isTaskbarCollapsed, setIsTaskbarCollapsed] = useState(false);
  
  // Project selection state for desktop view
  const [selectedProjectId, setSelectedProjectId] = useState<string | undefined>(undefined);
  const [isAllTasksSelected, setIsAllTasksSelected] = useState(false);
  const [isMyDaySelected, setIsMyDaySelected] = useState(false);
  const [isRecommendedSelected, setIsRecommendedSelected] = useState(false);
  
  // Search state - for the filtered tasks from search component
  const [searchFilteredTasks, setSearchFilteredTasks] = useState<CanDoItemDecrypted[]>([]);
  const [isSearchActive, setIsSearchActive] = useState(false);

  // Handle filtered tasks change from search component
  const handleFilteredTasksChange = (filteredTasks: CanDoItemDecrypted[], searchActive: boolean) => {
    setSearchFilteredTasks(filteredTasks);
    setIsSearchActive(searchActive);
  };



  // Load tasks and projects when encryption key becomes available
  useEffect(() => {
    if (encryptionKey) {
      loadProjects();
      loadTasks();
    }
  }, [encryptionKey, loadTasks, loadProjects]);

  // Get default calendar for creating events from tasks
  const defaultCalendar = calendars.find((cal: Calendar) => cal.is_default) || calendars[0];

  // Handle project selection for desktop view
  const handleProjectSelect = (projectId?: string) => {
    setSelectedProjectId(projectId);
    setIsAllTasksSelected(false);
    setIsMyDaySelected(false);
    setIsRecommendedSelected(false);
  };

  // Handle all tasks selection for desktop view
  const handleAllTasksSelect = () => {
    setIsAllTasksSelected(true);
    setSelectedProjectId(undefined);
    setIsMyDaySelected(false);
    setIsRecommendedSelected(false);
  };

  // Handle My Day selection for desktop view
  const handleMyDaySelect = () => {
    setIsMyDaySelected(true);
    setSelectedProjectId(undefined);
    setIsAllTasksSelected(false);
    setIsRecommendedSelected(false);
  };

  // Handle recommended tasks selection for desktop view
  const handleRecommendedSelect = () => {
    setIsRecommendedSelected(true);
    setSelectedProjectId(undefined);
    setIsAllTasksSelected(false);
    setIsMyDaySelected(false);
  };

  // Calculate task counts per project for sidebar
  const taskCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    
    // Count inbox tasks (tasks without project) - only active tasks
    counts['inbox'] = tasks.filter(task => !task.project_id && !task.completed).length;
    
    // Count active tasks per project
    projects.forEach(project => {
      counts[project.id] = tasks.filter(task => task.project_id === project.id && !task.completed).length;
    });
    
    // Count all active tasks
    counts['all'] = tasks.filter(task => !task.completed).length;
    
    // Count My Day tasks
    counts['myDay'] = tasks.filter(task => task.my_day && !task.completed).length;
    
    return counts;
  }, [tasks, projects]);

  // Base tasks filtering (without search) - search will be handled by TaskSearchWithFilter component
  const baseTasks = useMemo(() => {
    if (isRecommendedSelected) {
      return getRecommendedTasks(tasks, 20);
    } else if (isMyDaySelected) {
      return tasks.filter(task => task.my_day && !task.completed);
    } else if (isAllTasksSelected) {
      return tasks.filter(task => !task.completed);
    } else if (selectedProjectId) {
      return tasks.filter(task => task.project_id === selectedProjectId && !task.completed);
    } else {
      // Show tasks without project (inbox)
      return tasks.filter(task => !task.project_id && !task.completed);
    }
  }, [tasks, selectedProjectId, isAllTasksSelected, isMyDaySelected, isRecommendedSelected]);

  // Final filtered tasks (base tasks + search filter)
  const filteredTasks = useMemo(() => {
    if (isSearchActive) {
      // When search is active, show search results (even if empty)
      return searchFilteredTasks;
    }
    // When no search is active, show base tasks
    return baseTasks;
  }, [searchFilteredTasks, baseTasks, isSearchActive]);

  // Group tasks by project when in "All Tasks" mode for scheduler
  const groupedTasksScheduler = useMemo(() => {
    if (!isAllTasksSelected) {
      return null; // Return null when not in "All Tasks" mode
    }

    // Helper function to build full project path
    const getProjectPath = (projectId: string): string => {
      const project = projects.find(p => p.id === projectId);
      if (!project) return 'Unknown Project';
      
      if (!project.parent_id) {
        return project.name;
      }
      
      const parentPath = getProjectPath(project.parent_id);
      return `${parentPath} > ${project.name}`;
    };

    // Group filtered tasks by project
    const tasksByProject = new Map<string | undefined, CanDoItemDecrypted[]>();
    filteredTasks.forEach(task => {
      // Normalize null and undefined to be the same key for inbox tasks
      const projectId = task.project_id || undefined;
      if (!tasksByProject.has(projectId)) {
        tasksByProject.set(projectId, []);
      }
      tasksByProject.get(projectId)!.push(task);
    });

    // Create organized structure with project headers
    const organized: Array<{ type: 'project-header' | 'task'; data: ProjectDecrypted | CanDoItemDecrypted }> = [];

    // Add inbox section if there are inbox tasks
    const inboxTasks = tasksByProject.get(undefined) || [];
    if (inboxTasks.length > 0) {
      organized.push({ 
        type: 'project-header', 
        data: { id: 'inbox', name: 'Inbox', color: '#6b7280' } as ProjectDecrypted 
      });
      inboxTasks.forEach(task => organized.push({ type: 'task', data: task }));
    }

    // Add tasks grouped by projects with full paths
    projects
      .filter(project => tasksByProject.has(project.id))
      .sort((a, b) => getProjectPath(a.id).localeCompare(getProjectPath(b.id))) // Sort by full path
      .forEach(project => {
        const projectWithPath = {
          ...project,
          name: getProjectPath(project.id) // Override name with full path
        };
        organized.push({ type: 'project-header', data: projectWithPath });
        const projectTasks = tasksByProject.get(project.id) || [];
        projectTasks.forEach(task => organized.push({ type: 'task', data: task }));
      });

    return organized;
  }, [filteredTasks, projects, isAllTasksSelected]);

  // Organize tasks by project for flat hierarchy display (mobile view)
  const organizedTasks = useMemo(() => {
    const organized: Array<{ type: 'project' | 'task'; data: ProjectDecrypted | CanDoItemDecrypted }> = [];
    
    // Get active (non-completed) tasks only
    const activeTasks = tasks.filter(task => !task.completed);
    
    // Group tasks by project
    const tasksByProject = new Map<string | undefined, CanDoItemDecrypted[]>();
    activeTasks.forEach(task => {
      const projectId = task.project_id;
      if (!tasksByProject.has(projectId)) {
        tasksByProject.set(projectId, []);
      }
      tasksByProject.get(projectId)!.push(task);
    });

    // Add inbox tasks (tasks without project)
    const inboxTasks = tasksByProject.get(undefined) || [];
    if (inboxTasks.length > 0) {
      organized.push({ type: 'project', data: { id: 'inbox', name: 'Inbox', color: '#6b7280' } as ProjectDecrypted });
      inboxTasks.forEach(task => organized.push({ type: 'task', data: task }));
    }

    // Add tasks grouped by projects
    projects
      .filter(project => tasksByProject.has(project.id))
      .forEach(project => {
        organized.push({ type: 'project', data: project });
        const projectTasks = tasksByProject.get(project.id) || [];
        projectTasks.forEach(task => organized.push({ type: 'task', data: task }));
      });

    return organized;
  }, [tasks, projects]);

  // Use pointer-based collision detection for precise targeting
  const pointerCollisionDetection = useCallback((args: any) => {
    // Use pointerWithin for the most accurate collision detection
    // This will only detect collisions where the mouse pointer is actually located
    return pointerWithin(args);
  }, []);

  // Handle drag start
  const handleDragStart = useCallback((event: DragStartEvent) => {
    const taskId = event.active.id as string;
    const task = tasks.find(t => t.id === taskId);
    if (task) {
      setActiveTask(task);
      setIsTaskbarCollapsed(true);
    }
  }, [tasks]);

  // Handle drag end
  const handleDragEnd = useCallback(async (event: DragEndEvent) => {
    setActiveTask(null);
    setIsTaskbarCollapsed(false);

    const { active, over } = event;
    
    if (!over || !activeTask || !defaultCalendar) return;

    // Debug logging
    console.log('Drag end event:', {
      overId: over.id,
      overData: over.data?.current,
      activeTaskId: activeTask?.id,
      activeTaskContent: activeTask?.content
    });

    // Check if dropped on a quarter-hour time slot
    if (over.id.toString().startsWith('quarter-') && over.data?.current?.time) {
      const dropTime = over.data.current.time as Date;
      const dropDate = over.data.current.date as Date;
      
      console.log('Dropping task on:', {
        dropTime: format(dropTime, 'yyyy-MM-dd HH:mm'),
        dropDate: format(dropDate, 'yyyy-MM-dd'),
        overId: over.id
      });
      
      // Create calendar event from task directly
      const startTime = new Date(dropTime);
      const duration = activeTask?.duration_minutes || 60; // Default 1 hour in minutes
      const endTime = addMinutes(startTime, duration);

      const eventData = {
        title: activeTask?.content || '',
        description: `Scheduled from task: ${activeTask?.content || ''}`,
        startDate: format(startTime, 'yyyy-MM-dd'),
        startTime: format(startTime, 'HH:mm'),
        endDate: format(endTime, 'yyyy-MM-dd'),
        endTime: format(endTime, 'HH:mm'),
        calendarId: defaultCalendar.id
      };

      try {
        await handleSubmitEvent(eventData);
        console.log('Successfully created event:', eventData);
        // Task remains active - just linked to calendar event
      } catch (error) {
        console.error('Error creating event from task:', error);
        setError('Failed to create calendar event from task');
      }
    } else {
      console.log('Drop target not recognized:', over.id);
    }
  }, [activeTask, defaultCalendar, handleSubmitEvent, setError]);

  if (isLoadingKey) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-gray-900 mx-auto mb-4"></div>
          <p>Loading encryption key...</p>
        </div>
      </div>
    );
  }

  if (!encryptionKey) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <p className="text-red-600 mb-4">Encryption key not available</p>
          <p>Please refresh the page and try again.</p>
        </div>
      </div>
    );
  }

    // Create wrapper functions to match expected signatures
  const handleSubmitEventWrapper = async (eventData: any): Promise<void> => {
    const result = await handleSubmitEvent(eventData);
    // Convert result to void
  };

  const handleDeleteEventWrapper = async (id: string): Promise<void> => {
    const result = await handleDeleteEvent(id);
    // Convert result to void
  };

  return (
    <div className="flex h-screen w-full">
      {/* Mobile Layout */}
      <div className="md:hidden w-full">
        <SchedulerMobile
          tasks={tasks}
          projects={projects}  
          events={[...calendarEvents, ...icsEvents]}
          calendars={calendars}
          onToggleComplete={handleToggleComplete}
          onDeleteTask={handleDeleteTask}
          onUpdateTask={handleUpdateTask}
          onToggleMyDay={handleToggleMyDay}
          onEventUpdate={onEventUpdate}
          onSubmitEvent={handleSubmitEventWrapper}
          onDeleteEvent={handleDeleteEventWrapper}
          onClone={handleCloneEvent}
          isLoading={isLoadingTasks || isLoadingProjects || isLoadingCalendar}
        />
      </div>

      {/* Desktop Layout */}
      <DndContext 
        onDragStart={handleDragStart} 
        onDragEnd={handleDragEnd}
        collisionDetection={pointerCollisionDetection}
      >
        <div className="hidden md:flex w-full">
          {/* Project Sidebar - Desktop */}
          <div className={`transition-all duration-300 ${isTaskbarCollapsed ? 'w-16' : 'w-1/6'}`}>
            <ProjectSidebarDynamic
              projects={projects}
              tasks={tasks}
              selectedProjectId={selectedProjectId}
              onProjectSelect={handleProjectSelect}
              onRecommendedSelect={handleRecommendedSelect}
              onAllTasksSelect={handleAllTasksSelect}
              onMyDaySelect={handleMyDaySelect}
              onAddProject={handleAddProject}
              onUpdateProject={handleUpdateProject}
              onDeleteProject={handleDeleteProject}
              onBulkReorderProjects={handleBulkReorderProjects}
              onUpdateProjectCollapsedState={handleUpdateProjectCollapsedState}
              isLoading={isLoadingTasks || isLoadingProjects}
              itemCounts={taskCounts}
              isCollapsed={isTaskbarCollapsed}
              isRecommendedSelected={isRecommendedSelected}
              isAllTasksSelected={isAllTasksSelected}
              isMyDaySelected={isMyDaySelected}
            />
          </div>

          {/* Tasks Panel - Desktop */}
          <div className={`transition-all duration-300 ${isTaskbarCollapsed ? 'w-16' : 'w-2/6'} border-r bg-background`}>
            {isAllTasksSelected && groupedTasksScheduler ? (
              <div className="flex flex-col h-full">
                <div className="border-b p-4">
                  <div className="flex items-center justify-between gap-3 mb-2">
                    <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                      <List className="h-4 w-4" />
                      <span>All Tasks</span>
                    </div>
                    <TaskSearchWithFilter
                      tasks={baseTasks}
                      projects={projects}
                      className="w-48"
                      onFilteredTasksChange={handleFilteredTasksChange}
                    />
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Drag tasks to calendar to schedule them
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto p-4">
                  <div className="space-y-4">
                    {groupedTasksScheduler.map((item, index) => {
                      if (item.type === 'project-header') {
                        const project = item.data as ProjectDecrypted;
                        return (
                          <div key={`project-header-${project.id}`} className="sticky top-0 bg-background/95 backdrop-blur-sm z-10 py-2">
                            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground border-b pb-2">
                              <div
                                className="w-3 h-3 rounded-full"
                                style={{ backgroundColor: project.color }}
                              />
                              <span>{project.name}</span>
                            </div>
                          </div>
                        );
                      } else {
                        const task = item.data as CanDoItemDecrypted;
                        return (
                          <div key={`task-${task.id}`} className="ml-4">
                            <TaskListItem
                              task={task}
                              onToggleComplete={handleToggleComplete}
                              onDeleteTask={handleDeleteTask}
                              onUpdateTask={handleUpdateTask}
                              onToggleMyDay={handleToggleMyDay}
                              projects={projects}
                            />
                          </div>
                        );
                      }
                    })}
                  </div>
                </div>
              </div>
            ) : (
              <SchedulerTaskList
                organizedTasks={[]} // Empty for desktop - we'll use filteredTasks instead
                filteredTasks={filteredTasks}
                selectedProjectId={selectedProjectId}
                onToggleComplete={handleToggleComplete}
                onDeleteTask={handleDeleteTask}
                onUpdateTask={handleUpdateTask}
                onToggleMyDay={handleToggleMyDay}
                projects={projects}
                isCollapsed={isTaskbarCollapsed}
                isLoading={isLoadingTasks || isLoadingProjects}
                baseTasks={baseTasks}
                onFilteredTasksChange={handleFilteredTasksChange}
                isRecommendedSelected={isRecommendedSelected}
                taskPool={tasks}
              />
            )}
          </div>

          {/* Calendar - Desktop */}
          <div className="flex-1 h-full overflow-hidden">
            <SchedulerCalendar
              events={[...calendarEvents, ...icsEvents]}
              calendars={calendars}
              onEventUpdate={onEventUpdate}
              onCalendarToggle={handleCalendarToggle}
              onCalendarCreate={handleCalendarCreate}
              onICSCalendarCreate={handleICSCalendarCreate}
              onICSCalendarRefresh={handleICSCalendarRefresh}
              onCalendarEdit={handleCalendarEdit}
              onCalendarDelete={handleCalendarDelete}
              onSetDefaultCalendar={handleSetDefaultCalendar}
              onClone={handleCloneEvent}
              isLoading={isLoadingCalendar}
              activeTask={activeTask}
            />
          </div>

          {/* Drag Overlay */}
          <DragOverlay style={{ opacity: 0.5, width: '200px', maxWidth: '200px' }}>
            {activeTask ? (
              <div style={{ width: '200px', maxWidth: '200px' }}>
                <SchedulerTaskItem
                  task={activeTask}
                  onToggleComplete={handleToggleComplete}
                  onDeleteTask={handleDeleteTask}
                  onUpdateTask={handleUpdateTask}
                  projects={projects}
                  isDragOverlay={true}
                />
              </div>
            ) : null}
          </DragOverlay>


        </div>
      </DndContext>
    </div>
  );
}

export default function SchedulerPage() {
  return (
    <div className="fixed top-16 left-0 right-0 bottom-0 overflow-hidden">
      <ErrorProvider>
        <SchedulerPageContent />
      </ErrorProvider>
    </div>
  );
} 