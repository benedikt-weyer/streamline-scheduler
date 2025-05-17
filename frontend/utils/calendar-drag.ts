import { differenceInMinutes } from 'date-fns';
import { CalendarEvent } from './types';

// Enum for different drag modes
export enum DragMode {
  Move = 'move',      // Moving the entire event
  ResizeTop = 'top',  // Resizing the top of the event (changing start time)
  ResizeBottom = 'bottom' // Resizing the bottom of the event (changing end time)
}

export interface DraggedEvent {
  event: CalendarEvent;
  initialPosition: { x: number, y: number };
  offsetY: number;
  mode: DragMode; // Track which operation we're performing
}

export interface DragPosition {
  startTime: Date;
  endTime: Date;
}


/**
 * Calculates the drag position for visual feedback during dragging
 */
export const calculateDraggingEventDateTime = (
  mouseY: number,
  columnMouseOverRect: DOMRect, 
  activeEvent: DraggedEvent,
  slotHeight: number,
  currentlyHoveringDay: Date
): DragPosition => {

  // Calculate the relative Y position of the mouse within the column
  const relativeY = mouseY - columnMouseOverRect.top - (activeEvent.mode === DragMode.Move ? activeEvent.offsetY : 0);

  let relativeYSnapped = relativeY;

  if (mouseY < columnMouseOverRect.top) {
    // If the mouse is above the column, snap to the top
    relativeYSnapped = -(activeEvent.mode === DragMode.Move ? activeEvent.offsetY : 0);
  } else if (mouseY > columnMouseOverRect.bottom) {
    // If the mouse is below the column, snap to the bottom
    relativeYSnapped = columnMouseOverRect.height - (activeEvent.mode === DragMode.Move ? activeEvent.offsetY : 0);
  }
  
  // Calculate minutes from top position
  const totalMinutes = (relativeYSnapped / slotHeight) * 60;
  
  // Round minutes to nearest 15-minute interval for better usability
  const snappedMinutes = Math.round(totalMinutes / 15) * 15;
  
  // Calculate hours and minutes components
  const hours = snappedMinutes >= 0 ? Math.floor(snappedMinutes / 60) : Math.ceil(snappedMinutes / 60);
  const minutes = Math.abs(snappedMinutes % 60);
  
  // Calculate times based on drag mode
  let newStartTime: Date;
  let newEndTime: Date;
  
  switch (activeEvent.mode) {
    case DragMode.ResizeTop: {
      // When resizing from the top, only the start time changes
      newStartTime = new Date(currentlyHoveringDay);
      newStartTime.setHours(hours, minutes, 0, 0);
      
      // Ensure start time doesn't go beyond end time
      if (newStartTime >= activeEvent.event.endTime) {
        newStartTime = new Date(activeEvent.event.endTime);
        newStartTime.setMinutes(newStartTime.getMinutes() - 15);
      }
      
      newEndTime = new Date(activeEvent.event.endTime);
      break;
    }
      
    case DragMode.ResizeBottom: {
      // When resizing from the bottom, only the end time changes
      newEndTime = new Date(currentlyHoveringDay);
      newEndTime.setHours(hours, minutes, 0, 0);
      
      // Ensure end time doesn't go before start time
      if (newEndTime <= activeEvent.event.startTime) {
        newEndTime = new Date(activeEvent.event.startTime);
        newEndTime.setMinutes(newEndTime.getMinutes() + 15);
      }
      
      newStartTime = new Date(activeEvent.event.startTime);
      break;
    }
      
    case DragMode.Move:
    default: {
      // Moving the entire event - maintain the same duration
      newStartTime = new Date(currentlyHoveringDay);
      newStartTime.setHours(hours, minutes, 0, 0);
      
      // Calculate duration for maintaining event length
      const duration = differenceInMinutes(
        activeEvent.event.endTime, 
        activeEvent.event.startTime
      );
      
      newEndTime = new Date(newStartTime);
      newEndTime.setMinutes(newEndTime.getMinutes() + duration);
      break;
    }
  }

  return {
    startTime: newStartTime,
    endTime: newEndTime
  };
};