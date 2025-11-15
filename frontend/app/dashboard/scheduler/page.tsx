'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { CanDoListPageService } from '../can-do-list/can-do-list-page-service';
import { useEncryptionKey } from '@/hooks/cryptography/useEncryptionKey';
import { ErrorProvider, useError } from '@/utils/context/ErrorContext';
import { SchedulerPageService } from './scheduler-page-service';
import { getDecryptedBackend } from '@/utils/api/decrypted-backend';
import { CanDoItemDecrypted, ProjectDecrypted, RealtimeSubscription, RealtimeMessage } from '@/utils/api/types';
import { CalendarEvent, Calendar } from '@/utils/calendar/calendar-types';
import { CalendarFullControlCrossPlatform } from '@/components/dashboard/calendar/calendar-full-control-cross-platform';
import CanDoListMain from '@/components/dashboard/can-do-list/can-do-list-main';
import { LayoutList, Calendar as CalendarIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ButtonGroup, ButtonGroupSeparator } from '@/components/ui/button-group';
import { cn } from '@/lib/shadcn-utils';


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
  const handleToggleComplete = async (id: string, completed: boolean): Promise<boolean> => {
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
  };

  const handleDeleteTask = async (id: string): Promise<boolean> => {
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
  };

  const handleUpdateTask = async (id: string, content: string, estimatedDuration?: number, projectId?: string, impact?: number, urgency?: number, dueDate?: Date, blockedBy?: string, myDay?: boolean): Promise<boolean> => {
    if (!canDoListPageService) return false;

    try {
      const updatedTask = await canDoListPageService.updateTask(
        id, content, estimatedDuration, projectId, impact, urgency, dueDate, blockedBy, myDay
      );
      setTasks(prev => prev.map(task => task.id === id ? updatedTask : task));
      return true;
    } catch (error) {
      console.error('Failed to update task:', error);
      setError(error instanceof Error ? error.message : 'Failed to update task');
      return false;
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

  // Bulk delete completed tasks handler
  const handleBulkDeleteCompleted = async (projectId?: string): Promise<number> => {
    if (!canDoListPageService) return 0;

    try {
      const completedTasks = tasks.filter(task => 
        task.completed && (!projectId || task.project_id === projectId)
      );
      
      let deletedCount = 0;
      for (const task of completedTasks) {
        await canDoListPageService.deleteTask(task.id);
        deletedCount++;
      }
      
      // Refresh tasks
      const updatedTasks = await canDoListPageService.taskService.getTasks();
      setTasks(updatedTasks);
      
      return deletedCount;
    } catch (error) {
      console.error('Failed to bulk delete completed tasks:', error);
      setError(error instanceof Error ? error.message : 'Failed to delete completed tasks');
      return 0;
    }
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
        isAllDay: updatedEvent.all_day,
        isGroupEvent: updatedEvent.is_group_event,
        parentGroupEventId: updatedEvent.parent_group_event_id,
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

  // View state for showing/hiding panels
  const [showTaskList, setShowTaskList] = useState(true);
  const [showCalendar, setShowCalendar] = useState(true);
  
  // Handlers for toggling view panels (with constraint that at least one must be visible)
  const handleToggleTaskList = () => {
    // Only allow toggling off if calendar is visible
    if (showTaskList && showCalendar) {
      setShowTaskList(false);
    } else if (!showTaskList) {
      setShowTaskList(true);
    }
  };

  const handleToggleCalendar = () => {
    // Only allow toggling off if task list is visible
    if (showCalendar && showTaskList) {
      setShowCalendar(false);
    } else if (!showCalendar) {
      setShowCalendar(true);
    }
  };

  // Get default calendar for creating events from tasks
  const defaultCalendar = calendars.find((cal: Calendar) => cal.is_default) || calendars[0];

  // Wrapper functions to match CanDoListMain expected signatures (return boolean)
  const wrappedHandleToggleCompleteBoolean = async (id: string, completed: boolean): Promise<boolean> => {
    return await handleToggleComplete(id, completed);
  };

  const wrappedHandleDeleteTaskBoolean = async (id: string): Promise<boolean> => {
    return await handleDeleteTask(id);
  };

  const wrappedHandleUpdateTaskBoolean = async (
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
    if (content !== undefined) {
      return await handleUpdateTask(id, content, duration, projectId, impact, urgency, dueDate, blockedBy, myDay);
    }
    return false;
  };

  // Wrapper functions for mobile view (return void)
  const wrappedHandleToggleCompleteVoid = async (id: string, completed: boolean): Promise<void> => {
    await handleToggleComplete(id, completed);
  };

  const wrappedHandleDeleteTaskVoid = async (id: string): Promise<void> => {
    await handleDeleteTask(id);
  };

  const wrappedHandleUpdateTaskVoid = async (
    id: string,
    content: string,
    estimatedDuration?: number,
    projectId?: string,
    impact?: number,
    urgency?: number,
    dueDate?: Date,
    blockedBy?: string,
    myDay?: boolean
  ): Promise<void> => {
    await handleUpdateTask(id, content, estimatedDuration, projectId, impact, urgency, dueDate, blockedBy, myDay);
  };

  const wrappedLoadTasks = async (): Promise<void> => {
    await loadTasks();
  };

  const wrappedLoadProjects = async (): Promise<void> => {
    await loadProjects();
  };


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

      {/* Desktop Layout */}
      <div className="hidden md:flex flex-col w-full">
          {/* Top Navigation Bar */}
          <div className="border-b bg-background px-4 py-2 flex items-center justify-center">
            <ButtonGroup>
              <Button
                variant={showTaskList ? "default" : "outline"}
                size="sm"
                onClick={handleToggleTaskList}
                disabled={showTaskList && !showCalendar}
                className={cn(
                  "flex items-center gap-2",
                  showTaskList && !showCalendar && "opacity-100 cursor-not-allowed"
                )}
              >
                <LayoutList className="h-4 w-4" />
                <span>Can-Do List</span>
              </Button>
              <ButtonGroupSeparator />
              <Button
                variant={showCalendar ? "default" : "outline"}
                size="sm"
                onClick={handleToggleCalendar}
                disabled={showCalendar && !showTaskList}
                className={cn(
                  "flex items-center gap-2",
                  showCalendar && !showTaskList && "opacity-100 cursor-not-allowed"
                )}
              >
                <CalendarIcon className="h-4 w-4" />
                <span>Calendar</span>
              </Button>
            </ButtonGroup>
          </div>

          {/* Main Content Area */}
          <div className="flex flex-1 overflow-hidden">
            {/* Can-Do List - Desktop (only show when task list is visible) */}
            {showTaskList && (
              <div className={cn(
                "transition-all duration-300 h-full overflow-hidden",
                showCalendar ? 'w-1/2' : 'flex-1'
              )}>
                <CanDoListMain
                  tasks={tasks}
                  projects={projects}
                  isLoadingTasks={isLoadingTasks}
                  isLoadingProjects={isLoadingProjects}
                  isLoadingKey={isLoadingKey}
                  encryptionKey={encryptionKey}
                  handleAddTask={handleAddTask}
                  handleUpdateTask={wrappedHandleUpdateTaskBoolean}
                  handleToggleComplete={wrappedHandleToggleCompleteBoolean}
                  handleDeleteTask={wrappedHandleDeleteTaskBoolean}
                  handleBulkDeleteCompleted={handleBulkDeleteCompleted}
                  handleReorderTasks={handleReorderTasks}
                  loadTasks={wrappedLoadTasks}
                  handleAddProject={handleAddProject}
                  handleUpdateProject={handleUpdateProject}
                  handleDeleteProject={handleDeleteProject}
                  handleBulkReorderProjects={handleBulkReorderProjects}
                  handleUpdateProjectCollapsedState={handleUpdateProjectCollapsedState}
                  loadProjects={wrappedLoadProjects}
                  containerClassName="flex w-full h-full"
                />
              </div>
            )}

            {/* Calendar - Desktop (only show when calendar is visible) */}
            {showCalendar && (
              <div className={cn("h-full overflow-hidden", showTaskList ? "flex-1" : "w-full")}>
            <CalendarFullControlCrossPlatform
              calendars={calendars}
              events={calendarEvents}
              icsEvents={icsEvents}
              isLoading={isLoadingCalendar}
              onCalendarToggle={handleCalendarToggle}
              onCalendarCreate={handleCalendarCreate}
              onICSCalendarCreate={handleICSCalendarCreate}
              onICSCalendarRefresh={handleICSCalendarRefresh}
              onCalendarEdit={handleCalendarEdit}
              onCalendarDelete={handleCalendarDelete}
              onSetDefaultCalendar={handleSetDefaultCalendar}
              onSubmitEvent={handleSubmitEvent}
              onDeleteEvent={handleDeleteEvent}
              onCloneEvent={handleCloneEvent}
              onEventUpdate={onEventUpdate}
              moveEventToCalendar={moveEventToCalendar}
              onRefreshICSCalendar={handleICSCalendarRefresh}
              isICSEvent={(event) => schedulerPageService?.isICSEvent(event, calendars) || false}
              isReadOnlyCalendar={(calendarId) => schedulerPageService?.isReadOnlyCalendar(calendarId, calendars) || false}
            />
              </div>
            )}
          </div>
        </div>
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