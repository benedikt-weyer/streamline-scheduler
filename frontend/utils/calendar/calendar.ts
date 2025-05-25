import { 
  format, 
  parse, 
  isValid, 
  startOfWeek, 
  endOfWeek, 
  eachDayOfInterval, 
  addWeeks, 
  subWeeks,
  isWithinInterval,
  isSameDay,
  addDays,
  addMonths,
  addYears,
  differenceInDays,
  differenceInWeeks,
  differenceInMonths,
  differenceInYears,
  getDay
} from 'date-fns';
import { CalendarEvent, RecurrenceFrequency, RecurrencePattern } from './calendar-types';

// Generate time slots for the calendar (hourly intervals)
export const generateTimeSlots = (startHour = 0, endHour = 24) => {
  const slots = [];
  
  for (let hour = startHour; hour < endHour; hour++) {
    // Format hours with leading zeros for consistency
    const formattedHour = hour.toString().padStart(2, '0');
    slots.push(`${formattedHour}:00`);
  }
  
  return slots;
};

// Get the days of the current week
export const getDaysOfWeek = (currentWeek: Date) => {
  return eachDayOfInterval({
    start: currentWeek,
    end: endOfWeek(currentWeek, { weekStartsOn: 1 })
  });
};

// Filter events for the current week
export const filterEventsForWeek = (events: CalendarEvent[], currentWeek: Date) => {
  if (!events.length) return [];
  
  const weekStart = currentWeek;
  const weekEnd = endOfWeek(currentWeek, { weekStartsOn: 1 });
  
  // Get all events and their recurring instances that fall within this week
  const allEventsForWeek: CalendarEvent[] = [];
  
  events.forEach(event => {
    // Check if the original event is in the current week
    const originalEventInWeek = isWithinInterval(event.startTime, { start: weekStart, end: weekEnd }) ||
      isWithinInterval(event.endTime, { start: weekStart, end: weekEnd }) ||
      (event.startTime < weekStart && event.endTime > weekEnd);
    
    if (originalEventInWeek) {
      allEventsForWeek.push(event);
    }
    
    // If this is a recurring event, check for instances in the current week
    if (event.recurrencePattern && event.recurrencePattern.frequency !== RecurrenceFrequency.None) {
      const recurrenceInstances = generateRecurrenceInstancesInRange(
        event, 
        weekStart, 
        weekEnd
      );
      
      allEventsForWeek.push(...recurrenceInstances);
    }
  });
  
  return allEventsForWeek;
};

/**
 * Generates recurring instances of an event within a specified date range
 */
