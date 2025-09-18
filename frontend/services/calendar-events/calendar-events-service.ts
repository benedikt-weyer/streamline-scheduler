'use client';

import { DecryptedBackendInterface } from '@/utils/api/decrypted-backend-interface';
import { CalendarEvent } from '@/utils/calendar/calendar-types';
import { CalendarEventDecrypted, CreateCalendarEventDecryptedRequest, UpdateCalendarEventDecryptedRequest } from '@/utils/api/types';
import { processDecryptedEvent, sortEventsByStartTime } from '@/utils/calendar/eventDataProcessing';
import { Calendar } from '@/utils/calendar/calendar-types';

/**
 * Calendar Events Service - handles all calendar event operations using the decrypted backend
 */
export class CalendarEventsService {
  constructor(private backend: DecryptedBackendInterface) {}

  /**
   * Get all calendar events
   */
  async getCalendarEvents(calendars: Calendar[] = []): Promise<CalendarEvent[]> {
    try {
      const { data: eventsData } = await this.backend.calendarEvents.getAll();
      
      const processedEvents = eventsData
        .map(event => {
          try {
            return processDecryptedEvent(event, event, calendars);
          } catch (error) {
            console.error('Error processing event:', error);
            return null;
          }
        })
        .filter((event): event is NonNullable<typeof event> => event !== null);
      
      return sortEventsByStartTime(processedEvents);
    } catch (error) {
      console.error('Failed to fetch calendar events:', error);
      throw new Error('Failed to load calendar events');
    }
  }

  /**
   * Get a specific calendar event by ID
   */
  async getCalendarEventById(id: string, calendars: Calendar[] = []): Promise<CalendarEvent | null> {
    try {
      const { data: eventData } = await this.backend.calendarEvents.getById(id);
      
      if (!eventData) {
        return null;
      }
      
      return processDecryptedEvent(eventData, eventData, calendars);
    } catch (error) {
      console.error(`Failed to fetch calendar event ${id}:`, error);
      throw new Error(`Failed to load calendar event ${id}`);
    }
  }

  /**
   * Create a new calendar event
   */
  async createCalendarEvent(eventData: {
    title: string;
    description?: string;
    location?: string;
    calendarId: string;
    startTime: Date;
    endTime: Date;
    isAllDay?: boolean;
    recurrenceRule?: string;
  }): Promise<CalendarEvent> {
    try {
      const createData: CreateCalendarEventDecryptedRequest = {
        title: eventData.title.trim(),
        description: eventData.description?.trim() || '',
        location: eventData.location?.trim() || '',
        calendar_id: eventData.calendarId,
        start_time: eventData.startTime.toISOString(),
        end_time: eventData.endTime.toISOString(),
        all_day: eventData.isAllDay || false,
        recurrence_rule: eventData.recurrenceRule,
      };

      const { data: newEvent } = await this.backend.calendarEvents.create(createData);
      
      if (!newEvent) {
        throw new Error('Event creation failed - no data returned');
      }

      return this.mapCalendarEventDecryptedToCalendarEvent(newEvent);
    } catch (error) {
      console.error('Failed to create calendar event:', error);
      throw new Error('Failed to create calendar event');
    }
  }

  /**
   * Update an existing calendar event
   */
  async updateCalendarEvent(id: string, updates: {
    title?: string;
    description?: string;
    location?: string;
    calendarId?: string;
    startTime?: Date;
    endTime?: Date;
    isAllDay?: boolean;
    recurrenceRule?: string;
    recurrenceException?: string[];
  }): Promise<CalendarEvent> {
    try {
      const updateData: UpdateCalendarEventDecryptedRequest = {
        id,
        ...(updates.title !== undefined && { title: updates.title.trim() }),
        ...(updates.description !== undefined && { description: updates.description.trim() }),
        ...(updates.location !== undefined && { location: updates.location.trim() }),
        ...(updates.calendarId && { calendar_id: updates.calendarId }),
        ...(updates.startTime && { start_time: updates.startTime.toISOString() }),
        ...(updates.endTime && { end_time: updates.endTime.toISOString() }),
        ...(updates.isAllDay !== undefined && { all_day: updates.isAllDay }),
        ...(updates.recurrenceRule !== undefined && { recurrence_rule: updates.recurrenceRule }),
        ...(updates.recurrenceException && { recurrence_exception: updates.recurrenceException }),
      };

      const { data: updatedEvent } = await this.backend.calendarEvents.update(updateData);
      
      if (!updatedEvent) {
        throw new Error('Event update failed - no data returned');
      }

      return this.mapCalendarEventDecryptedToCalendarEvent(updatedEvent);
    } catch (error) {
      console.error(`Failed to update calendar event ${id}:`, error);
      throw new Error('Failed to update calendar event');
    }
  }

