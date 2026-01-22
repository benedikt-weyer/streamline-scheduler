import { create } from 'zustand';

interface TaskNavigationState {
  // The task ID to navigate to
  navigateToTaskId: string | null;
  // The task ID that should be highlighted
  highlightedTaskId: string | null;
  // Set the task to navigate to
  setNavigateToTask: (taskId: string) => void;
  // Set the highlighted task
  setHighlightedTask: (taskId: string | null) => void;
  // Clear navigation state
  clearNavigation: () => void;
}

export const useTaskNavigation = create<TaskNavigationState>((set) => ({
  navigateToTaskId: null,
  highlightedTaskId: null,
  
  setNavigateToTask: (taskId: string) => {
    set({ navigateToTaskId: taskId, highlightedTaskId: taskId });
  },
  
  setHighlightedTask: (taskId: string | null) => {
    set({ highlightedTaskId: taskId });
  },
  
  clearNavigation: () => {
    // Only clear the navigation ID, keep the highlight for the animation
    set({ navigateToTaskId: null });
  },
}));
