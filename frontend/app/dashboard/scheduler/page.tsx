'use client';

import { useState, useCallback, useMemo, useEffect } from 'react';
import { useCanDoList } from '@/hooks/can-do-list/useCanDoList';
import { useProjects } from '@/hooks/can-do-list/can-do-projects/useProjects';
import { useEncryptionKey } from '@/hooks/cryptography/useEncryptionKey';
import { useCalendar } from '@/hooks/calendar/useCalendar';
import { ErrorProvider, useError } from '@/utils/context/ErrorContext';
import { Task, Project } from '@/utils/can-do-list/can-do-list-types';
import { CalendarEvent, Calendar } from '@/utils/calendar/calendar-types';
import { DndContext, DragEndEvent, DragStartEvent, DragOverlay } from '@dnd-kit/core';
import { SchedulerTaskList, SchedulerCalendar, SchedulerTaskItem } from '@/components/dashboard/scheduler';
import ProjectSidebarDynamic from '@/components/dashboard/can-do-list/project-bar/project-sidebar-dynamic';
import { addMinutes, format } from 'date-fns';

function SchedulerPageContent() {
  const { encryptionKey, isLoading: isLoadingKey } = useEncryptionKey();
  const { setError } = useError();

  // Can-do list hooks
  const {
    tasks,
    isLoading: isLoadingTasks,
    loadTasks,
    handleAddTask,
    handleUpdateTask: updateTask,
    handleToggleComplete: toggleComplete,
    handleDeleteTask: deleteTask,
    handleReorderTasks
  } = useCanDoList(encryptionKey);

  const {
    projects,
    isLoading: isLoadingProjects,
    loadProjects,
    handleAddProject,
    handleUpdateProject,
    handleDeleteProject,
    handleBulkReorderProjects,
    handleUpdateProjectCollapsedState
  } = useProjects(encryptionKey);

  // Wrapper functions to match expected signatures
  const handleToggleComplete = async (id: string, completed: boolean): Promise<void> => {
    await toggleComplete(id, completed);
  };

  const handleDeleteTask = async (id: string): Promise<void> => {
    await deleteTask(id);
  };

  const handleUpdateTask = async (id: string, content: string, estimatedDuration?: number, projectId?: string): Promise<void> => {
    await updateTask(id, content, estimatedDuration, projectId);
  };

  // Calendar hooks
  const {
    events,
    calendars,
    isLoading: isLoadingCalendar,
    handleSubmitEvent,
    handleDeleteEvent,
    moveEventToCalendar,
    handleCalendarToggle,
    handleCalendarCreate,
    handleCalendarEdit,
    handleCalendarDelete,
    handleSetDefaultCalendar,
    onEventUpdate
  } = useCalendar(encryptionKey);

  // Drag and drop state
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [isTaskbarCollapsed, setIsTaskbarCollapsed] = useState(false);
  
  // Project selection state for desktop view
  const [selectedProjectId, setSelectedProjectId] = useState<string | undefined>(undefined);

  // Load tasks and projects when encryption key becomes available
  useEffect(() => {
    if (encryptionKey) {
      loadProjects(encryptionKey);
      loadTasks(encryptionKey);
    }
  }, [encryptionKey, loadTasks, loadProjects]);

  // Get default calendar for creating events from tasks
  const defaultCalendar = calendars.find((cal: Calendar) => cal.isDefault) || calendars[0];

  // Handle project selection for desktop view
  const handleProjectSelect = (projectId?: string) => {
    setSelectedProjectId(projectId);
  };

  // Calculate task counts per project for sidebar
  const taskCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    
    // Count inbox tasks (tasks without project)
    counts['inbox'] = tasks.filter(task => !task.projectId && !task.completed).length;
    
    // Count tasks per project
    projects.forEach(project => {
      counts[project.id] = tasks.filter(task => task.projectId === project.id && !task.completed).length;
    });
    
    return counts;
  }, [tasks, projects]);

  // Filter tasks based on selected project for desktop view
  const filteredTasks = useMemo(() => {
    if (selectedProjectId) {
      return tasks.filter(task => task.projectId === selectedProjectId && !task.completed);
    } else {
      // Show tasks without project (inbox)
      return tasks.filter(task => !task.projectId && !task.completed);
    }
  }, [tasks, selectedProjectId]);

  // Organize tasks by project for flat hierarchy display (mobile view)
  const organizedTasks = useMemo(() => {
    const organized: Array<{ type: 'project' | 'task'; data: Project | Task }> = [];
    
    // Get active (non-completed) tasks only
    const activeTasks = tasks.filter(task => !task.completed);
    
    // Group tasks by project
    const tasksByProject = new Map<string | undefined, Task[]>();
    activeTasks.forEach(task => {
      const projectId = task.projectId;
      if (!tasksByProject.has(projectId)) {
        tasksByProject.set(projectId, []);
      }
      tasksByProject.get(projectId)!.push(task);
    });

    // Add inbox tasks (tasks without project)
    const inboxTasks = tasksByProject.get(undefined) || [];
    if (inboxTasks.length > 0) {
      organized.push({ type: 'project', data: { id: 'inbox', name: 'Inbox', color: '#6b7280' } as Project });
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

    // Check if dropped on a time slot
    if (over.id.toString().startsWith('time-slot-') && over.data?.current?.time) {
      const dropTime = over.data.current.time as Date;
      
      // Create calendar event from task
      const startTime = new Date(dropTime);
      const duration = activeTask.estimatedDuration || 60; // Default 1 hour in minutes
      const endTime = addMinutes(startTime, duration);

      const eventData = {
        title: activeTask.content,
        description: `Scheduled from task: ${activeTask.content}`,
        startDate: format(startTime, 'yyyy-MM-dd'),
        startTime: format(startTime, 'HH:mm'),
        endDate: format(endTime, 'yyyy-MM-dd'),
        endTime: format(endTime, 'HH:mm'),
        calendarId: defaultCalendar.id
      };

      try {
        await handleSubmitEvent(eventData);
        // Task remains active - just linked to calendar event
      } catch (error) {
        console.error('Error creating event from task:', error);
        setError('Failed to create calendar event from task');
      }
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

  return (
    <DndContext onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="flex h-screen w-full">
        {/* Mobile Layout */}
        <div className="md:hidden flex w-full">
          {/* Tasks Sidebar - Mobile */}
          <div className={`transition-all duration-300 ${isTaskbarCollapsed ? 'w-16' : 'w-1/3'} border-r bg-background`}>
            <SchedulerTaskList
              organizedTasks={organizedTasks}
              onToggleComplete={handleToggleComplete}
              onDeleteTask={handleDeleteTask}
              onUpdateTask={handleUpdateTask}
              projects={projects}
              isCollapsed={isTaskbarCollapsed}
              isLoading={isLoadingTasks || isLoadingProjects}
            />
          </div>

          {/* Calendar - Mobile */}
          <div className="flex-1 overflow-hidden">
            <SchedulerCalendar
              events={events}
              calendars={calendars}
              onEventUpdate={onEventUpdate}
              onCalendarToggle={handleCalendarToggle}
              onCalendarCreate={handleCalendarCreate}
              onCalendarEdit={handleCalendarEdit}
              onCalendarDelete={handleCalendarDelete}
              onSetDefaultCalendar={handleSetDefaultCalendar}
              isLoading={isLoadingCalendar}
            />
          </div>
        </div>

        {/* Desktop Layout */}
        <div className="hidden md:flex w-full">
          {/* Project Sidebar - Desktop */}
          <div className={`transition-all duration-300 ${isTaskbarCollapsed ? 'w-16' : 'w-1/6'}`}>
            <ProjectSidebarDynamic
              projects={projects}
              selectedProjectId={selectedProjectId}
              onProjectSelect={handleProjectSelect}
              onAddProject={handleAddProject}
              onUpdateProject={handleUpdateProject}
              onDeleteProject={handleDeleteProject}
              onBulkReorderProjects={handleBulkReorderProjects}
              onUpdateProjectCollapsedState={handleUpdateProjectCollapsedState}
              isLoading={isLoadingTasks || isLoadingProjects}
              itemCounts={taskCounts}
              isCollapsed={isTaskbarCollapsed}
            />
          </div>

          {/* Tasks Panel - Desktop */}
          <div className={`transition-all duration-300 ${isTaskbarCollapsed ? 'w-16' : 'w-2/6'} border-r bg-background`}>
            <SchedulerTaskList
              organizedTasks={[]} // Empty for desktop - we'll use filteredTasks instead
              filteredTasks={filteredTasks}
              selectedProjectId={selectedProjectId}
              onToggleComplete={handleToggleComplete}
              onDeleteTask={handleDeleteTask}
              onUpdateTask={handleUpdateTask}
              projects={projects}
              isCollapsed={isTaskbarCollapsed}
              isLoading={isLoadingTasks || isLoadingProjects}
            />
          </div>

          {/* Calendar - Desktop */}
          <div className="flex-1 overflow-hidden">
            <SchedulerCalendar
              events={events}
              calendars={calendars}
              onEventUpdate={onEventUpdate}
              onCalendarToggle={handleCalendarToggle}
              onCalendarCreate={handleCalendarCreate}
              onCalendarEdit={handleCalendarEdit}
              onCalendarDelete={handleCalendarDelete}
              onSetDefaultCalendar={handleSetDefaultCalendar}
              isLoading={isLoadingCalendar}
            />
          </div>
        </div>

        {/* Drag Overlay */}
        <DragOverlay>
          {activeTask ? (
            <SchedulerTaskItem
              task={activeTask}
              onToggleComplete={handleToggleComplete}
              onDeleteTask={handleDeleteTask}
              onUpdateTask={handleUpdateTask}
              projects={projects}
              isDragOverlay={true}
            />
          ) : null}
        </DragOverlay>
      </div>
    </DndContext>
  );
}

export default function SchedulerPage() {
  return (
    <ErrorProvider>
      <SchedulerPageContent />
    </ErrorProvider>
  );
} 