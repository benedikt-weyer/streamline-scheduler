'use client';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Task, Project } from '@/utils/can-do-list/can-do-list-types';
import { useState } from 'react';
import { Edit, Trash2, Clock, Zap, Calendar, Copy } from 'lucide-react';
import { toast } from 'sonner';
import EditTaskDialog from './edit-task-dialog';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { calculatePriority, getUrgencyColorClass, getPriorityDisplayText } from '@/utils/can-do-list/priority-utils';
import { formatDueDate, getDueDateColorClass } from '@/utils/can-do-list/due-date-utils';

interface TaskListItemProps {
  readonly task: Task;
  readonly onToggleComplete: (id: string, completed: boolean) => Promise<void>;
  readonly onDeleteTask: (id: string) => Promise<void>;
  readonly onUpdateTask: (id: string, content: string, estimatedDuration?: number, projectId?: string, importance?: number, urgency?: number, dueDate?: Date) => Promise<void>;
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

  // Format duration for display
  const formatDuration = (minutes?: number) => {
    if (!minutes) return null;
    if (minutes < 60) {
      return `${minutes}m`;
    }
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
  };

  const handleEdit = () => {
    setIsEditDialogOpen(true);
  };

  const handleSave = async (id: string, content: string, estimatedDuration?: number, projectId?: string, importance?: number, urgency?: number, dueDate?: Date) => {
    setIsUpdating(true);
    try {
      await onUpdateTask(id, content, estimatedDuration, projectId, importance, urgency, dueDate);
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

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(task.content);
      toast.success('Task content copied to clipboard');
    } catch (error) {
      console.error('Failed to copy task content:', error);
      // Fallback for browsers that don't support clipboard API
      const textArea = document.createElement('textarea');
      textArea.value = task.content;
      document.body.appendChild(textArea);
      textArea.select();
      try {
        document.execCommand('copy');
        toast.success('Task content copied to clipboard');
      } catch (fallbackError) {
        console.error('Fallback copy failed:', fallbackError);
        toast.error('Failed to copy task content');
      }
      document.body.removeChild(textArea);
    }
  };

  return (
    <>
      <div 
        ref={setNodeRef}
        style={style}
        {...(!task.completed ? attributes : {})}
        {...(!task.completed ? listeners : {})}
        className={`flex rounded-md border task-transition ${
          !task.completed ? 'cursor-grab active:cursor-grabbing' : 'cursor-default'
        } ${
          task.completed ? 'bg-muted' : ''
        } ${
          isAnimatingOut ? 'task-fade-out' : 'task-fade-in'
        } ${
          isDragging ? 'opacity-50' : ''
        }`}
      >
        {/* Main content area */}
        <div className="flex-1 min-w-0">
          {/* Task name row */}
          <div 
            className="flex items-center space-x-3 p-3 md:p-3 py-4 md:py-3"
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
          
          {/* Badges row - only show on mobile when there are badges */}
          {(task.estimatedDuration || task.importance || task.urgency || task.dueDate) && (
            <div className="md:hidden flex items-center space-x-1 pl-12 pr-3 pb-3">
              {task.estimatedDuration && (
                <span className="text-xs text-background bg-muted-foreground px-2 py-[2px] rounded-sm flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {formatDuration(task.estimatedDuration)}
                </span>
              )}
              {(() => {
                const priority = calculatePriority(task.importance, task.urgency);
                const priorityText = getPriorityDisplayText(priority);
                if (priorityText) {
                  return (
                    <span className={`text-xs px-2 py-[2px] rounded-sm flex items-center gap-1 ${getUrgencyColorClass(task.urgency)}`}>
                      <Zap className="h-3 w-3" />
                      {priorityText}
                    </span>
                  );
                }
                return null;
              })()}
              {task.dueDate && (
                <span className={`text-xs px-2 py-[2px] rounded-sm flex items-center gap-1 ${getDueDateColorClass(task.dueDate)}`}>
                  <Calendar className="h-3 w-3" />
                  {formatDueDate(task.dueDate)}
                </span>
              )}
            </div>
          )}
        </div>
        
        {/* Action buttons - vertically centered */}
        <div className="flex items-center space-x-1 pr-2 self-center">
          {/* Desktop badges - hidden on mobile */}
          <div className="hidden md:flex items-center space-x-1">
            {task.estimatedDuration && (
              <span className="ml-2 text-xs text-background bg-muted-foreground px-2 py-[2px] rounded-sm flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {formatDuration(task.estimatedDuration)}
              </span>
            )}
            {(() => {
              const priority = calculatePriority(task.importance, task.urgency);
              const priorityText = getPriorityDisplayText(priority);
              if (priorityText) {
                return (
                  <span className={`ml-2 text-xs px-2 py-[2px] rounded-sm flex items-center gap-1 ${getUrgencyColorClass(task.urgency)}`}>
                    <Zap className="h-3 w-3" />
                    {priorityText}
                  </span>
                );
              }
              return null;
            })()}
            {task.dueDate && (
              <span className={`ml-2 text-xs px-2 py-[2px] rounded-sm flex items-center gap-1 ${getDueDateColorClass(task.dueDate)}`}>
                <Calendar className="h-3 w-3" />
                {formatDueDate(task.dueDate)}
              </span>
            )}
          </div>
          
          {/* Action buttons */}
          <Button
            variant="ghost"
            size="sm"
            onClick={handleCopy}
            onPointerDown={(e) => e.stopPropagation()}
            className="text-muted-foreground hover:text-foreground p-2"
          >
            <Copy className="h-4 w-4" />
            <span className="sr-only">Copy task content</span>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleEdit}
            onPointerDown={(e) => e.stopPropagation()}
            className="text-muted-foreground hover:text-foreground p-2"
          >
            <Edit className="h-4 w-4" />
            <span className="sr-only">Edit</span>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onDeleteTask(task.id)}
            onPointerDown={(e) => e.stopPropagation()}
            className="text-destructive hover:text-destructive/80 p-2"
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
