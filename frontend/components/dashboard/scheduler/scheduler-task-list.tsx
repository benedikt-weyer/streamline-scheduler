'use client';

import { CanDoItemDecrypted, ProjectDecrypted } from '@/utils/api/types';
import { SchedulerTaskItem } from './scheduler-task-item';
import TaskListItem from '@/components/dashboard/can-do-list/task-list-item';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { useDroppable } from '@dnd-kit/core';
import { ChevronRight, List } from 'lucide-react';
import { useState, useMemo } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TaskSearchWithFilter } from '@/components/dashboard/shared/task-search-input';
import { getRecommendationReason, calculateRecommendationScore } from '@/utils/can-do-list/recommendation-utils';
import { cn } from '@/lib/shadcn-utils';

interface SchedulerTaskListProps {
  readonly organizedTasks: Array<{ type: 'project' | 'task'; data: ProjectDecrypted | CanDoItemDecrypted }>;
  readonly filteredTasks?: CanDoItemDecrypted[]; // For desktop view
  readonly selectedProjectId?: string; // For desktop view
  readonly onToggleComplete: (id: string, completed: boolean) => Promise<void>;
  readonly onDeleteTask: (id: string) => Promise<void>;
  readonly onUpdateTask: (id: string, content: string, estimatedDuration?: number, projectId?: string, impact?: number, urgency?: number, dueDate?: Date, blockedBy?: string, myDay?: boolean) => Promise<void>;
  readonly onToggleMyDay?: (id: string) => Promise<void>;
  readonly projects: ProjectDecrypted[];
  readonly isCollapsed: boolean;
  readonly isLoading: boolean;
  readonly baseTasks?: CanDoItemDecrypted[]; // For search functionality
  readonly onFilteredTasksChange?: (tasks: CanDoItemDecrypted[], isSearchActive: boolean) => void; // For search functionality
  readonly isRecommendedSelected?: boolean; // For recommended UI hints
  readonly taskPool?: CanDoItemDecrypted[]; // All tasks for calculating recommendation scores
}

