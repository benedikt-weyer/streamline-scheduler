import { addMinutes, differenceInMinutes } from 'date-fns';
import { CalendarEvent } from './types';

export interface DraggedEvent {
  event: CalendarEvent;
  dayIndex: number;
  initialPosition: { x: number, y: number };
  offsetY: number;
}

export interface DragPosition {
  top: number;
  left: number;
  width: number;
  height: number;
  dayIndex: number;
  startTime: Date | null;
  endTime: Date | null;
}

/**
 * Calculates the time from the Y position on the grid
 */
export const getTimeFromPosition = (posY: number, dayDate: Date, slotHeight: number): Date => {
  // Calculate minutes from top position
  const totalMinutes = (posY / slotHeight) * 60;
  
  // Round minutes to nearest 30-minute interval for consistency with drag snapping
  const snappedMinutes = Math.round(totalMinutes / 30) * 30;
  
  // Constrain to valid time range (0:00 - 24:00)
  const constrainedMinutes = Math.max(0, Math.min(snappedMinutes, 24 * 60 - 1));
  
  // Calculate hours and minutes components
  const hours = Math.floor(constrainedMinutes / 60);
  const minutes = constrainedMinutes % 60;
  
  // Create new date with calculated time
  const newDate = new Date(dayDate);
  newDate.setHours(hours, minutes, 0, 0);
  
  return newDate;
};

/**
 * Calculates snapped Y position with constraints
 */
export const calculateSnappedYPosition = (
  relativeY: number, 
  rect: DOMRect, 
  activeEvent: DraggedEvent,
  slotHeight: number
): number => {
  // Check if cursor is outside the column bounds and snap accordingly
  let snappedY = relativeY;
  
  if (relativeY < 0) {
    // Snap to top if dragged above the day column
    snappedY = 0;
  } else if (relativeY > rect.height) {
    // Snap to bottom if dragged below the day column
    snappedY = rect.height;
  } else {
    // Get time at cursor position and snap to 30-minute intervals
    const minutesFromTop = (relativeY / slotHeight) * 60;
    const snappedMinutes = Math.round(minutesFromTop / 30) * 30;
    
    // Get event duration in minutes
    const duration = differenceInMinutes(
      activeEvent.event.endTime, 
      activeEvent.event.startTime
    );
    
    // Convert duration to pixels
    const durationInPixels = (duration / 60) * slotHeight;
    
    // Calculate maximum Y position that allows the full event to fit within the day
    const maxSnappedY = rect.height - durationInPixels;
    
    // Ensure we don't go below 0 (for very long events)
    snappedY = Math.max(0, Math.min(snappedMinutes / 60 * slotHeight, maxSnappedY));
  }
  
  return snappedY;
};

/**
 * Calculates the drag position for visual feedback during dragging
 */
export const calculateDragPosition = (
  relativeY: number, 
  rect: DOMRect, 
  targetDay: Date, 
  activeEvent: DraggedEvent,
  targetDayIndex: number,
  slotHeight: number
): DragPosition => {
  // Constrain Y position to stay within the grid
  const constrainedY = Math.max(0, Math.min(relativeY, rect.height));
  
  // Calculate duration for maintaining event length
  const duration = differenceInMinutes(
    activeEvent.event.endTime, 
    activeEvent.event.startTime
  );
  
  // Get time at cursor position and snap to 30-minute intervals
  const minutesFromTop = (constrainedY / slotHeight) * 60;
  const snappedMinutes = Math.round(minutesFromTop / 30) * 30;
  
  // Constrain to valid time range (0:00 - 24:00)
  const maxMinutes = 24 * 60 - duration;
  const constrainedMinutes = Math.max(0, Math.min(snappedMinutes, maxMinutes));
  
  // Create date object for the target day with snapped time
  const newStartTime = new Date(targetDay);
  const hours = Math.floor(constrainedMinutes / 60);
  const minutes = constrainedMinutes % 60;
  newStartTime.setHours(hours, minutes, 0, 0);
  
  // Calculate height based on duration
  const height = (duration / 60) * slotHeight;
  
  // Calculate top position based on snapped time
  const snappedTopPosition = (constrainedMinutes / 60) * slotHeight;
  
  return {
    top: snappedTopPosition,
    left: 0, // Will be positioned within the column
    width: rect.width - 8, // Account for padding
    height: height,
    dayIndex: targetDayIndex,
    startTime: newStartTime,
    endTime: addMinutes(newStartTime, duration)
  };
};