export const generateRecurrenceInstancesInRange = (
  baseEvent: CalendarEvent,
  rangeStart: Date,
  rangeEnd: Date
): CalendarEvent[] => {
  const instances: CalendarEvent[] = [];
  
  // If no recurrence pattern or set to None, return empty array
  if (!baseEvent.recurrencePattern || 
      baseEvent.recurrencePattern.frequency === RecurrenceFrequency.None) {
    return instances;
  }
  
  const { 
    frequency, 
    endDate, 
    interval = 1,
    daysOfWeek 
  } = baseEvent.recurrencePattern;
  
  // If the original event is after the range end, no need to continue
  if (baseEvent.startTime > rangeEnd) {
    return instances;
  }
  
  // If an end date is specified and it's before the range start, no events
  if (endDate && endDate < rangeStart) {
    return instances;
  }
  
  // Calculate the event duration in milliseconds to maintain for each instance
  const eventDuration = baseEvent.endTime.getTime() - baseEvent.startTime.getTime();
  
  if (!baseEvent.startTime || !isValid(baseEvent.startTime) || 
      !baseEvent.endTime || !isValid(baseEvent.endTime) || 
      eventDuration <= 0) {
    console.error(
      '[generateRecurrenceInstancesInRange] Invalid baseEvent startTime, endTime, or duration:',
      JSON.stringify({
        id: baseEvent.id,
        startTime: baseEvent.startTime,
        endTime: baseEvent.endTime,
        duration: eventDuration,
      })
    );
    return instances; // Return empty if dates are invalid or duration is non-positive
  }
  
  // Define the maximum date we'll check for recurrences
  const latestDate = endDate ? new Date(Math.min(rangeEnd.getTime(), endDate.getTime())) : rangeEnd;
  
  // Generate instances based on frequency
  let currentDate = new Date(baseEvent.startTime);
  
  if (!isValid(currentDate)) {
    console.error(
      '[generateRecurrenceInstancesInRange] Initial currentDate is invalid, derived from baseEvent.startTime:',
      baseEvent.startTime
    );
    return instances;
  }
  
  let iterationCount = 0;
  const MAX_ITERATIONS = 1000; // Safety break for while loop

  while (currentDate <= latestDate) {
    iterationCount++;

    if (iterationCount > MAX_ITERATIONS) {
      console.error("[generateRecurrenceInstancesInRange] Exceeded MAX_ITERATIONS. Breaking loop. BaseEvent:", JSON.stringify(baseEvent, null, 2));
      break;
    }

    const previousCurrentDate = new Date(currentDate); // Store before advancing

    // Skip the original event occurrence
    if (!isSameDay(currentDate, baseEvent.startTime)) {
      // Only include if it falls in our desired range
      if (currentDate >= rangeStart && currentDate <= rangeEnd) {
        // For weekly recurrences, check if this day of week should be included
        const shouldInclude = frequency !== RecurrenceFrequency.Weekly || 
          !daysOfWeek || 
          daysOfWeek.includes(getDay(currentDate));
        
        if (shouldInclude) {
          // Create the instance with same duration as original
          const startTime = new Date(currentDate);
          const endTime = new Date(startTime.getTime() + eventDuration);
          
          if (!isValid(startTime) || !isValid(endTime)) {
            console.error(
              '[generateRecurrenceInstancesInRange] Invalid startTime or endTime for generated instance:',
              JSON.stringify({ baseEventId: baseEvent.id, currentLoopDate: currentDate, instanceStartTime: startTime, instanceEndTime: endTime })
            );
            // Decide: skip this instance or stop? For now, skip.
            continue; 
          }
          instances.push({
            ...baseEvent,
            id: `${baseEvent.id}-recurrence-${format(startTime, 'yyyy-MM-dd')}`,
            startTime,
            endTime,
            // Flag to identify it's a recurrence instance (not stored in database)
            isRecurrenceInstance: true
          });
        }
      }
    }
    
    // Advance to next occurrence based on frequency and interval
    switch (frequency) {
      case RecurrenceFrequency.Daily:
        currentDate = addDays(currentDate, interval);
        break;
      case RecurrenceFrequency.Weekly:
        currentDate = addWeeks(currentDate, interval);
        break;
      case RecurrenceFrequency.BiWeekly:
        currentDate = addWeeks(currentDate, 2 * interval);
        break;
      case RecurrenceFrequency.Monthly:
        currentDate = addMonths(currentDate, interval);
        break;
      case RecurrenceFrequency.Yearly:
        currentDate = addYears(currentDate, interval);
        break;
      default:
        // Stop the loop for any unhandled frequencies
        console.error("[generateRecurrenceInstancesInRange] Unhandled frequency in switch. BaseEvent:", JSON.stringify(baseEvent, null, 2));
        currentDate = new Date(latestDate.getTime() + 1);
    }

    if (currentDate <= previousCurrentDate) {
      console.error("[generateRecurrenceInstancesInRange] currentDate did not advance. Breaking loop to prevent infinite loop. BaseEvent:", JSON.stringify(baseEvent, null, 2), { previousCurrentDate: previousCurrentDate?.toISOString(), currentDate: currentDate?.toISOString(), interval, frequency });
      break;
    }
  }
  
  return instances;
};

/**
 * Format validation schema
 */
export const validateTimeRange = (startTime: string, endTime: string): boolean => {
  const start = parse(startTime, "yyyy-MM-dd'T'HH:mm", new Date());
  const end = parse(endTime, "yyyy-MM-dd'T'HH:mm", new Date());
  return isValid(start) && isValid(end) && end > start;
};

// Ensure all events have calendar properties properly set
export const ensureCalendarPropertiesOnEvents = (
  events: CalendarEvent[], 
  calendars: { id: string; color: string; name: string; isVisible: boolean }[]
): CalendarEvent[] => {
  if (!events.length || !calendars.length) return events;
  
  return events.map(event => {
    // Skip if event already has a calendar with color
    if (event.calendar?.color) return event;
    
    // Find the matching calendar
    const calendar = calendars.find(cal => cal.id === event.calendarId);
    
    if (calendar) {
      return {
        ...event,
        calendar: {
          id: calendar.id,
          name: calendar.name,
          color: calendar.color,
          isVisible: calendar.isVisible,
          isDefault: 'isDefault' in calendar ? (calendar as any).isDefault : false,
          createdAt: 'createdAt' in calendar ? (calendar as any).createdAt : new Date(),
          updatedAt: 'updatedAt' in calendar ? (calendar as any).updatedAt : undefined
        }
      };
    }
    
    return event;
  });
};