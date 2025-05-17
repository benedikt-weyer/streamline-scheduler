import { format, isSameDay, differenceInMinutes, setHours, setMinutes } from 'date-fns';
import { CalendarEvent } from './types';

export interface CalendarEventRendering {
  eventStyles: {
    top: string;
    height: string;
    width: string;
    zIndex: number;
    opacity: number;
  };
  startTime: Date;
  endTime: Date;
}

/**
 * Calculates event rendering details for an event within a specific day
 */
export const calculateEventRendering = (
  event: CalendarEvent,
  day: Date,
  slotHeight: number,
  zIndex: number,
  opacity: number
): CalendarEventRendering => {
  // Adjust times for events that cross days
  const eventStart = isSameDay(event.startTime, day) 
    ? event.startTime 
    : setHours(setMinutes(new Date(day), 0), 0); // Start of day if crossing from previous day
  
  const eventEnd = isSameDay(event.endTime, day) 
    ? event.endTime 
    : setHours(setMinutes(new Date(day), 0), 24); // End of day if crossing to next day
  
  // Calculate position from top (based on start time)
  const dayStartTime = setHours(setMinutes(new Date(day), 0), 0); // 00:00
  const minutesFromDayStart = differenceInMinutes(eventStart, dayStartTime);
  const topPosition = (minutesFromDayStart / 60) * slotHeight;
  
  // Calculate height (based on duration)
  const durationInMinutes = differenceInMinutes(eventEnd, eventStart);
  const height = (durationInMinutes / 60) * slotHeight;
  
  return {
    eventStyles: {
      top: `${topPosition}px`,
      height: `${height}px`,
      width: 'calc(100% - 8px)',
      zIndex: zIndex,
      opacity: opacity/100
    },
    startTime: eventStart,
    endTime: eventEnd
  };
};

/**
 * Calculates viewport-optimized calendar dimensions
 */
export const calculateCalendarDimensions = (
  timeSlotCount: number,
  minSlotHeight = 25
): { 
  calendarHeight: number, 
  slotHeight: number 
} => {
  // Get viewport height
  const viewportHeight = window.innerHeight;
  // Approximate header heights (page header, calendar header, etc.)
  const headerOffset = 180;
  // Provide some padding at the bottom
  const bottomPadding = 20;
  // Calculate available height
  const availableHeight = viewportHeight - headerOffset - bottomPadding;
  
  // Set height, with a minimum to ensure visibility
  const calendarHeight = Math.max(availableHeight, 500);
  
  // Calculate slot height based on available height and number of slots
  // Subtract a small amount for borders
  const calculatedSlotHeight = Math.max(
    Math.floor((calendarHeight - 2) / timeSlotCount),
    minSlotHeight // Minimum slot height
  );
  
  return {
    calendarHeight,
    slotHeight: calculatedSlotHeight
  };
};