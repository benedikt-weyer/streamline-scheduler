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

export type Calendar = CalendarDecrypted;

export interface RecurrencePattern {
  frequency: RecurrenceFrequency;
  endDate?: Date;  // Optional end date for the recurrence
  interval?: number; // How many units between occurrences (default: 1)
  daysOfWeek?: number[]; // For weekly/monthly recurrence (0 = Sunday, 6 = Saturday)
}

export interface CalendarEvent extends CalendarEventDecrypted {
  // UI-specific properties that are computed from the database fields
  recurrencePattern?: RecurrencePattern;
  isRecurrenceInstance?: boolean; // Flag for generated recurrence instances
  calendar?: Calendar; // Associated calendar object for easy access
  
  // Convenience getters for backward compatibility
  startTime: Date;
  endTime: Date;
  calendarId: string;
  isAllDay: boolean;
}



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