'use client';

import { Calendar, CalendarEvent, CalendarType } from '@/utils/calendar/calendar-types';
import { EventFormValues } from '@/components/calendar/calendar-event-dialog';
import { CalendarService } from '@/services/calendar/calendar-service';
import { CalendarEventsService } from '@/services/calendar-events/calendar-events-service';
import { fetchAndParseICSCalendar } from '@/utils/calendar/ics-parser';
import { DecryptedBackendInterface } from '@/utils/api/decrypted-backend-interface';

/**
 * Calendar Page Service - combines calendar and calendar events services
 * to provide higher-level operations specific to the calendar page
 */
export class CalendarPageService {
  private calendarService: CalendarService;
  public calendarEventsService: CalendarEventsService;

  constructor(backend: DecryptedBackendInterface) {
    this.calendarService = new CalendarService(backend);
    this.calendarEventsService = new CalendarEventsService(backend);
  }
  /**
   * Load all calendars and events together
   */
  async loadCalendarData(): Promise<{ calendars: Calendar[]; events: CalendarEvent[] }> {
    try {
      // Load calendars first
      const calendars = await this.calendarService.getCalendars();
      
      // Then load events with calendar context
      const events = await this.calendarEventsService.getCalendarEvents(calendars);
      
      return { calendars, events };
    } catch (error) {
      console.error('Failed to load calendar data:', error);
      throw new Error('Failed to load calendar data');
    }
  }

  /**
   * Create a new calendar and ensure default calendar exists
   */
  async createCalendar(name: string, color: string): Promise<{ calendar: Calendar; shouldRefreshEvents: boolean }> {
    try {
      const calendar = await this.calendarService.createCalendar(name, color);
      
      // Check if this is the first calendar (should be set as default)
      const allCalendars = await this.calendarService.getCalendars();
      if (allCalendars.length === 1) {
        const updatedCalendar = await this.calendarService.setDefaultCalendar(calendar.id);
        return { calendar: updatedCalendar, shouldRefreshEvents: false };
      }
      
      return { calendar, shouldRefreshEvents: false };
    } catch (error) {
      console.error('Failed to create calendar:', error);
      throw new Error('Failed to create calendar');
    }
  }

  /**
   * Create an ICS calendar
   */
  async createICSCalendar(name: string, color: string, icsUrl: string): Promise<{ calendar: Calendar; shouldRefreshEvents: boolean }> {
    try {
      const calendar = await this.calendarService.createICSCalendar(name, color, icsUrl);
      return { calendar, shouldRefreshEvents: true }; // ICS calendars may have events to load
    } catch (error) {
      console.error('Failed to create ICS calendar:', error);
      throw new Error('Failed to create ICS calendar');
    }
  }

  /**
   * Toggle calendar visibility
   */
  async toggleCalendarVisibility(calendarId: string, isVisible: boolean): Promise<Calendar> {
    try {
      return await this.calendarService.toggleCalendarVisibility(calendarId, isVisible);
    } catch (error) {
      console.error(`Failed to toggle calendar visibility for ${calendarId}:`, error);
      throw new Error('Failed to toggle calendar visibility');
    }
  }

  /**
   * Edit calendar details
   */
  async editCalendar(id: string, name: string, color: string): Promise<Calendar> {
    try {
      return await this.calendarService.updateCalendar(id, { name, color });
    } catch (error) {
      console.error(`Failed to edit calendar ${id}:`, error);
      throw new Error('Failed to edit calendar');
    }
  }

  /**
   * Set a calendar as default
   */
  async setDefaultCalendar(calendarId: string): Promise<Calendar> {
    try {
      // First, unset all other calendars as default
      const allCalendars = await this.calendarService.getCalendars();
      for (const calendar of allCalendars) {
        if (calendar.id !== calendarId && calendar.is_default) {
          await this.calendarService.updateCalendar(calendar.id, { isDefault: false });
        }
      }
      
      // Then set the selected calendar as default
      return await this.calendarService.setDefaultCalendar(calendarId);
    } catch (error) {
      console.error(`Failed to set default calendar ${calendarId}:`, error);
      throw new Error('Failed to set default calendar');
    }
  }

