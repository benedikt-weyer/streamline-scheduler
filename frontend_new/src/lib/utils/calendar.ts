import type { CalendarEvent, Calendar, RecurrenceFrequency, RecurrencePattern } from '$lib/types/calendar';

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
  const days = [];
  const weekStart = getStartOfWeek(currentWeek);
  
  for (let i = 0; i < 7; i++) {
    const day = new Date(weekStart);
    day.setDate(weekStart.getDate() + i);
    days.push(day);
  }
  
  return days;
};

// Get start of week (Monday)
function getStartOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is Sunday
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

// Get end of week (Sunday)
function getEndOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? 0 : 7); // adjust when day is Sunday
  d.setDate(diff);
  d.setHours(23, 59, 59, 999);
  return d;
}

// Check if date is within interval
function isWithinInterval(date: Date, interval: { start: Date; end: Date }): boolean {
  return date >= interval.start && date <= interval.end;
}

// Check if two dates are the same day
function isSameDay(date1: Date, date2: Date): boolean {
  return (
    date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getDate() === date2.getDate()
  );
}

// Filter events for the current week
export const filterEventsForWeek = (events: CalendarEvent[], currentWeek: Date) => {
  if (!events.length) return [];
  
  const weekStart = getStartOfWeek(currentWeek);
  const weekEnd = getEndOfWeek(currentWeek);
  
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
    if (event.recurrencePattern && event.recurrencePattern.frequency !== 'none') {
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
      baseEvent.recurrencePattern.frequency === 'none') {
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
  
  if (!baseEvent.startTime || !baseEvent.endTime || eventDuration <= 0) {
    console.error(
      '[generateRecurrenceInstancesInRange] Invalid baseEvent dates or duration:',
      { id: baseEvent.id, startTime: baseEvent.startTime, endTime: baseEvent.endTime, duration: eventDuration }
    );
    return instances;
  }
  
  // Define the maximum date we'll check for recurrences
  const latestDate = endDate ? new Date(Math.min(rangeEnd.getTime(), endDate.getTime())) : rangeEnd;
  
  // Generate instances based on frequency
  let currentDate = new Date(baseEvent.startTime);
  
  let iterationCount = 0;
  const MAX_ITERATIONS = 1000; // Safety break for while loop

  while (currentDate <= latestDate) {
    iterationCount++;

    if (iterationCount > MAX_ITERATIONS) {
      console.error("[generateRecurrenceInstancesInRange] Exceeded MAX_ITERATIONS. Breaking loop.");
      break;
    }

    const previousCurrentDate = new Date(currentDate);

    // Skip the original event occurrence
    if (!isSameDay(currentDate, baseEvent.startTime)) {
      // Only include if it falls in our desired range
      if (currentDate >= rangeStart && currentDate <= rangeEnd) {
        // For weekly recurrences, check if this day of week should be included
        const shouldInclude = frequency !== 'weekly' || 
          !daysOfWeek || 
          daysOfWeek.includes(currentDate.getDay());
        
        if (shouldInclude) {
          // Create the instance with same duration as original
          const startTime = new Date(currentDate);
          const endTime = new Date(startTime.getTime() + eventDuration);
          
          instances.push({
            ...baseEvent,
            id: `${baseEvent.id}-recurrence-${formatDate(startTime)}`,
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
      case 'daily':
        currentDate = addDays(currentDate, interval);
        break;
      case 'weekly':
        currentDate = addWeeks(currentDate, interval);
        break;
      case 'biweekly':
        currentDate = addWeeks(currentDate, 2 * interval);
        break;
      case 'monthly':
        currentDate = addMonths(currentDate, interval);
        break;
      case 'yearly':
        currentDate = addYears(currentDate, interval);
        break;
      default:
        // Stop the loop for any unhandled frequencies
        console.error("[generateRecurrenceInstancesInRange] Unhandled frequency:", frequency);
        currentDate = new Date(latestDate.getTime() + 1);
    }

    if (currentDate <= previousCurrentDate) {
      console.error("[generateRecurrenceInstancesInRange] currentDate did not advance. Breaking loop.");
      break;
    }
  }
  
  return instances;
};

// Helper functions for date arithmetic
function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function addWeeks(date: Date, weeks: number): Date {
  return addDays(date, weeks * 7);
}

function addMonths(date: Date, months: number): Date {
  const result = new Date(date);
  result.setMonth(result.getMonth() + months);
  return result;
}

function addYears(date: Date, years: number): Date {
  const result = new Date(date);
  result.setFullYear(result.getFullYear() + years);
  return result;
}

function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

/**
 * Format validation schema
 */
export const validateTimeRange = (startTime: string, endTime: string): boolean => {
  const start = new Date(startTime);
  const end = new Date(endTime);
  return !isNaN(start.getTime()) && !isNaN(end.getTime()) && end > start;
};

// Ensure all events have calendar properties properly set
export const ensureCalendarPropertiesOnEvents = (
  events: CalendarEvent[], 
  calendars: Calendar[]
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
          isDefault: calendar.isDefault,
          type: calendar.type,
          icsUrl: calendar.icsUrl,
          lastSync: calendar.lastSync,
          createdAt: calendar.createdAt,
          updatedAt: calendar.updatedAt
        }
      };
    }
    
    return event;
  });
};
