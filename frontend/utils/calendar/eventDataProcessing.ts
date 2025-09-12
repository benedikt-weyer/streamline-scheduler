import { CalendarEvent, Calendar, RecurrencePattern, RecurrenceFrequency } from '@/utils/calendar/calendar-types';
import { isValid } from 'date-fns';
import { combineDateAndTime, createRecurrencePattern } from './recurrenceHelpers';

/**
 * Processes and validates event data before encryption
 */
export const processEventData = (values: any, calendars: Calendar[]) => {
  const startDateTime = combineDateAndTime(values.startDate, values.startTime || '00:00');
  const endDateTime = combineDateAndTime(values.endDate, values.endTime || '23:59');
  
  const recurrencePattern = createRecurrencePattern(
    values.recurrenceFrequency,
    values.recurrenceInterval,
    values.recurrenceEndDate,
    values.daysOfWeek
  );
  
  const calendar = calendars.find(cal => cal.id === values.calendarId);
  
  const eventData = {
    title: values.title.trim(),
    description: values.description?.trim() ?? '',
    location: values.location?.trim() ?? '',
    calendarId: values.calendarId,
    isAllDay: values.isAllDay ?? false,
    startTime: startDateTime.toISOString(),
    endTime: endDateTime.toISOString(),
    recurrenceFrequency: values.recurrenceFrequency,
    recurrenceEndDate: values.recurrenceEndDate ? new Date(values.recurrenceEndDate).toISOString() : undefined,
    recurrenceInterval: values.recurrenceInterval,
    daysOfWeek: values.daysOfWeek
  };
  
  return {
    eventData,
    startDateTime,
    endDateTime,
    recurrencePattern,
    calendar
  };
};

/**
 * Processes decrypted event data into CalendarEvent format
 */
export const processDecryptedEvent = (
  rawEvent: any,
  decryptedData: any,
  calendars: Calendar[]
): CalendarEvent | null => {
  // Handle both camelCase and snake_case field names for backward compatibility
  const startTimeValue = decryptedData.startTime || decryptedData.start_time;
  const endTimeValue = decryptedData.endTime || decryptedData.end_time;
  
  const startTime = new Date(startTimeValue);
  const endTime = new Date(endTimeValue);
  
  if (!isValid(startTime) || !isValid(endTime)) {
    console.error('Invalid date found for event after decryption:', rawEvent.id, 
      { startTime: startTimeValue, endTime: endTimeValue, decryptedData });
    return null;
  }
  
  let recurrencePattern: RecurrencePattern | undefined;
  if (decryptedData.recurrenceFrequency && decryptedData.recurrenceFrequency !== RecurrenceFrequency.None) {
    recurrencePattern = {
      frequency: decryptedData.recurrenceFrequency,
      interval: decryptedData.recurrenceInterval ?? 1,
      endDate: decryptedData.recurrenceEndDate ? new Date(decryptedData.recurrenceEndDate) : undefined,
      daysOfWeek: decryptedData.daysOfWeek
    };
  }
  
  // Handle both camelCase and snake_case for calendar ID
  const calendarId = decryptedData.calendarId || decryptedData.calendar_id;
  const calendar = calendars.find(cal => cal.id === calendarId);
  
  return {
    id: rawEvent.id,
    title: decryptedData.title,
    description: decryptedData.description,
    location: decryptedData.location,
    calendarId: calendarId,
    calendar: calendar,
    isAllDay: decryptedData.isAllDay ?? decryptedData.all_day ?? false,
    startTime,
    endTime,
    recurrencePattern,
    createdAt: new Date(rawEvent.created_at),
    updatedAt: rawEvent.updated_at ? new Date(rawEvent.updated_at) : undefined
  };
};

/**
 * Sorts events by start time
 */
export const sortEventsByStartTime = (events: CalendarEvent[]): CalendarEvent[] => {
  return events
    .filter(event => isValid(event.startTime))
    .sort((a, b) => a.startTime.getTime() - b.startTime.getTime());
};
