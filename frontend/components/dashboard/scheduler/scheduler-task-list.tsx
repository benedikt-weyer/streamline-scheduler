'use client';

import { Task, Project } from '@/utils/can-do-list/can-do-list-types';
import { SchedulerTaskItem } from './scheduler-task-item';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { useDroppable } from '@dnd-kit/core';
// import { ScrollArea } from '@/components/ui/scroll-area';
import { ChevronRight, List } from 'lucide-react';

interface SchedulerTaskListProps {
  readonly organizedTasks: Array<{ type: 'project' | 'task'; data: Project | Task }>;
  readonly onToggleComplete: (id: string, completed: boolean) => Promise<void>;
  readonly onDeleteTask: (id: string) => Promise<void>;
  readonly onUpdateTask: (id: string, content: string, estimatedDuration?: number, projectId?: string) => Promise<void>;
  readonly projects: Project[];
  readonly isCollapsed: boolean;
  readonly isLoading: boolean;
}

export function SchedulerTaskList({
  organizedTasks,
  onToggleComplete,
  onDeleteTask,
  onUpdateTask,
  projects,
  isCollapsed,
  isLoading
}: SchedulerTaskListProps) {
  const { setNodeRef } = useDroppable({
    id: 'task-drop-zone',
  });

  const taskItems = organizedTasks.filter(item => item.type === 'task');
  const taskIds = taskItems.map(item => item.data.id);

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

  return (
    <SortableContext items={taskIds} strategy={verticalListSortingStrategy}>
      <div ref={setNodeRef} className="flex flex-col h-full">
        {/* Header */}
        <div className={`border-b p-4 ${isCollapsed ? 'px-2' : ''}`}>
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <List className="h-4 w-4" />
            {!isCollapsed && <span>Tasks</span>}
          </div>
          {!isCollapsed && (
            <div className="text-xs text-muted-foreground mt-1">
              Drag tasks to calendar to schedule them
            </div>
          )}
        </div>

        {/* Task List */}
        <div className="flex-1 overflow-y-auto">
          <div className={`space-y-1 p-2 ${isCollapsed ? 'px-1' : ''}`}>
            {organizedTasks.length === 0 ? (
              <div className={`text-center py-8 text-muted-foreground ${isCollapsed ? 'px-1' : 'px-4'}`}>
                {!isCollapsed && (
                  <>
                    <div className="text-sm">No active tasks</div>
                    <div className="text-xs mt-1">All tasks completed!</div>
                  </>
                )}
                {isCollapsed && <div className="text-xs">-</div>}
              </div>
            ) : (
              organizedTasks.map((item, index) => {
                if (item.type === 'project') {
                  const project = item.data as Project;
                  return (
                    <div key={`project-${project.id}`} className={`py-2 ${index > 0 ? 'pt-4' : ''}`}>
                      {!isCollapsed ? (
                        <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground px-1">
                          <div
                            className="w-2 h-2 rounded-full"
                            style={{ backgroundColor: project.color }}
                          />
                          <span className="truncate">{project.name}</span>
                        </div>
                      ) : (
                        <div className="flex justify-center">
                          <div
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: project.color }}
                            title={project.name}
                          />
                        </div>
                      )}
                    </div>
                  );
                } else {
                  const task = item.data as Task;
                  return (
                    <div key={`task-${task.id}`} className={isCollapsed ? 'px-0' : ''}>
                      {!isCollapsed ? (
                        <SchedulerTaskItem
                          task={task}
                          onToggleComplete={onToggleComplete}
                          onDeleteTask={onDeleteTask}
                          onUpdateTask={onUpdateTask}
                          projects={projects}
                        />
                      ) : (
                        <div
                          className="flex items-center justify-center p-1 rounded border cursor-grab hover:bg-accent"
                          title={task.content}
                        >
                          <div className="w-2 h-2 bg-primary rounded-full"></div>
                        </div>
                      )}
                    </div>
                  );
                }
              })
            )}
          </div>
        </div>

        {/* Drop zone indicator (shown when collapsed) */}
        {isCollapsed && (
          <div className="border-t p-2 text-center">
            <div className="text-xs text-muted-foreground">
              <ChevronRight className="h-3 w-3 mx-auto" />
            </div>
          </div>
        )}
      </div>
    </SortableContext>
  );
} 