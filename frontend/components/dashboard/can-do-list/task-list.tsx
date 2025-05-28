'use client';

import { Task, Project } from '@/utils/can-do-list/can-do-list-types';
import TaskListItem from './task-list-item';

interface TaskListProps {
  readonly tasks: Task[];
  readonly isLoading: boolean;
  readonly onToggleComplete: (id: string, completed: boolean) => Promise<void>;
  readonly onDeleteTask: (id: string) => Promise<void>;
  readonly onUpdateTask: (id: string, content: string, estimatedDuration?: number, projectId?: string) => Promise<void>;
  readonly projects?: Project[];
}

export default function TaskList({ tasks, isLoading, onToggleComplete, onDeleteTask, onUpdateTask, projects = [] }: TaskListProps) {
  if (isLoading || tasks.length === 0) return null;

  return (
    <ul className="space-y-2">
      {tasks.map(task => (
        <TaskListItem
          key={task.id}
          task={task}
          onToggleComplete={onToggleComplete}
          onDeleteTask={onDeleteTask}
          onUpdateTask={onUpdateTask}
          projects={projects}
        />
      ))}
    </ul>
  );
}