export function SchedulerTaskList({
  organizedTasks,
  filteredTasks,
  selectedProjectId,
  onToggleComplete,
  onDeleteTask,
  onUpdateTask,
  onToggleMyDay,
  projects,
  isCollapsed,
  isLoading,
  baseTasks = [],
  onFilteredTasksChange,
  isRecommendedSelected = false,
  taskPool = []
}: SchedulerTaskListProps) {
  const { setNodeRef } = useDroppable({
    id: 'task-drop-zone',
  });

  const [activeTab, setActiveTab] = useState<'active' | 'completed'>('active');

  const taskItems = organizedTasks.filter(item => item.type === 'task');
  const taskIds = taskItems.map(item => item.data.id);

  // Get all tasks from organized tasks for desktop view (when filteredTasks is not provided)
  const allTasks = useMemo(() => {
    if (filteredTasks) {
      return filteredTasks;
    }
    return organizedTasks
      .filter(item => item.type === 'task')
      .map(item => item.data as CanDoItemDecrypted);
  }, [organizedTasks, filteredTasks]);

  // Filter tasks for desktop tabs
  const filteredTasksForTabs = useMemo(() => {
    return allTasks.filter(task => {
      if (activeTab === 'active') {
        return !task.completed;
      } else {
        return task.completed;
      }
    });
  }, [allTasks, activeTab]);

  // Get active and completed counts
  const { activeCount, completedCount } = useMemo(() => {
    const active = allTasks.filter(task => !task.completed).length;
    const completed = allTasks.filter(task => task.completed).length;
    return { activeCount: active, completedCount: completed };
  }, [allTasks]);

  // Get project name for desktop header
  const projectName = useMemo(() => {
    if (!selectedProjectId) return 'Inbox';
    const project = projects.find(p => p.id === selectedProjectId);
    return project?.name || 'Project';
  }, [selectedProjectId, projects]);

  // Helper functions for recommended tasks UI
  const getProjectName = (task: CanDoItemDecrypted): string => {
    if (!task.project_id) return 'Inbox';
    const project = projects.find(p => p.id === task.project_id);
    return project?.name || 'Unknown Project';
  };
  
  const getProjectColor = (task: CanDoItemDecrypted): string => {
    if (!task.project_id) return '#6b7280'; // gray-500 for inbox
    const project = projects.find(p => p.id === task.project_id);
    return project?.color || '#6b7280';
  };

  // Render task with recommendation UI hints
  const renderTaskWithRecommendationHints = (task: CanDoItemDecrypted, index: number) => {
    const score = calculateRecommendationScore(task, taskPool);
    const reason = getRecommendationReason(task, taskPool);
    const rankNumber = index + 1;
    
    return (
      <div key={task.id} className="relative">
        {/* Priority rank indicator */}
        <div className="absolute left-0 top-0 bottom-0 w-1 rounded-l-md" 
             style={{ 
               backgroundColor: score >= 25 ? '#ef4444' : 
                              score >= 20 ? '#f97316' : 
                              score >= 15 ? '#eab308' : '#6b7280' 
             }} />
        
        {/* Task item with custom styling */}
        <div className="ml-2 relative">
          {/* Rank badge */}
          <div className="absolute -top-1 -left-1 z-10">
            <div className={cn(
              "w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold",
              rankNumber === 1 ? "bg-amber-500 text-white" :
              rankNumber === 2 ? "bg-gray-400 text-white" :
              rankNumber === 3 ? "bg-amber-600 text-white" :
              "bg-muted text-muted-foreground"
            )}>
              {rankNumber}
            </div>
          </div>
          
          {/* Task content */}
          <div className="pl-4">
            <TaskListItem
              task={task}
              onToggleComplete={onToggleComplete}
              onDeleteTask={onDeleteTask}
              onUpdateTask={onUpdateTask}
              onToggleMyDay={onToggleMyDay}
              projects={projects}
              tasks={taskPool}
            />
            
            {/* Additional info for recommended view */}
            <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
              <div className="flex items-center gap-1">
                <div
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: getProjectColor(task) }}
                />
                <span>{getProjectName(task)}</span>
              </div>
              <span>•</span>
              <span>Score: {score}</span>
              <span>•</span>
              <span>{reason}</span>
            </div>
          </div>
        </div>
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className={`flex flex-col h-full ${isCollapsed ? 'items-center' : ''}`}>
        <div className={`border-b p-4 ${isCollapsed ? 'px-2' : ''}`}>
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <List className="h-4 w-4" />
            {!isCollapsed && <span>Tasks</span>}
          </div>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
        </div>
      </div>
    );
  }

  // Mobile/Collapsed view (current compact design)
  if (isCollapsed) {
    return (
      <SortableContext items={taskIds} strategy={verticalListSortingStrategy}>
        <div ref={setNodeRef} className="flex flex-col h-full">
          {/* Header */}
          <div className="border-b p-4 px-2">
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <List className="h-4 w-4" />
            </div>
          </div>

          {/* Task List */}
          <div className="flex-1 overflow-y-auto">
            <div className="space-y-1 p-2 px-1">
              {organizedTasks.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground px-1">
                  <div className="text-xs">-</div>
                </div>
              ) : (
                organizedTasks.map((item, index) => {
                  if (item.type === 'project') {
                    const project = item.data as ProjectDecrypted;
                    return (
                      <div key={`project-${project.id}`} className={`py-2 ${index > 0 ? 'pt-4' : ''}`}>
                        <div className="flex justify-center">
                          <div
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: project.color }}
                            title={project.name}
                          />
                        </div>
                      </div>
                    );
                  } else {
                    const task = item.data as CanDoItemDecrypted;
                    return (
                      <div key={`task-${task.id}`} className="px-0">
                        <div
                          className="flex items-center justify-center p-1 rounded border cursor-grab hover:bg-accent"
                          title={task.content}
                        >
                          <div className="w-2 h-2 bg-primary rounded-full"></div>
                        </div>
                      </div>
                    );
                  }
                })
              )}
            </div>
          </div>

          {/* Drop zone indicator */}
          <div className="border-t p-2 text-center">
            <div className="text-xs text-muted-foreground">
              <ChevronRight className="h-3 w-3 mx-auto" />
            </div>
          </div>
        </div>
      </SortableContext>
    );
  }

  // Desktop view (full layout similar to dedicated can-do list)
  return (
    <SortableContext items={taskIds} strategy={verticalListSortingStrategy}>
      <div ref={setNodeRef} className="flex flex-col h-full">
        {/* Header */}
        <div className="border-b p-4">
          <div className="flex items-center justify-between gap-3 mb-2">
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <List className="h-4 w-4" />
              <span>{filteredTasks ? projectName : 'Tasks'}</span>
            </div>
            {onFilteredTasksChange && baseTasks.length > 0 && (
              <TaskSearchWithFilter
                tasks={baseTasks}
                projects={projects}
                className="w-48"
                onFilteredTasksChange={onFilteredTasksChange}
              />
            )}
          </div>
          <div className="text-xs text-muted-foreground">
            Drag tasks to calendar to schedule them
          </div>
        </div>

        {/* Desktop: Show mobile compact view on small screens, full view on medium+ */}
        <div className="flex-1 overflow-hidden">
          {/* Mobile compact view */}
          <div className="md:hidden flex-1 overflow-y-auto">
            <div className="space-y-1 p-2">
              {organizedTasks.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground px-4">
                  <div className="text-sm">No active tasks</div>
                  <div className="text-xs mt-1">All tasks completed!</div>
                </div>
              ) : (
                organizedTasks.map((item, index) => {
                  if (item.type === 'project') {
                    const project = item.data as ProjectDecrypted;
                    return (
                      <div key={`project-${project.id}`} className={`py-2 ${index > 0 ? 'pt-4' : ''}`}>
                        <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground px-1">
                          <div
                            className="w-2 h-2 rounded-full"
                            style={{ backgroundColor: project.color }}
                          />
                          <span className="truncate">{project.name}</span>
                        </div>
                      </div>
                    );
                  } else {
                    const task = item.data as CanDoItemDecrypted;
                    return (
                      <div key={`task-${task.id}`}>
                        <SchedulerTaskItem
                          task={task}
                          onToggleComplete={onToggleComplete}
                          onDeleteTask={onDeleteTask}
                          onUpdateTask={onUpdateTask}
                          projects={projects}
                        />
                      </div>
                    );
                  }
                })
              )}
            </div>
          </div>

          {/* Desktop full view */}
          <div className="hidden md:flex flex-col h-full">
            <div className="p-4">
              <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'active' | 'completed')} className="w-full">
                <TabsList className="grid w-full grid-cols-2 mb-4">
                  <TabsTrigger value="active" className="flex items-center gap-2">
                    Active
                    {activeCount > 0 && (
                      <span className="bg-primary text-primary-foreground rounded-full px-2 py-0.5 text-xs">
                        {activeCount}
                      </span>
                    )}
                  </TabsTrigger>
                  <TabsTrigger value="completed" className="flex items-center gap-2">
                    Completed
                    {completedCount > 0 && (
                      <span className="bg-muted text-muted-foreground rounded-full px-2 py-0.5 text-xs">
                        {completedCount}
                      </span>
                    )}
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="active" className="mt-0">
                  <div className="space-y-2 max-h-[calc(100vh-300px)] overflow-y-auto">
                    {filteredTasksForTabs.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        <div className="text-sm">No active tasks</div>
                        <div className="text-xs mt-1">All tasks completed!</div>
                      </div>
                    ) : (
                      filteredTasksForTabs.map((task, index) => 
                        isRecommendedSelected ? 
                          renderTaskWithRecommendationHints(task, index) : (
                            <TaskListItem
                              key={task.id}
                              task={task}
                              onToggleComplete={onToggleComplete}
                              onDeleteTask={onDeleteTask}
                              onUpdateTask={onUpdateTask}
                              onToggleMyDay={onToggleMyDay}
                              projects={projects}
                              tasks={taskPool}
                            />
                          )
                      )
                    )}
                  </div>
                </TabsContent>

                <TabsContent value="completed" className="mt-0">
                  <div className="space-y-2 max-h-[calc(100vh-300px)] overflow-y-auto">
                    {filteredTasksForTabs.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        <div className="text-sm">No completed tasks</div>
                      </div>
                    ) : (
                      filteredTasksForTabs.map((task) => (
                        <TaskListItem
                          key={task.id}
                          task={task}
                          onToggleComplete={onToggleComplete}
                          onDeleteTask={onDeleteTask}
                          onUpdateTask={onUpdateTask}
                          onToggleMyDay={onToggleMyDay}
                          projects={projects}
                          tasks={taskPool}
                        />
                      ))
                    )}
                  </div>
                </TabsContent>
              </Tabs>
            </div>
          </div>
        </div>
      </div>
    </SortableContext>
  );
} 