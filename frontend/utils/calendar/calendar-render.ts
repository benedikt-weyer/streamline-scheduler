import { format, isSameDay, differenceInMinutes, setHours, setMinutes } from 'date-fns';
import { CalendarEvent } from './calendar-types';

export interface CalendarEventRendering {
  eventStyles: {
    top: string;
    height: string;
    width: string;
    left: string;
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
  opacity: number,
  columnIndex: number = 0,
  totalColumns: number = 1
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
  
  // Calculate width and left position for overlapping events
  const columnWidth = 100 / totalColumns;
  const leftPosition = columnWidth * columnIndex;
  
  return {
    eventStyles: {
      top: `${topPosition}px`,
      height: `${height}px`,
      width: totalColumns > 1 ? `calc(${columnWidth}% - 4px)` : 'calc(100% - 8px)',
      left: totalColumns > 1 ? `${leftPosition}%` : '4px',
      zIndex: zIndex,
      opacity: opacity/100
    },
    startTime: eventStart,
    endTime: eventEnd
  };
};

/**
 * Checks if two events overlap in time
 */
export const doEventsOverlap = (event1: CalendarEvent, event2: CalendarEvent): boolean => {
  return event1.startTime < event2.endTime && event2.startTime < event1.endTime;
};

/**
 * Groups overlapping events together
 */
export const groupOverlappingEvents = (
  events: CalendarEvent[]
): CalendarEvent[][] => {
  if (!events.length) return [];
  
  // Filter out events with invalid startTime or endTime
  const validEvents = events.filter(event => 
    event.startTime instanceof Date && 
    event.endTime instanceof Date && 
    !isNaN(event.startTime.getTime()) && 
    !isNaN(event.endTime.getTime())
  );
  
  if (validEvents.length === 0) return [];
  
  // Sort events by start time
  const sortedEvents = [...validEvents].sort((a, b) => 
    a.startTime.getTime() - b.startTime.getTime()
  );
  
  const groups: CalendarEvent[][] = [];
  let currentGroup: CalendarEvent[] = [sortedEvents[0]];
  
  for (let i = 1; i < sortedEvents.length; i++) {
    const event = sortedEvents[i];
    
    // Check if this event overlaps with any in the current group
    const overlapsWithGroup = currentGroup.some(groupEvent => 
      doEventsOverlap(event, groupEvent)
    );
    
    if (overlapsWithGroup) {
      // Add to current group if it overlaps
      currentGroup.push(event);
    } else {
      // Start a new group if no overlap
      groups.push(currentGroup);
      currentGroup = [event];
    }
  }
  
  // Don't forget to add the last group
  if (currentGroup.length > 0) {
    groups.push(currentGroup);
  }
  
  return groups;
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