'use client';

import { Task, Project } from '@/utils/can-do-list/can-do-list-types';
import { getRecommendedTasks, getRecommendationReason, calculateRecommendationScore } from '@/utils/can-do-list/recommendation-utils';
import { formatDueDate, getDueDateColorClass } from '@/utils/can-do-list/due-date-utils';
import { calculatePriority, getUrgencyColorClass, getPriorityDisplayText } from '@/utils/can-do-list/priority-utils';
import { Clock, Calendar, Zap, AlertTriangle, Star } from 'lucide-react';
import { cn } from '@/lib/shadcn-utils';
import TaskListItem from './task-list-item';

interface RecommendedTaskListProps {
  tasks: Task[];
  projects: Project[];
  isLoading?: boolean;
  onToggleComplete: (id: string, completed: boolean) => Promise<void>;
  onDeleteTask: (id: string) => Promise<void>;
  onUpdateTask: (id: string, content: string, estimatedDuration?: number, projectId?: string, importance?: number, urgency?: number, dueDate?: Date, blockedBy?: string) => Promise<void>;
}

export default function RecommendedTaskList({
  tasks,
  projects,
  isLoading = false,
  onToggleComplete,
  onDeleteTask,
  onUpdateTask
}: RecommendedTaskListProps) {
  const recommendedTasks = getRecommendedTasks(tasks, 20);
  
  // Get project name for a task
  const getProjectName = (task: Task): string => {
    if (!task.projectId) return 'Inbox';
    const project = projects.find(p => p.id === task.projectId);
    return project?.name || 'Unknown Project';
  };
  
  // Get project color for a task
  const getProjectColor = (task: Task): string => {
    if (!task.projectId) return '#6b7280'; // gray-500 for inbox
    const project = projects.find(p => p.id === task.projectId);
    return project?.color || '#6b7280';
  };

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="animate-pulse">
            <div className="h-16 bg-muted rounded-md"></div>
          </div>
        ))}
      </div>
    );
  }

  if (recommendedTasks.length === 0) {
    return (
      <div className="text-center py-12">
        <Star className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
        <h3 className="text-lg font-medium text-muted-foreground mb-2">
          No Recommended Tasks
        </h3>
        <p className="text-sm text-muted-foreground max-w-md mx-auto">
          Add importance, urgency ratings, or due dates to your tasks to see personalized recommendations here.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <Star className="h-5 w-5 text-amber-500" />
        <h2 className="text-lg font-semibold">Recommended Tasks</h2>
        <span className="text-sm text-muted-foreground">
          ({recommendedTasks.length} tasks)
        </span>
      </div>
      
      <div className="text-sm text-muted-foreground mb-4">
        Tasks ranked by importance, urgency, and due dates. Focus on these for maximum impact.
      </div>

      {/* Task List */}
      <div className="space-y-2">
        {recommendedTasks.map((task, index) => {
          const score = calculateRecommendationScore(task, tasks);
          const reason = getRecommendationReason(task, tasks);
          
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
                    index === 0 ? "bg-amber-500 text-white" :
                    index === 1 ? "bg-gray-400 text-white" :
                    index === 2 ? "bg-amber-600 text-white" :
                    "bg-muted text-muted-foreground"
                  )}>
                    {index + 1}
                  </div>
                </div>
                
                {/* Task content */}
                <div className="pl-4">
                  <TaskListItem
                    task={task}
                    onToggleComplete={onToggleComplete}
                    onDeleteTask={onDeleteTask}
                    onUpdateTask={onUpdateTask}
                    projects={projects}
                    tasks={tasks}
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
        })}
      </div>
      
      {recommendedTasks.length === 20 && (
        <div className="text-center pt-4">
          <p className="text-xs text-muted-foreground">
            Showing top 20 recommendations
          </p>
        </div>
      )}
    </div>
  );
} 