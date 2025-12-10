'use client';

import { CanDoItemDecrypted, ProjectDecrypted } from '@/utils/api/types';
import TaskListItem from './task-list-item';
import { useState, useEffect, useMemo } from 'react';

// Helper to organize tasks hierarchically
interface TaskWithDepth extends CanDoItemDecrypted {
  depth: number;
}

function organizeTasksHierarchically(tasks: CanDoItemDecrypted[], showCompleted: boolean = false): TaskWithDepth[] {
  const result: TaskWithDepth[] = [];
  
  const addTaskAndChildren = (taskId: string | undefined, depth: number, processed: Set<string>, parentCompleted: boolean = false) => {
    // Find children of this task
    const children = tasks.filter(t => t.parent_task_id === taskId);
    
    children.forEach(task => {
      // Prevent infinite loops
      if (processed.has(task.id)) return;
      processed.add(task.id);
      
      // Show subtasks if:
      // 1. Parent is not completed (so we can see completed subtasks under active parent)
      // 2. OR the subtask itself is not completed
      // 3. OR we're showing all completed tasks
      const shouldShow = !parentCompleted || !task.completed || showCompleted;
      
      if (shouldShow) {
        // Add the task with its depth
        result.push({ ...task, depth });
        
        // Recursively add its children (max depth is 3, so max nesting is 2)
        if (depth < 2) {
          addTaskAndChildren(task.id, depth + 1, processed, task.completed);
        }
      }
    });
  };
  
  // Start with root level tasks (no parent)
  addTaskAndChildren(undefined, 0, new Set(), false);
  
  return result;
}

interface TaskListProps {
  tasks: CanDoItemDecrypted[];
  allTasks?: CanDoItemDecrypted[]; // All tasks for blocking relationships
  isLoading?: boolean;
  searchQuery?: string;
  selectedProjectId?: string | null;
  showProjectName?: boolean;
  showCompleted?: boolean;
  projects?: ProjectDecrypted[];
  onToggleComplete: (id: string, completed: boolean) => Promise<void>;
  onDeleteTask: (id: string) => Promise<void>;
  onUpdateTask: (id: string, content: string, estimatedDuration?: number, projectId?: string, impact?: number, urgency?: number, dueDate?: Date, blockedBy?: string, myDay?: boolean, parentTaskId?: string) => Promise<void>;
  onToggleMyDay?: (id: string) => Promise<void>;
  onScheduleTask?: (taskId: string) => Promise<void>;
  isTaskScheduled?: (taskId: string) => boolean;
  onReorderTasks?: (sourceIndex: number, destinationIndex: number, projectId?: string) => Promise<boolean>;
  currentProjectId?: string;
  calendarEvents?: any[];
  onNavigateToEvent?: (eventId: string) => void;
  onDeleteEvent?: (eventId: string) => Promise<void>;
}

export default function TaskList({ 
  tasks, 
  allTasks,
  isLoading, 
  onToggleComplete, 
  onDeleteTask, 
  onUpdateTask, 
  onToggleMyDay,
  onScheduleTask,
  isTaskScheduled,
  onReorderTasks,
  projects = [],
  currentProjectId,
  showProjectName = false,
  showCompleted = false,
  calendarEvents,
  onNavigateToEvent,
  onDeleteEvent
}: TaskListProps) {
  // Organize tasks hierarchically with depth information
  const hierarchicalTasks = useMemo(() => {
    return organizeTasksHierarchically(tasks, showCompleted);
  }, [tasks, showCompleted]);

  if (isLoading || hierarchicalTasks.length === 0) return null;

  return (
    <ul className="space-y-2">
      {hierarchicalTasks.map((task) => {
        // Calculate left margin for indentation (24px per level)
        const indentStyle = { marginLeft: `${task.depth * 24}px` };

        return (
          <li key={task.id} className="relative" style={indentStyle}>
            <TaskListItem
              task={task}
              onToggleComplete={onToggleComplete}
              onDeleteTask={onDeleteTask}
              onUpdateTask={onUpdateTask}
              onToggleMyDay={onToggleMyDay}
              onScheduleTask={onScheduleTask}
              isScheduled={isTaskScheduled ? isTaskScheduled(task.id) : false}
              projects={projects}
              tasks={allTasks ?? tasks}
              showProjectName={showProjectName}
              calendarEvents={calendarEvents}
              onNavigateToEvent={onNavigateToEvent}
              onDeleteEvent={onDeleteEvent}
            />
          </li>
        );
      })}
    </ul>
  );
}