  /**
   * Delete a calendar event
   */
  async deleteCalendarEvent(id: string): Promise<void> {
    try {
      await this.backend.calendarEvents.delete(id);
    } catch (error) {
      console.error(`Failed to delete calendar event ${id}:`, error);
      throw new Error('Failed to delete calendar event');
    }
  }

  /**
   * Clone a calendar event
   */
  async cloneCalendarEvent(event: CalendarEvent): Promise<CalendarEvent> {
    try {
      // Create a copy of the event with a new title and updated timestamps
      const clonedEventData = {
        title: `${event.title} (Copy)`,
        description: event.description,
        location: event.location,
        calendarId: event.calendar_id,
        startTime: new Date(event.start_time),
        endTime: new Date(event.end_time),
        isAllDay: event.all_day || false,
        recurrenceRule: event.recurrence_rule,
      };

      return this.createCalendarEvent(clonedEventData);
    } catch (error) {
      console.error('Failed to clone calendar event:', error);
      throw new Error('Failed to clone calendar event');
    }
  }

  /**
   * Move a calendar event to a different calendar
   */
  async moveEventToCalendar(eventId: string, targetCalendarId: string): Promise<CalendarEvent> {
    return this.updateCalendarEvent(eventId, { calendarId: targetCalendarId });
  }

  /**
   * Get events for a specific calendar
   */
  async getEventsForCalendar(calendarId: string, calendars: Calendar[] = []): Promise<CalendarEvent[]> {
    try {
      const allEvents = await this.getCalendarEvents(calendars);
      return allEvents.filter(event => event.calendar_id === calendarId);
    } catch (error) {
      console.error(`Failed to fetch events for calendar ${calendarId}:`, error);
      throw new Error(`Failed to load events for calendar ${calendarId}`);
    }
  }

  /**
   * Get events within a date range
   */
  async getEventsInRange(startDate: Date, endDate: Date, calendars: Calendar[] = []): Promise<CalendarEvent[]> {
    try {
      const allEvents = await this.getCalendarEvents(calendars);
      return allEvents.filter(event => {
        const eventStart = new Date(event.start_time);
        const eventEnd = new Date(event.end_time);
        
        // Event overlaps with the range if:
        // Event starts before range ends AND event ends after range starts
        return eventStart < endDate && eventEnd > startDate;
      });
    } catch (error) {
      console.error('Failed to fetch events in range:', error);
      throw new Error('Failed to load events in date range');
    }
  }

  /**
   * Search events by title or description
   */
  async searchEvents(query: string, calendars: Calendar[] = []): Promise<CalendarEvent[]> {
    try {
      const allEvents = await this.getCalendarEvents(calendars);
      const searchTerm = query.toLowerCase().trim();
      
      if (!searchTerm) {
        return allEvents;
      }
      
      return allEvents.filter(event => 
        event.title.toLowerCase().includes(searchTerm) ||
        (event.description && event.description.toLowerCase().includes(searchTerm))
      );
    } catch (error) {
      console.error('Failed to search events:', error);
      throw new Error('Failed to search events');
    }
  }

  /**
   * Map CalendarEventDecrypted to CalendarEvent type
   * Since CalendarEvent is just a type alias for CalendarEventDecrypted, this is a pass-through
   */
  private mapCalendarEventDecryptedToCalendarEvent(eventDecrypted: CalendarEventDecrypted): CalendarEvent {
    return eventDecrypted;
  }
}

// No singleton export - services should be instantiated with backend dependency
