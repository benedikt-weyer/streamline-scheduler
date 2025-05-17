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
  isSameDay
} from 'date-fns';
import { CalendarEvent } from './types';

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
  
  return events.filter(event => 
    isWithinInterval(event.startTime, { start: weekStart, end: weekEnd }) ||
    isWithinInterval(event.endTime, { start: weekStart, end: weekEnd }) ||
    (event.startTime < weekStart && event.endTime > weekEnd)
  );
};

// Format validation schema
export const validateTimeRange = (startTime: string, endTime: string): boolean => {
  const start = parse(startTime, "yyyy-MM-dd'T'HH:mm", new Date());
  const end = parse(endTime, "yyyy-MM-dd'T'HH:mm", new Date());
  return isValid(start) && isValid(end) && end > start;
};