/**
 * Utility functions for handling task blocking relationships
 */

import { CanDoItemDecrypted } from '../api/types';

/**
 * Determines if a task is actually blocked or ready to work on
 * A task is considered "ready" if:
 * - It has no blocked_by relationship, OR
 * - All tasks that it's blocked by are completed
 */
export function isTaskActuallyBlocked(task: CanDoItemDecrypted, allTasks: CanDoItemDecrypted[]): boolean {
  // If task has no blocking relationship, it's not blocked
  if (!task.blocked_by) {
    return false;
  }

  // Find the blocking task
  const blockingTask = allTasks.find(t => t.id === task.blocked_by);
  
  // If blocking task doesn't exist (shouldn't happen), consider unblocked
  if (!blockingTask) {
    return false;
  }

  // Task is blocked if the blocking task is not completed
  return !blockingTask.completed;
}

/**
 * Gets the effective status of a task considering blocking relationships
 * Returns 'ready' if task has no blocking relationship, 'blocked' if it is blocked, 'unblocked' if it was blocked but is now ready
 */
export function getTaskEffectiveStatus(task: CanDoItemDecrypted, allTasks: CanDoItemDecrypted[]): 'ready' | 'blocked' | 'unblocked' {
  if (task.completed) {
    return 'ready'; // Completed tasks are always ready
  }

  // If task has no blocking relationship, it's just ready
  if (!task.blocked_by) {
    return 'ready';
  }

  // Task has a blocking relationship
  if (isTaskActuallyBlocked(task, allTasks)) {
    return 'blocked'; // Still blocked
  } else {
    return 'unblocked'; // Was blocked but now ready
  }
}

/**
 * Determines if a task should show the "unblocked" status
 * A task is "unblocked" if it has a blocked_by relationship but the blocking task is completed
 */
export function isTaskUnblocked(task: CanDoItemDecrypted, allTasks: CanDoItemDecrypted[]): boolean {
  return getTaskEffectiveStatus(task, allTasks) === 'unblocked';
}

/**
 * Gets all tasks that are blocked by a specific task
 */
export function getTasksBlockedBy(blockingTaskId: string, allTasks: CanDoItemDecrypted[]): CanDoItemDecrypted[] {
  return allTasks.filter(task => 
    task.blocked_by === blockingTaskId && !task.completed
  );
}

/**
 * Gets all tasks that would become ready if a specific task is completed
 */
export function getTasksThatWouldBecomeReady(completedTaskId: string, allTasks: CanDoItemDecrypted[]): CanDoItemDecrypted[] {
  const blockedTasks = getTasksBlockedBy(completedTaskId, allTasks);
  
  // Filter to only include tasks that would actually become ready
  // (i.e., tasks that are currently blocked only by this task)
  return blockedTasks.filter(task => isTaskActuallyBlocked(task, allTasks));
}
