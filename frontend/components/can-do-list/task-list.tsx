'use client';

import { CanDoItemDecrypted, ProjectDecrypted } from '@/utils/api/types';
import TaskListItem from './task-list-item';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  DragOverEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable';
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
  const [activeId, setActiveId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const [localTasks, setLocalTasks] = useState(tasks);

  // Organize tasks hierarchically with depth information
  const hierarchicalTasks = useMemo(() => {
    return organizeTasksHierarchically(localTasks, showCompleted);
  }, [localTasks, showCompleted]);

  // Update local tasks when props change
  useEffect(() => {
    setLocalTasks(tasks);
  }, [tasks]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { over } = event;
    setOverId(over ? over.id as string : null);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);
    setOverId(null);

    if (!over || !onReorderTasks) {
      return;
    }

    if (active.id !== over.id) {
      const oldIndex = localTasks.findIndex(task => task.id === active.id);
      const newIndex = localTasks.findIndex(task => task.id === over.id);

      if (oldIndex !== -1 && newIndex !== -1) {
        // Optimistically update the UI
        const reorderedTasks = arrayMove(localTasks, oldIndex, newIndex);
        setLocalTasks(reorderedTasks);

        // Persist to backend
        try {
          await onReorderTasks(oldIndex, newIndex, currentProjectId);
        } catch (error) {
          // Revert on error
          setLocalTasks(tasks);
          console.error('Failed to reorder tasks:', error);
        }
      }
    }
  };

  if (isLoading || localTasks.length === 0) return null;

  // Only include active (non-completed) tasks in drag and drop operations
  const activeTasks = hierarchicalTasks.filter(task => !task.completed);
  const taskIds = activeTasks.map(task => task.id);
  const activeTask = activeId ? hierarchicalTasks.find(task => task.id === activeId) : null;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={taskIds} strategy={verticalListSortingStrategy}>
        <ul className="space-y-2">
          {hierarchicalTasks.map((task, index) => {
            const isDropIndicatorVisible = activeId && overId === task.id && activeId !== task.id;
            const activeIndex = activeId ? hierarchicalTasks.findIndex(t => t.id === activeId) : -1;
            const currentIndex = index;
            const showIndicatorAbove = isDropIndicatorVisible && activeIndex > currentIndex;
            const showIndicatorBelow = isDropIndicatorVisible && activeIndex < currentIndex;
            
            // Calculate left margin for indentation (24px per level)
            const indentStyle = { marginLeft: `${task.depth * 24}px` };

            return (
              <li key={task.id} className="relative" style={indentStyle}>
                {/* Drop indicator above */}
                {showIndicatorAbove && (
                  <div className="absolute -top-1 left-0 right-0 h-0.5 bg-blue-500 rounded-full z-10" />
                )}
                
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
                
                {/* Drop indicator below */}
                {showIndicatorBelow && (
                  <div className="absolute -bottom-1 left-0 right-0 h-0.5 bg-blue-500 rounded-full z-10" />
                )}
              </li>
            );
          })}
        </ul>
      </SortableContext>
      
      <DragOverlay>
        {activeTask ? (
          <div style={{ marginLeft: `${activeTask.depth * 24}px` }}>
            <TaskListItem
              task={activeTask}
              onToggleComplete={onToggleComplete}
              onDeleteTask={onDeleteTask}
              onUpdateTask={onUpdateTask}
              projects={projects}
              tasks={allTasks ?? tasks}
              showProjectName={showProjectName}
            />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