  /**
   * Delete a calendar and handle its events
   * Returns the target calendar ID where events were moved, or undefined if no events existed
   */
  async deleteCalendarWithEvents(
    calendarId: string,
    moveEventToCalendar?: (eventId: string, targetCalendarId: string) => Promise<void>
  ): Promise<string | undefined> {
    try {
      // Get all calendars first
      const allCalendars = await this.calendarService.getCalendars();
      const calendarToDelete = allCalendars.find(cal => cal.id === calendarId);
      
      if (!calendarToDelete) {
        throw new Error('Calendar not found');
      }

      // Get all events in this calendar
      const eventsInCalendar = await this.calendarEventsService.getEventsForCalendar(calendarId, allCalendars);
      
      let targetCalendarId: string | undefined;
      
      // If there are events, we need to move them to another calendar
      if (eventsInCalendar.length > 0) {
        // Find a target calendar (prefer default, then first available)
        const remainingCalendars = allCalendars.filter(cal => cal.id !== calendarId);
        
        if (remainingCalendars.length === 0) {
          throw new Error('Cannot delete the last calendar with events');
        }
        
        const targetCalendar = remainingCalendars.find(cal => cal.is_default) || remainingCalendars[0];
        targetCalendarId = targetCalendar.id;
        
        // Move all events to the target calendar
        for (const event of eventsInCalendar) {
          if (moveEventToCalendar) {
            await moveEventToCalendar(event.id, targetCalendarId);
          } else {
            await this.calendarEventsService.moveEventToCalendar(event.id, targetCalendarId);
          }
        }
      }
      
      // If this was the default calendar, set another as default
      if (calendarToDelete.is_default) {
        const remainingCalendars = allCalendars.filter(cal => cal.id !== calendarId);
        if (remainingCalendars.length > 0) {
          await this.calendarService.setDefaultCalendar(remainingCalendars[0].id);
        }
      }
      
      // Finally, delete the calendar
      await this.calendarService.deleteCalendar(calendarId);
      
      return targetCalendarId;
    } catch (error) {
      console.error(`Failed to delete calendar with events ${calendarId}:`, error);
      throw new Error('Failed to delete calendar and move events');
    }
  }

  /**
   * Refresh an ICS calendar
   */
  async refreshICSCalendar(calendarId: string): Promise<{ calendar: Calendar; shouldRefreshEvents: boolean }> {
    try {
      const calendar = await this.calendarService.refreshICSCalendar(calendarId);
      return { calendar, shouldRefreshEvents: true };
    } catch (error) {
      console.error(`Failed to refresh ICS calendar ${calendarId}:`, error);
      throw new Error('Failed to refresh ICS calendar');
    }
  }

  /**
   * Submit an event (create or update)
   */
  async submitEvent(values: EventFormValues): Promise<{ event: CalendarEvent; isUpdate: boolean }> {
    try {
      const isUpdate = !!values.id && values.id !== 'new';
      
      const eventData = {
        title: values.title,
        description: values.description,
        location: values.location,
        calendarId: values.calendarId,
        startTime: new Date(`${values.startDate}T${values.startTime}`),
        endTime: new Date(`${values.endDate}T${values.endTime}`),
        isAllDay: values.isAllDay,
        recurrenceRule: this.buildRecurrenceRule(values),
        isGroupEvent: values.isGroupEvent,
        parentGroupEventId: values.parentGroupEventId,
      };
      
      let event: CalendarEvent;
      
      if (isUpdate) {
        event = await this.calendarEventsService.updateCalendarEvent(values.id!, eventData);
      } else {
        event = await this.calendarEventsService.createCalendarEvent(eventData);
      }
      
      return { event, isUpdate };
    } catch (error) {
      console.error('Failed to submit event:', error);
      throw new Error('Failed to save event');
    }
  }

