'use client';

import { getBackend } from '@/utils/api/backend-interface';
import { EncryptedCalendarEvent, EncryptedCalendar } from '@/utils/calendar/calendar-types';

// Fetch all encrypted calendar events for the current user
export async function fetchCalendarEvents(): Promise<EncryptedCalendarEvent[]> {
  try {
    const backend = getBackend();
    const { data: events } = await backend.calendarEvents.list();
    return events as EncryptedCalendarEvent[];
  } catch (error) {
    console.error('Failed to fetch calendar events:', error);
    throw error;
  }
}

// Add a new encrypted calendar event
export async function addCalendarEvent(
  encryptedData: string,
  iv: string,
  salt: string
): Promise<EncryptedCalendarEvent> {
  try {
    const backend = getBackend();
    const { data: event } = await backend.calendarEvents.create({
      encrypted_data: encryptedData,
      iv,
      salt,
    });
    return event as EncryptedCalendarEvent;
  } catch (error) {
    console.error('Failed to add calendar event:', error);
    throw error;
  }
}

// Update an existing encrypted calendar event
export async function updateCalendarEvent(
  id: string,
  encryptedData: string,
  iv: string,
  salt: string
): Promise<EncryptedCalendarEvent> {
  try {
    const backend = getBackend();
    const { data: event } = await backend.calendarEvents.update(id, {
      encrypted_data: encryptedData,
      iv,
      salt,
    });
    return event as EncryptedCalendarEvent;
  } catch (error) {
    console.error('Failed to update calendar event:', error);
    throw error;
  }
}

// Delete a calendar event
export async function deleteCalendarEvent(id: string): Promise<void> {
  try {
    const backend = getBackend();
    await backend.calendarEvents.delete(id);
  } catch (error) {
    console.error('Failed to delete calendar event:', error);
    throw error;
  }
}

// Fetch all encrypted calendars for the current user
export async function fetchCalendars(): Promise<EncryptedCalendar[]> {
  try {
    const backend = getBackend();
    const { data: calendars } = await backend.calendars.list();
    return calendars as EncryptedCalendar[];
  } catch (error) {
    console.error('Failed to fetch calendars:', error);
    throw error;
  }
}

// Add a new encrypted calendar
export async function addCalendar(
  encryptedData: string,
  iv: string,
  salt: string
): Promise<EncryptedCalendar> {
  try {
    const backend = getBackend();
    const { data: calendar } = await backend.calendars.create({
      encrypted_data: encryptedData,
      iv,
      salt,
    });
    return calendar as EncryptedCalendar;
  } catch (error) {
    console.error('Failed to add calendar:', error);
    throw error;
  }
}

// Update an existing encrypted calendar
export async function updateCalendar(
  id: string,
  encryptedData: string,
  iv: string,
  salt: string,
  isDefault?: boolean
): Promise<EncryptedCalendar> {
  try {
    const backend = getBackend();
    const { data: calendar } = await backend.calendars.update(id, {
      encrypted_data: encryptedData,
      iv,
      salt,
      is_default: isDefault,
    });
    return calendar as EncryptedCalendar;
  } catch (error) {
    console.error('Failed to update calendar:', error);
    throw error;
  }
}

// Delete a calendar
export async function deleteCalendar(id: string): Promise<void> {
  try {
    const backend = getBackend();
    await backend.calendars.delete(id);
  } catch (error) {
    console.error('Failed to delete calendar:', error);
    throw error;
  }
}

// Set a calendar as default
export async function setDefaultCalendar(id: string): Promise<void> {
  try {
    const backend = getBackend();
    // First get the calendar details
    const { data: calendar } = await backend.calendars.get(id);
    // Update it to be the default
    await backend.calendars.update(id, {
      encrypted_data: calendar.encrypted_data,
      iv: calendar.iv,
      salt: calendar.salt,
      is_default: true,
    });
  } catch (error) {
    console.error('Failed to set default calendar:', error);
    throw error;
  }
}