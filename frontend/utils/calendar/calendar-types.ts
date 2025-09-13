import { CalendarDecrypted, CalendarEncrypted, CalendarEventDecrypted, CalendarEventEncrypted } from '@/utils/api/types';

// Define recurring event frequency options
export enum RecurrenceFrequency {
  None = 'none',
  Daily = 'daily',
  Weekly = 'weekly',
  BiWeekly = 'biweekly', // Every two weeks
  Monthly = 'monthly',
  Yearly = 'yearly'
}

// Define calendar types
export enum CalendarType {
  Regular = 'regular',
  ICS = 'ics'
}

export interface Calendar extends Omit<CalendarDecrypted, 'created_at' | 'updated_at' | 'is_visible' | 'is_default' | 'ics_url' | 'last_sync'> {
  isVisible: boolean;
  isDefault: boolean;
  type: CalendarType;
  icsUrl?: string; // Optional ICS URL for ICS calendars
  lastSync?: Date; // Last sync time for ICS calendars
  createdAt: Date;
  updatedAt?: Date;
}

// Re-export encrypted type for convenience
export type EncryptedCalendar = CalendarEncrypted;

export interface RecurrencePattern {
  frequency: RecurrenceFrequency;
  endDate?: Date;  // Optional end date for the recurrence
  interval?: number; // How many units between occurrences (default: 1)
  daysOfWeek?: number[]; // For weekly/monthly recurrence (0 = Sunday, 6 = Saturday)
}

export interface CalendarEvent extends Omit<CalendarEventDecrypted, 'created_at' | 'updated_at' | 'start_time' | 'end_time' | 'all_day' | 'calendar_id'> {
  startTime: Date;
  endTime: Date;
  isAllDay?: boolean; // New property for all-day events
  calendarId: string; // Reference to the calendar
  calendar?: Calendar; // Optional calendar object
  createdAt: Date;
  updatedAt?: Date;
  recurrencePattern?: RecurrencePattern; // Optional recurrence pattern
  isRecurrenceInstance?: boolean; // Flag to indicate if this is an instance of a recurring event
  clickedOccurrenceDate?: Date; // The start date of a specific occurrence that was interacted with
}

// Re-export encrypted type for convenience
export type EncryptedCalendarEvent = CalendarEventEncrypted;

export interface EventFormValues {
  id?: string;
  title: string;
  description?: string;
  location?: string;
  startDate: string;
  startTime: string;
  endDate: string;
  endTime: string;
  isAllDay?: boolean; // New property for all-day events
  calendarId: string;
  recurrenceFrequency?: RecurrenceFrequency;
  recurrenceEndDate?: string;
  recurrenceInterval?: number;
  daysOfWeek?: number[];
}