  /**
   * Delete a calendar event
   */
  async deleteEvent(eventId: string): Promise<void> {
    try {
      await this.calendarEventsService.deleteCalendarEvent(eventId);
    } catch (error) {
      console.error(`Failed to delete event ${eventId}:`, error);
      throw new Error('Failed to delete event');
    }
  }

  /**
   * Clone a calendar event
   */
  async cloneEvent(event: CalendarEvent): Promise<CalendarEvent> {
    try {
      return await this.calendarEventsService.cloneCalendarEvent(event);
    } catch (error) {
      console.error('Failed to clone event:', error);
      throw new Error('Failed to clone event');
    }
  }

  /**
   * Move an event to a different calendar
   */
  async moveEventToCalendar(eventId: string, targetCalendarId: string): Promise<CalendarEvent> {
    try {
      return await this.calendarEventsService.moveEventToCalendar(eventId, targetCalendarId);
    } catch (error) {
      console.error(`Failed to move event ${eventId} to calendar ${targetCalendarId}:`, error);
      throw new Error('Failed to move event');
    }
  }

  /**
   * Update an event (for drag/drop operations)
   */
  async updateEvent(eventId: string, updates: Partial<{
    title: string;
    description: string;
    location: string;
    startTime: Date;
    endTime: Date;
    isAllDay: boolean;
    calendarId: string;
    isGroupEvent: boolean;
    parentGroupEventId: string;
  }>): Promise<CalendarEvent> {
    try {
      return await this.calendarEventsService.updateCalendarEvent(eventId, updates);
    } catch (error) {
      console.error(`Failed to update event ${eventId}:`, error);
      throw new Error('Failed to update event');
    }
  }

  /**
   * Get events within a date range
   */
  async getEventsInRange(startDate: Date, endDate: Date, calendars: Calendar[]): Promise<CalendarEvent[]> {
    try {
      return await this.calendarEventsService.getEventsInRange(startDate, endDate, calendars);
    } catch (error) {
      console.error('Failed to get events in range:', error);
      throw new Error('Failed to load events in date range');
    }
  }

  /**
   * Search events
   */
  async searchEvents(query: string, calendars: Calendar[]): Promise<CalendarEvent[]> {
    try {
      return await this.calendarEventsService.searchEvents(query, calendars);
    } catch (error) {
      console.error('Failed to search events:', error);
      throw new Error('Failed to search events');
    }
  }

  /**
   * Ensure a default calendar exists
   */
  async ensureDefaultCalendar(): Promise<Calendar> {
    try {
      const defaultCalendar = await this.calendarService.getDefaultCalendar();
      
      if (defaultCalendar) {
        return defaultCalendar;
      }
      
      // Create a default calendar
      return await this.calendarService.createDefaultCalendar();
    } catch (error) {
      console.error('Failed to ensure default calendar exists:', error);
      throw new Error('Failed to create default calendar');
    }
  }

  /**
   * Get visible calendars only
   */
  async getVisibleCalendars(): Promise<Calendar[]> {
    try {
      const allCalendars = await this.calendarService.getCalendars();
      return allCalendars.filter(calendar => calendar.is_visible);
    } catch (error) {
      console.error('Failed to get visible calendars:', error);
      throw new Error('Failed to load visible calendars');
    }
  }

  /**
   * Build recurrence rule string from form values
   */
  private buildRecurrenceRule(values: EventFormValues): string | undefined {
    if (!values.recurrenceFrequency || values.recurrenceFrequency === 'none') {
      return undefined;
    }
    
    const rule = {
      frequency: values.recurrenceFrequency,
      interval: values.recurrenceInterval || 1,
      end_date: values.recurrenceEndDate ? new Date(values.recurrenceEndDate).toISOString() : undefined,
      // days_of_week will be handled by the recurrence logic if needed
    };
    
    return JSON.stringify(rule);
  }

