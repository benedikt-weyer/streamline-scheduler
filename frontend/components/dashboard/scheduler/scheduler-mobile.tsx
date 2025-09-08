'use client';

import { useState, useCallback, useMemo } from 'react';
import { Task, Project } from '@/utils/can-do-list/can-do-list-types';
import { CalendarEvent, Calendar } from '@/utils/calendar/calendar-types';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CheckSquare, Calendar as CalendarIcon, Plus, Clock, Sun } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { format, addMinutes } from 'date-fns';
import { CalendarEventDialog, EventFormValues } from '@/components/dashboard/calendar/calendar-event-dialog';
import { TaskSearchWithFilter } from '@/components/dashboard/shared/task-search-input';

interface SchedulerMobileProps {
  readonly tasks: Task[];
  readonly projects: Project[];
  readonly events: CalendarEvent[];
  readonly calendars: Calendar[];
  readonly onToggleComplete: (id: string, completed: boolean) => Promise<void>;
  readonly onDeleteTask: (id: string) => Promise<void>;
  readonly onUpdateTask: (id: string, content: string, estimatedDuration?: number, projectId?: string, impact?: number, urgency?: number, dueDate?: Date, blockedBy?: string, myDay?: boolean) => Promise<void>;
  readonly onToggleMyDay?: (id: string) => Promise<void>;
  readonly onEventUpdate: (updatedEvent: CalendarEvent) => void;
  readonly onSubmitEvent: (eventData: any) => Promise<void>;
  readonly onDeleteEvent: (id: string) => Promise<void>;
  readonly onClone?: (event: CalendarEvent) => Promise<boolean>;
  readonly isLoading: boolean;
}

