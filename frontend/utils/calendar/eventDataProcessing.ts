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
  
  // Parse recurrence rule from JSON string (new format)
  const recurrenceRule = decryptedData.recurrence_rule || decryptedData.recurrenceRule;
  if (recurrenceRule) {
    try {
      const rule = typeof recurrenceRule === 'string' ? JSON.parse(recurrenceRule) : recurrenceRule;
      if (rule.frequency && rule.frequency !== RecurrenceFrequency.None) {
        recurrencePattern = {
          frequency: rule.frequency,
          interval: rule.interval ?? 1,
          endDate: rule.end_date ? new Date(rule.end_date) : undefined,
          daysOfWeek: rule.days_of_week
        };
      }
    } catch (error) {
      console.error('Failed to parse recurrence rule:', recurrenceRule, error);
    }
  }
  
  // Fallback to old format for backward compatibility
  if (!recurrencePattern && decryptedData.recurrenceFrequency && decryptedData.recurrenceFrequency !== RecurrenceFrequency.None) {
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
    // Base CalendarEventDecrypted properties
    id: rawEvent.id,
    title: decryptedData.title,
    description: decryptedData.description,
    location: decryptedData.location,
    calendar_id: calendarId,
    start_time: startTimeValue,
    end_time: endTimeValue,
    all_day: decryptedData.isAllDay ?? decryptedData.all_day ?? false,
    recurrence_rule: decryptedData.recurrence_rule,
    recurrence_exception: decryptedData.recurrence_exception,
    created_at: rawEvent.created_at,
    updated_at: rawEvent.updated_at,
    user_id: rawEvent.user_id,
    
    // UI-specific properties
    recurrencePattern,
    calendar: calendar,
    isRecurrenceInstance: false,
    
    // Convenience properties for backward compatibility
    startTime: startTime,
    endTime: endTime,
    calendarId: calendarId,
    isAllDay: decryptedData.isAllDay ?? decryptedData.all_day ?? false
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