  /**
   * Validate calendar operation
   */
  async validateCalendarOperation(operation: 'delete' | 'move', calendarId: string): Promise<{ 
    isValid: boolean; 
    message?: string; 
    eventCount?: number;
    targetCalendars?: Calendar[];
  }> {
    try {
      const allCalendars = await this.calendarService.getCalendars();
      const calendar = allCalendars.find(cal => cal.id === calendarId);
      
      if (!calendar) {
        return { isValid: false, message: 'Calendar not found' };
      }
      
      const eventsInCalendar = await this.calendarEventsService.getEventsForCalendar(calendarId, allCalendars);
      const eventCount = eventsInCalendar.length;
      
      if (operation === 'delete') {
        const remainingCalendars = allCalendars.filter(cal => cal.id !== calendarId);
        
        if (eventCount > 0 && remainingCalendars.length === 0) {
          return { 
            isValid: false, 
            message: 'Cannot delete the last calendar that contains events',
            eventCount 
          };
        }
        
        return { 
          isValid: true, 
          eventCount,
          targetCalendars: remainingCalendars 
        };
      }
      
      return { isValid: true, eventCount };
    } catch (error) {
      console.error('Failed to validate calendar operation:', error);
      return { isValid: false, message: 'Failed to validate operation' };
    }
  }

  /**
   * Get calendar statistics
   */
  async getCalendarStats(): Promise<{
    totalCalendars: number;
    totalEvents: number;
    visibleCalendars: number;
    icsCalendars: number;
    defaultCalendarId?: string;
  }> {
    try {
      const calendars = await this.calendarService.getCalendars();
      const events = await this.calendarEventsService.getCalendarEvents(calendars);
      
      return {
        totalCalendars: calendars.length,
        totalEvents: events.length,
        visibleCalendars: calendars.filter(cal => cal.is_visible).length,
        icsCalendars: calendars.filter(cal => cal.type === 'ics').length,
        defaultCalendarId: calendars.find(cal => cal.is_default)?.id,
      };
    } catch (error) {
      console.error('Failed to get calendar stats:', error);
      throw new Error('Failed to load calendar statistics');
    }
  }

