export interface CanDoItem {
  id: string;
  content: string;
  completed: boolean;
  createdAt: Date;
  updatedAt?: Date;
}

export interface EncryptedCanDoItem {
  id: string;
  user_id: string;
  encrypted_data: string;
  iv: string;
  salt: string;
  created_at: string;
  updated_at: string;
}

export interface CanDoList {
  items: CanDoItem[];
}

// Define recurring event frequency options
export enum RecurrenceFrequency {
  None = 'none',
  Daily = 'daily',
  Weekly = 'weekly',
  BiWeekly = 'biweekly', // Every two weeks
  Monthly = 'monthly',
  Yearly = 'yearly'
}

export interface Calendar {
  id: string;
  name: string;
  color: string;
  isVisible: boolean;
  isDefault: boolean;
  createdAt: Date;
  updatedAt?: Date;
}

export interface EncryptedCalendar {
  id: string;
  user_id: string;
  encrypted_data: string;
  iv: string;
  salt: string;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

export interface RecurrencePattern {
  frequency: RecurrenceFrequency;
  endDate?: Date;  // Optional end date for the recurrence
  interval?: number; // How many units between occurrences (default: 1)
  daysOfWeek?: number[]; // For weekly/monthly recurrence (0 = Sunday, 6 = Saturday)
}

export interface CalendarEvent {
  id: string;
  title: string;
  description?: string;
  startTime: Date;
  endTime: Date;
  calendarId: string; // Reference to the calendar
  calendar?: Calendar; // Optional calendar object
  createdAt: Date;
  updatedAt?: Date;
  recurrencePattern?: RecurrencePattern; // Optional recurrence pattern
}

export interface EncryptedCalendarEvent {
  id: string;
  user_id: string;
  encrypted_data: string;
  iv: string;
  salt: string;
  created_at: string;
  updated_at: string;
}