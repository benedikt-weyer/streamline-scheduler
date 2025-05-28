'use client';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Task, Project } from '@/utils/can-do-list/can-do-list-types';
import { useState } from 'react';
import { Edit, Trash2, Clock } from 'lucide-react';
import EditTaskDialog from './edit-task-dialog';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface TaskListItemProps {
  readonly task: Task;
  readonly onToggleComplete: (id: string, completed: boolean) => Promise<void>;
  readonly onDeleteTask: (id: string) => Promise<void>;
  readonly onUpdateTask: (id: string, content: string, estimatedDuration?: number, projectId?: string) => Promise<void>;
  readonly projects?: Project[];
}

export default function TaskListItem({ task, onToggleComplete, onDeleteTask, onUpdateTask, projects = [] }: TaskListItemProps) {
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isAnimatingOut, setIsAnimatingOut] = useState(false);

  // Only enable sorting for active (non-completed) tasks
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ 
    id: task.id,
    disabled: task.completed // Disable dragging for completed tasks
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const handleEdit = () => {
    setIsEditDialogOpen(true);
  };

  const handleSave = async (id: string, content: string, estimatedDuration?: number, projectId?: string) => {
    setIsUpdating(true);
    try {
      await onUpdateTask(id, content, estimatedDuration, projectId);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleCloseDialog = () => {
    setIsEditDialogOpen(false);
  };

  const handleToggleCompleteClick = async () => {
    if (!task.completed) {
      // If marking as complete, trigger animation first
      setIsAnimatingOut(true);
      // Wait for animation to complete, then actually toggle
      setTimeout(async () => {
        await onToggleComplete(task.id, !task.completed);
      }, 300); // Match animation duration
    } else {
      // If marking as incomplete, toggle immediately
      await onToggleComplete(task.id, !task.completed);
    }
  };

  const handleToggleCompleteKeyDown = async (event: React.KeyboardEvent) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      await handleToggleCompleteClick();
    }
  };

  return (
    <>
      <div 
        ref={setNodeRef}
        style={style}
        {...(!task.completed ? attributes : {})}
        {...(!task.completed ? listeners : {})}
        className={`flex items-center justify-between rounded-md border task-transition ${
          !task.completed ? 'cursor-grab active:cursor-grabbing' : 'cursor-default'
        } ${
          task.completed ? 'bg-muted' : ''
        } ${
          isAnimatingOut ? 'task-fade-out' : 'task-fade-in'
        } ${
          isDragging ? 'opacity-50' : ''
        }`}
      >
        <div 
          className="flex items-center space-x-3 flex-1 min-w-0 p-3"
          onClick={handleToggleCompleteClick}
          onKeyDown={handleToggleCompleteKeyDown}
          role="button"
          tabIndex={0}
        >
          <Checkbox
            checked={task.completed}
            id={`task-${task.id}`}
            onCheckedChange={handleToggleCompleteClick}
            onPointerDown={(e) => e.stopPropagation()}
          />
          <span
            className={`flex-1 min-w-0 cursor-pointer ${
              task.completed ? 'line-through text-muted-foreground' : ''
            }`}
            aria-label={`Mark "${task.content}" as ${task.completed ? 'incomplete' : 'complete'}`}
          >
            <span className="block truncate">{task.content}</span>
          </span>
        </div>
        
        <div className="flex items-center space-x-1">
          {task.estimatedDuration && (
            <span className="ml-2 text-xs text-background bg-muted-foreground px-2 py-[2px] rounded-sm flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {task.estimatedDuration} min
            </span>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={handleEdit}
            onPointerDown={(e) => e.stopPropagation()}
            className="text-muted-foreground hover:text-foreground"
          >
            <Edit className="h-4 w-4" />
            <span className="sr-only">Edit</span>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onDeleteTask(task.id)}
            onPointerDown={(e) => e.stopPropagation()}
            className="text-destructive hover:text-destructive/80"
          >
            <Trash2 className="h-4 w-4" />
            <span className="sr-only">Delete</span>
          </Button>
        </div>
      </div>

      <EditTaskDialog
        task={task}
        isOpen={isEditDialogOpen}
        onClose={handleCloseDialog}
        onSave={handleSave}
        isLoading={isUpdating}
        projects={projects}
      />
    </>
  );
}