  /**
   * Fetch ICS events for a specific calendar
   */
  async fetchICSEventsForCalendar(calendar: Calendar): Promise<CalendarEvent[]> {
    if (calendar.type !== 'ics' || !calendar.ics_url) {
      return [];
    }
    
    try {
      const events = await fetchAndParseICSCalendar(calendar.ics_url, calendar.id);
      // Attach the full calendar object to each event for proper color rendering
      return events.map(event => ({
        ...event,
        calendar: calendar,
        calendar_id: calendar.id
      }));
    } catch (error) {
      console.error(`Error fetching ICS events for calendar ${calendar.name}:`, error);
      
      // Check if it's a CORS error and provide helpful message
      if (error instanceof Error && error.message.includes('CORS_ERROR')) {
        throw new Error(`CORS Error: The calendar "${calendar.name}" does not allow cross-origin requests. Please contact your calendar provider to enable CORS, or use a different calendar URL.`);
      }
      
      // Handle other specific errors
      if (error instanceof Error && error.message.includes('timeout')) {
        throw new Error(`Timeout: The calendar "${calendar.name}" took too long to respond. Please check the URL and try again.`);
      }
      
      if (error instanceof Error && error.message.includes('Invalid ICS file format')) {
        throw new Error(`Invalid Format: The URL for calendar "${calendar.name}" does not point to a valid ICS calendar file.`);
      }
      
      // Generic fallback
      throw new Error(`Failed to fetch events for calendar "${calendar.name}": ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Fetch all ICS events from all ICS calendars
   */
  async fetchAllICSEvents(calendars?: Calendar[]): Promise<CalendarEvent[]> {
    try {
      const allCalendars = calendars || await this.calendarService.getCalendars();
      const icsCalendars = allCalendars.filter(calendar => calendar.type === 'ics');
      
      if (icsCalendars.length === 0) {
        return [];
      }

      const allEvents: CalendarEvent[] = [];
      
      // Fetch events for each ICS calendar
      for (const calendar of icsCalendars) {
        try {
          const events = await this.fetchICSEventsForCalendar(calendar);
          allEvents.push(...events);
        } catch (error) {
          // Continue with other calendars even if one fails
          console.error(`Failed to fetch events for ICS calendar ${calendar.name}:`, error);
        }
      }
      
      return allEvents;
    } catch (error) {
      console.error('Error fetching all ICS events:', error);
      throw new Error('Failed to fetch ICS calendar events');
    }
  }

  /**
   * Refresh ICS events for a specific calendar
   */
  async refreshICSEventsForCalendar(calendarId: string, calendars?: Calendar[]): Promise<{
    events: CalendarEvent[];
    calendar: Calendar;
  }> {
    try {
      const allCalendars = calendars || await this.calendarService.getCalendars();
      const calendar = allCalendars.find(cal => cal.id === calendarId && cal.type === 'ics');
      
      if (!calendar) {
        throw new Error('ICS calendar not found');
      }

      const events = await this.fetchICSEventsForCalendar(calendar);
      
      return { events, calendar };
    } catch (error) {
      console.error(`Error refreshing ICS calendar ${calendarId}:`, error);
      throw new Error('Failed to refresh ICS calendar');
    }
  }

  /**
   * Get all events (regular + ICS) for the calendar page
   */
  async getAllEventsWithICS(): Promise<{
    regularEvents: CalendarEvent[];
    icsEvents: CalendarEvent[];
    allEvents: CalendarEvent[];
  }> {
    try {
      const calendars = await this.calendarService.getCalendars();
      
      // Get regular events (stored in database)
      const regularCalendars = calendars.filter(cal => cal.type === 'regular');
      const regularEvents = regularCalendars.length > 0 
        ? await this.calendarEventsService.getCalendarEvents(regularCalendars)
        : [];
      
      // Get ICS events (fetched from external sources)
      const icsEvents = await this.fetchAllICSEvents(calendars);
      
      // Combine all events
      const allEvents = [...regularEvents, ...icsEvents];
      
      return {
        regularEvents,
        icsEvents,
        allEvents
      };
    } catch (error) {
      console.error('Failed to load all events with ICS:', error);
      throw new Error('Failed to load calendar events');
    }
  }

  /**
   * Check if an event is from an ICS calendar
   */
  isICSEvent(event: CalendarEvent): boolean {
    return event.id.startsWith('ics-');
  }

  /**
   * Check if a calendar is read-only (ICS calendars are read-only)
   */
  isReadOnlyCalendar(calendarId: string, calendars?: Calendar[]): boolean {
    if (!calendars) {
      // If calendars not provided, check by event ID pattern as fallback
      return false; // Would need calendars to properly determine
    }
    
    const calendar = calendars.find(cal => cal.id === calendarId);
    return calendar?.type === 'ics' || false;
  }

  /**
   * Get events within a date range (including ICS events)
   */
  async getEventsInRangeWithICS(
    startDate: Date, 
    endDate: Date, 
    calendars?: Calendar[]
  ): Promise<CalendarEvent[]> {
    try {
      const { allEvents } = await this.getAllEventsWithICS();
      
      // Filter events within the date range
      return allEvents.filter(event => {
        const eventStart = new Date(event.start_time);
        const eventEnd = new Date(event.end_time);
        
        // Event overlaps with range if:
        // - Event starts before range ends AND event ends after range starts
        return eventStart <= endDate && eventEnd >= startDate;
      });
    } catch (error) {
      console.error('Failed to get events in range with ICS:', error);
      throw new Error('Failed to load events in date range');
    }
  }

  /**
   * Search events (including ICS events)
   */
  async searchEventsWithICS(query: string, calendars?: Calendar[]): Promise<CalendarEvent[]> {
    try {
      const { allEvents } = await this.getAllEventsWithICS();
      
      const lowercaseQuery = query.toLowerCase();
      
      return allEvents.filter(event => 
        event.title.toLowerCase().includes(lowercaseQuery) ||
        (event.description && event.description.toLowerCase().includes(lowercaseQuery)) ||
        (event.location && event.location.toLowerCase().includes(lowercaseQuery))
      );
    } catch (error) {
      console.error('Failed to search events with ICS:', error);
      throw new Error('Failed to search events');
    }
  }
}

// No singleton export - service should be instantiated with backend dependency
