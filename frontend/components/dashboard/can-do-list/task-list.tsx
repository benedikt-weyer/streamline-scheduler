'use client';

import { Task, Project } from '@/utils/can-do-list/can-do-list-types';
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
import { useState, useEffect } from 'react';

interface TaskListProps {
  tasks: Task[];
  allTasks?: Task[]; // All tasks for blocking relationships
  isLoading: boolean;
  onToggleComplete: (id: string, completed: boolean) => Promise<void>;
  onDeleteTask: (id: string) => Promise<void>;
  onUpdateTask: (id: string, content: string, estimatedDuration?: number, projectId?: string, importance?: number, urgency?: number, dueDate?: Date, blockedBy?: string) => Promise<void>;
  onReorderTasks: (taskIds: string[]) => Promise<void>;
  projects?: Project[];
  currentProjectId?: string;
}

export default function TaskList({ 
  tasks, 
  allTasks,
  isLoading, 
  onToggleComplete, 
  onDeleteTask, 
  onUpdateTask, 
  onReorderTasks,
  projects = [],
  currentProjectId
}: TaskListProps) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const [localTasks, setLocalTasks] = useState(tasks);

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
          await onReorderTasks(localTasks.map(task => task.id));
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
  const activeTasks = localTasks.filter(task => !task.completed);
  const taskIds = activeTasks.map(task => task.id);
  const activeTask = activeId ? localTasks.find(task => task.id === activeId) : null;

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
          {localTasks.map((task, index) => {
            const isDropIndicatorVisible = activeId && overId === task.id && activeId !== task.id;
            const activeIndex = activeId ? localTasks.findIndex(t => t.id === activeId) : -1;
            const currentIndex = index;
            const showIndicatorAbove = isDropIndicatorVisible && activeIndex > currentIndex;
            const showIndicatorBelow = isDropIndicatorVisible && activeIndex < currentIndex;

            return (
              <li key={task.id} className="relative">
                {/* Drop indicator above */}
                {showIndicatorAbove && (
                  <div className="absolute -top-1 left-0 right-0 h-0.5 bg-blue-500 rounded-full z-10" />
                )}
                
                <TaskListItem
                  task={task}
                  onToggleComplete={onToggleComplete}
                  onDeleteTask={onDeleteTask}
                  onUpdateTask={onUpdateTask}
                  projects={projects}
                  tasks={allTasks ?? tasks}
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
          <TaskListItem
            task={activeTask}
            onToggleComplete={onToggleComplete}
            onDeleteTask={onDeleteTask}
            onUpdateTask={onUpdateTask}
            projects={projects}
            tasks={allTasks ?? tasks}
          />
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