export function SchedulerMobile({
  tasks,
  projects,
  events,
  calendars,
  onToggleComplete,
  onDeleteTask,
  onUpdateTask,
  onToggleMyDay,
  onEventUpdate,
  onSubmitEvent,
  onDeleteEvent,
  onClone,
  isLoading
}: SchedulerMobileProps) {
  const [activeTab, setActiveTab] = useState<'tasks' | 'calendar'>('tasks');
  const [isEventDialogOpen, setIsEventDialogOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [searchFilteredTasks, setSearchFilteredTasks] = useState<Task[]>([]);
  const [isSearchActive, setIsSearchActive] = useState(false);
  const [taskToSchedule, setTaskToSchedule] = useState<Task | null>(null);

  // Handle filtered tasks change from search component
  const handleFilteredTasksChange = (filteredTasks: Task[], searchActive: boolean) => {
    setSearchFilteredTasks(filteredTasks);
    setIsSearchActive(searchActive);
  };

  // Get active tasks only
  const activeTasks = useMemo(() => 
    tasks.filter(task => !task.completed), [tasks]
  );

  // Use search filtered tasks if search is active, otherwise use all active tasks
  const finalFilteredTasks = useMemo(() => {
    if (isSearchActive) {
      // When search is active, show search results (even if empty)
      return searchFilteredTasks;
    }
    // When no search is active, show all active tasks
    return activeTasks;
  }, [searchFilteredTasks, activeTasks, isSearchActive]);

  // Organize tasks by project
  const organizedTasks = useMemo(() => {
    const tasksByProject = new Map<string | undefined, Task[]>();
    finalFilteredTasks.forEach(task => {
      const projectId = task.projectId;
      if (!tasksByProject.has(projectId)) {
        tasksByProject.set(projectId, []);
      }
      tasksByProject.get(projectId)!.push(task);
    });

    const organized: Array<{ type: 'project' | 'task'; data: Project | Task }> = [];

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
  }, [finalFilteredTasks, projects]);

  // Get default calendar
  const defaultCalendar = useMemo(() => 
    calendars.find(cal => cal.isDefault) || calendars[0], [calendars]
  );

  // Today's events
  const todayEvents = useMemo(() => {
    const today = new Date();
    const todayStr = format(today, 'yyyy-MM-dd');
    return events
      .filter(event => {
        const eventDate = format(event.startTime, 'yyyy-MM-dd');
        return eventDate === todayStr;
      })
      .filter(event => 
        calendars.find(cal => cal.id === event.calendarId)?.isVisible ?? false
      )
      .sort((a, b) => a.startTime.getTime() - b.startTime.getTime());
  }, [events, calendars]);

  // Handle scheduling a task
  const handleScheduleTask = useCallback((task: Task | null) => {
    setTaskToSchedule(task);
    
    // Create a temporary event with task details
    const now = new Date();
    const startTime = new Date(now);
    startTime.setMinutes(0, 0, 0); // Round to the hour
    
    const duration = task?.estimatedDuration || 60;
    const endTime = addMinutes(startTime, duration);

    const dummyEvent: CalendarEvent = {
      id: 'new',
      title: task?.content || '',
      description: task ? `Scheduled from task: ${task.content}` : '',
      calendarId: defaultCalendar?.id || '',
      startTime,
      endTime,
      createdAt: new Date()
    };

    setSelectedEvent(dummyEvent);
    setIsEventDialogOpen(true);
  }, [defaultCalendar]);

  // Handle event submission
  const handleSubmitEvent = useCallback(async (values: EventFormValues) => {
    try {
      const eventData = {
        title: values.title,
        description: values.description,
        startDate: format(new Date(values.startDate), 'yyyy-MM-dd'),
        startTime: values.startTime,
        endDate: format(new Date(values.endDate), 'yyyy-MM-dd'),
        endTime: values.endTime,
        calendarId: values.calendarId
      };

      await onSubmitEvent(eventData);
      setIsEventDialogOpen(false);
      setSelectedEvent(null);
      setTaskToSchedule(null);
    } catch (error) {
      console.error('Error creating event:', error);
    }
  }, [onSubmitEvent]);

  // Handle event deletion
  const handleDeleteEvent = useCallback(async (id: string) => {
    try {
      await onDeleteEvent(id);
      setIsEventDialogOpen(false);
      setSelectedEvent(null);
    } catch (error) {
      console.error('Error deleting event:', error);
    }
  }, [onDeleteEvent]);

  const handleCloneEvent = useCallback(async (event: CalendarEvent) => {
    if (onClone) {
      await onClone(event);
      setIsEventDialogOpen(false);
      setSelectedEvent(null);
    }
  }, [onClone]);

  // Open event for editing
  const openEditEvent = useCallback((event: CalendarEvent) => {
    setSelectedEvent(event);
    setTaskToSchedule(null);
    setIsEventDialogOpen(true);
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading scheduler...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'tasks' | 'calendar')} className="flex-1 flex flex-col">
        {/* Tab Navigation */}
        <div className="border-b bg-background">
          <TabsList className="grid w-full grid-cols-2 rounded-none h-14">
            <TabsTrigger value="tasks" className="flex items-center gap-2 text-base">
              <CheckSquare className="h-5 w-5" />
              <span>Tasks</span>
              {activeTasks.length > 0 && (
                <Badge variant="secondary" className="ml-1">
                  {activeTasks.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="calendar" className="flex items-center gap-2 text-base">
              <CalendarIcon className="h-5 w-5" />
              <span>Today</span>
              {todayEvents.length > 0 && (
                <Badge variant="secondary" className="ml-1">
                  {todayEvents.length}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>
        </div>

        {/* Tasks Tab */}
        <TabsContent value="tasks" className="flex-1 flex flex-col mt-0">
          {/* Search Input */}
          <div className="p-4 border-b bg-background">
            <TaskSearchWithFilter
              tasks={activeTasks}
              projects={projects}
              className="w-full"
              onFilteredTasksChange={handleFilteredTasksChange}
            />
          </div>
          
          <div className="flex-1 overflow-y-auto">
            {organizedTasks.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full p-8 text-center">
                <CheckSquare className="h-16 w-16 text-muted-foreground/40 mb-4" />
                <h3 className="text-lg font-medium mb-2">All tasks completed!</h3>
                <p className="text-muted-foreground">Great job! You've finished all your tasks.</p>
              </div>
            ) : (
              <div className="space-y-1 p-4">
                {organizedTasks.map((item, index) => {
                  if (item.type === 'project') {
                    const project = item.data as Project;
                    return (
                      <div key={`project-${project.id}`} className={`py-3 ${index > 0 ? 'pt-6' : ''}`}>
                        <div className="flex items-center gap-3 text-sm font-medium text-muted-foreground">
                          <div
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: project.color }}
                          />
                          <span>{project.name}</span>
                        </div>
                      </div>
                    );
                  } else {
                    const task = item.data as Task;
                    const project = projects.find(p => p.id === task.projectId);
                    
                    return (
                      <div
                        key={`task-${task.id}`}
                        className="flex items-center gap-3 p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                      >
                        <button
                          onClick={() => onToggleComplete(task.id, true)}
                          className="flex-shrink-0 w-5 h-5 rounded border-2 border-muted-foreground/30 hover:border-primary transition-colors"
                          aria-label="Complete task"
                        />
                        
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm line-clamp-2">
                            {task.content}
                          </div>
                          {task.estimatedDuration && (
                            <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                              <Clock className="h-3 w-3" />
                              <span>{task.estimatedDuration}m</span>
                            </div>
                          )}
                        </div>

                        <div className="flex items-center gap-1">
                          {onToggleMyDay && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => onToggleMyDay(task.id)}
                              className={`flex-shrink-0 h-8 px-2 ${task.myDay ? 'text-amber-500 hover:text-amber-600' : 'text-muted-foreground hover:text-foreground'}`}
                              title={task.myDay ? 'Remove from My Day' : 'Add to My Day'}
                            >
                              <Sun className="h-4 w-4" />
                              <span className="sr-only">{task.myDay ? 'Remove from My Day' : 'Add to My Day'}</span>
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleScheduleTask(task)}
                            className="flex-shrink-0 h-8 px-2"
                          >
                            <Plus className="h-4 w-4" />
                            <span className="sr-only">Schedule task</span>
                          </Button>
                        </div>
                      </div>
                    );
                  }
                })}
              </div>
            )}
          </div>
        </TabsContent>

        {/* Calendar Tab */}
        <TabsContent value="calendar" className="flex-1 flex flex-col mt-0">
          <div className="flex-1 overflow-y-auto">
            {/* Today Header */}
            <div className="border-b bg-muted/20 p-4">
              <h2 className="text-lg font-semibold">
                {format(new Date(), 'EEEE, MMMM d')}
              </h2>
              <p className="text-sm text-muted-foreground">
                {todayEvents.length === 0 ? 'No events today' : `${todayEvents.length} event${todayEvents.length > 1 ? 's' : ''} today`}
              </p>
            </div>

            {/* Events List */}
            <div className="p-4 space-y-3">
              {todayEvents.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <CalendarIcon className="h-16 w-16 text-muted-foreground/40 mb-4" />
                  <h3 className="text-lg font-medium mb-2">No events today</h3>
                  <p className="text-muted-foreground mb-4">Your calendar is clear for today.</p>
                  <Button onClick={() => handleScheduleTask(null)} className="gap-2">
                    <Plus className="h-4 w-4" />
                    Add Event
                  </Button>
                </div>
              ) : (
                todayEvents.map(event => {
                  const calendar = calendars.find(cal => cal.id === event.calendarId);
                  
                  return (
                    <div
                      key={event.id}
                      onClick={() => openEditEvent(event)}
                      className="flex items-start gap-3 p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors cursor-pointer"
                    >
                      <div
                        className="w-3 h-3 rounded-full mt-1.5 flex-shrink-0"
                        style={{ backgroundColor: calendar?.color || '#6b7280' }}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm line-clamp-1">
                          {event.title}
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">
                          {format(event.startTime, 'h:mm a')} - {format(event.endTime, 'h:mm a')}
                        </div>
                        {event.description && (
                          <div className="text-xs text-muted-foreground mt-1 line-clamp-2">
                            {event.description}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* Event Dialog */}
      <CalendarEventDialog
        isOpen={isEventDialogOpen}
        onOpenChange={setIsEventDialogOpen}
        selectedEvent={selectedEvent}
        calendars={calendars}
        defaultCalendarId={defaultCalendar?.id || ''}
        onSubmit={handleSubmitEvent}
        onDelete={handleDeleteEvent}
        onClone={handleCloneEvent}
      />
    </div>
  );
} 