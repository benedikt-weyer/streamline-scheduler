'use client';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Task, Project } from '@/utils/can-do-list/can-do-list-types';
import { useState } from 'react';
import { Edit, Trash2, Clock, Zap } from 'lucide-react';
import EditTaskDialog from '../can-do-list/edit-task-dialog';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { calculatePriority, getUrgencyColorClass, getPriorityDisplayText } from '@/utils/can-do-list/priority-utils';

interface SchedulerTaskItemProps {
  readonly task: Task;
  readonly onToggleComplete: (id: string, completed: boolean) => Promise<void>;
  readonly onDeleteTask: (id: string) => Promise<void>;
  readonly onUpdateTask: (id: string, content: string, estimatedDuration?: number, projectId?: string, impact?: number, urgency?: number) => Promise<void>;
  readonly projects?: Project[];
  readonly isDragOverlay?: boolean;
}

export function SchedulerTaskItem({ 
  task, 
  onToggleComplete, 
  onDeleteTask, 
  onUpdateTask, 
  projects = [],
  isDragOverlay = false
}: SchedulerTaskItemProps) {
  const [showEdit, setShowEdit] = useState(false);
  const [isAnimatingOut, setIsAnimatingOut] = useState(false);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id, disabled: task.completed || isDragOverlay });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const handleToggleCompleteClick = async () => {
    if (task.completed) {
      await onToggleComplete(task.id, false);
    } else {
      setIsAnimatingOut(true);
      // Small delay to allow animation to start
      setTimeout(async () => {
        await onToggleComplete(task.id, true);
        setIsAnimatingOut(false);
      }, 50);
    }
  };

  const handleToggleCompleteKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      handleToggleCompleteClick();
    }
  };

  const handleEditClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowEdit(true);
  };

  const handleDeleteClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    await onDeleteTask(task.id);
  };

  const handleUpdateTask = async (id: string, content: string, estimatedDuration?: number, projectId?: string, impact?: number, urgency?: number) => {
    await onUpdateTask(id, content, estimatedDuration, projectId, impact, urgency);
    setShowEdit(false);
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

  return (
    <>
      <div 
        ref={!isDragOverlay ? setNodeRef : undefined}
        style={!isDragOverlay ? style : undefined}
        {...(!task.completed && !isDragOverlay ? attributes : {})}
        {...(!task.completed && !isDragOverlay ? listeners : {})}
        className={`flex items-center justify-between rounded-md border task-transition p-2 ${
          !task.completed ? 'cursor-grab active:cursor-grabbing' : 'cursor-default'
        } ${
          task.completed ? 'bg-muted' : 'bg-background hover:bg-accent'
        } ${
          isAnimatingOut ? 'task-fade-out' : 'task-fade-in'
        } ${
          isDragging || isDragOverlay ? 'opacity-50 shadow-lg' : ''
        } ${
          isDragOverlay ? 'rotate-3 scale-105' : ''
        }`}
      >
        <div 
          className="flex items-center space-x-3 flex-1 min-w-0"
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
          <div className="flex-1 min-w-0">
            <span
              className={`block truncate cursor-pointer ${
                task.completed ? 'line-through text-muted-foreground' : ''
              }`}
              aria-label={`Mark "${task.content}" as ${task.completed ? 'incomplete' : 'complete'}`}
            >
              {task.content}
            </span>
            <div className="flex items-center gap-2 mt-1">
              {task.estimatedDuration && (
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  <span>{formatDuration(task.estimatedDuration)}</span>
                </div>
              )}
              {(() => {
                const priority = calculatePriority(task.impact, task.urgency);
                const priorityText = getPriorityDisplayText(priority);
                if (priorityText) {
                  return (
                    <div className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded ${getUrgencyColorClass(task.urgency)}`}>
                      <Zap className="h-3 w-3" />
                      <span>{priorityText}</span>
                    </div>
                  );
                }
                return null;
              })()}
            </div>
          </div>
        </div>

        {!isDragOverlay && (
          <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleEditClick}
              className="h-6 w-6 p-0"
              title="Edit task"
            >
              <Edit className="h-3 w-3" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDeleteClick}
              className="h-6 w-6 p-0 text-destructive hover:text-destructive/80"
              title="Delete task"
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        )}
      </div>

      <EditTaskDialog
        isOpen={showEdit}
        onClose={() => setShowEdit(false)}
        task={task}
        onSave={handleUpdateTask}
        projects={projects}
      />
    </>
  );
} 