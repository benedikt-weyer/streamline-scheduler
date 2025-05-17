import { addMinutes, differenceInMinutes } from 'date-fns';
import { CalendarEvent } from './types';

export interface DraggedEvent {
  event: CalendarEvent;
  initialPosition: { x: number, y: number };
  offsetY: number;
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
  const relativeY = mouseY - columnMouseOverRect.top - activeEvent.offsetY;

  let relativeYSnapped = relativeY;

  if (mouseY < columnMouseOverRect.top) {
    // If the mouse is above the column, snap to the top
    relativeYSnapped = -activeEvent.offsetY;
  }else if (mouseY > columnMouseOverRect.bottom) {
    // If the mouse is below the column, snap to the bottom
    relativeYSnapped = columnMouseOverRect.height - activeEvent.offsetY;
  }
  
   // Calculate minutes from top position
   const totalMinutes = (relativeYSnapped / slotHeight) * 60;
  
   // Round minutes to nearest 30-minute interval for consistency with drag snapping
   const snappedMinutes = totalMinutes >= 0 ? Math.floor(totalMinutes / 30) * 30 : Math.ceil(totalMinutes / 30) * 30;
   
   // Calculate hours and minutes components
   const hours = snappedMinutes >= 0 ? Math.floor(snappedMinutes / 60) : Math.ceil(snappedMinutes / 60);
   const minutes = snappedMinutes % 60;
   
   // Create new date with calculated time
   const newStartTime = new Date(currentlyHoveringDay);
   newStartTime.setHours(hours, minutes, 0, 0);


   // Calculate duration for maintaining event length
  const duration = differenceInMinutes(
    activeEvent.event.endTime, 
    activeEvent.event.startTime
  );
  

  return {
    startTime: newStartTime,
    endTime: addMinutes(newStartTime, duration)
  };
};