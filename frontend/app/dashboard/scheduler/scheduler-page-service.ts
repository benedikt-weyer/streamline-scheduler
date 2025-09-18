'use client';

import { Calendar, CalendarEvent } from '@/utils/calendar/calendar-types';
import { CalendarService } from '@/services/calendar/calendar-service';
import { CalendarEventsService } from '@/services/calendar-events/calendar-events-service';
import { fetchAndParseICSCalendar } from '@/utils/calendar/ics-parser';
import { DecryptedBackendInterface } from '@/utils/api/decrypted-backend-interface';
import { EventFormValues } from '@/components/dashboard/calendar/calendar-event-dialog';

/**
 * Scheduler Page Service - provides scheduler-specific operations
 * combining calendar and calendar events services with scheduler-specific logic
 */
export class SchedulerPageService {
  private calendarService: CalendarService;
  public calendarEventsService: CalendarEventsService;

  constructor(backend: DecryptedBackendInterface) {
    this.calendarService = new CalendarService(backend);
    this.calendarEventsService = new CalendarEventsService(backend);
  }

  /**
   * Load all calendars and events for the scheduler
   */
  async loadSchedulerData(): Promise<{ calendars: Calendar[]; events: CalendarEvent[] }> {
    try {
      // Load calendars first
      const calendars = await this.calendarService.getCalendars();
      
      // Then load events with calendar context
      const events = await this.calendarEventsService.getCalendarEvents(calendars);
      
      return { calendars, events };
    } catch (error) {
      console.error('Failed to load scheduler data:', error);
      throw new Error('Failed to load scheduler data');
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
      const events = await fetchAndParseICSCalendar(calendar.ics_url);
      // Transform and add calendar_id to each event
      return events.map(event => ({
        ...event,
        calendar_id: calendar.id,
        user_id: calendar.user_id
      }));
    } catch (error) {
      console.error(`Failed to fetch ICS events for calendar ${calendar.id}:`, error);
      return [];
    }
  }

  /**
   * Fetch all ICS events from all ICS calendars
   */
  async fetchAllICSEvents(calendars: Calendar[]): Promise<CalendarEvent[]> {
    const icsCalendars = calendars.filter(cal => cal.type === 'ics' && cal.ics_url);
    
    if (icsCalendars.length === 0) {
      return [];
    }

    try {
      const allICSEvents = await Promise.all(
        icsCalendars.map(calendar => this.fetchICSEventsForCalendar(calendar))
      );
      
      return allICSEvents.flat();
    } catch (error) {
      console.error('Failed to fetch ICS events:', error);
      throw new Error('Failed to load ICS calendar events');
    }
  }

  /**
   * Refresh ICS events for a specific calendar
   */
  async refreshICSEventsForCalendar(
    calendarId: string, 
    calendars: Calendar[]
  ): Promise<{ events: CalendarEvent[]; calendar: Calendar }> {
    const calendar = calendars.find(cal => cal.id === calendarId);
    if (!calendar) {
      throw new Error('Calendar not found');
    }

    if (calendar.type !== 'ics') {
      throw new Error('Calendar is not an ICS calendar');
    }

    try {
      // Update the calendar's last sync time
      const updatedCalendar = await this.calendarService.updateCalendar(calendarId, {
        last_sync: new Date().toISOString()
      });

      // Fetch fresh ICS events
      const events = await this.fetchICSEventsForCalendar(updatedCalendar);

      return { events, calendar: updatedCalendar };
    } catch (error) {
      console.error(`Failed to refresh ICS calendar ${calendarId}:`, error);
      throw new Error('Failed to refresh ICS calendar');
    }
  }

  /**
   * Toggle calendar visibility
   */
  async toggleCalendarVisibility(calendarId: string, isVisible: boolean): Promise<Calendar> {
    return await this.calendarService.toggleCalendarVisibility(calendarId, isVisible);
  }

  /**
   * Create a new calendar
   */
  async createCalendar(name: string, color: string): Promise<{ calendar: Calendar; shouldRefreshEvents: boolean }> {
    const calendar = await this.calendarService.createCalendar(name, color);
    return { calendar, shouldRefreshEvents: false }; // Regular calendars don't need event refresh
  }

  /**
   * Create a new ICS calendar
   */
  async createICSCalendar(name: string, color: string, icsUrl: string): Promise<{ calendar: Calendar; shouldRefreshEvents: boolean }> {
    const calendar = await this.calendarService.createICSCalendar(name, color, icsUrl);
    return { calendar, shouldRefreshEvents: true }; // ICS calendars need to fetch events
  }

  /**
   * Edit an existing calendar
   */
  async editCalendar(id: string, name: string, color: string): Promise<Calendar> {
    return await this.calendarService.updateCalendar(id, { name, color });
  }

  /**
   * Delete a calendar and handle its events
   */
  async deleteCalendarWithEvents(
    calendarId: string,
    moveEventCallback: (eventId: string, targetCalendarId: string) => Promise<void>
  ): Promise<string | undefined> {
    return await this.calendarService.deleteCalendarWithEvents(calendarId, moveEventCallback);
  }

  /**
   * Set a calendar as default
   */
  async setDefaultCalendar(calendarId: string): Promise<void> {
    return await this.calendarService.setDefaultCalendar(calendarId);
  }

  /**
   * Submit an event (create or update)
   */
  async submitEvent(values: EventFormValues): Promise<{ event: CalendarEvent; isUpdate: boolean }> {
    const isUpdate = !!values.id;
    
    // Convert form values to proper Date objects
    const startDateTime = values.isAllDay 
      ? new Date(`${values.startDate}T00:00:00`)
      : new Date(`${values.startDate}T${values.startTime}`);
    
    const endDateTime = values.isAllDay 
      ? new Date(`${values.endDate}T23:59:59`)
      : new Date(`${values.endDate}T${values.endTime}`);
    
    if (isUpdate) {
      const updatedEvent = await this.calendarEventsService.updateCalendarEvent(values.id!, {
        title: values.title,
        description: values.description,
        location: values.location,
        calendarId: values.calendarId,
        startTime: startDateTime,
        endTime: endDateTime,
        isAllDay: values.isAllDay
      });
      return { event: updatedEvent, isUpdate: true };
    } else {
      const newEvent = await this.calendarEventsService.createCalendarEvent({
        title: values.title,
        description: values.description,
        location: values.location,
        calendarId: values.calendarId,
        startTime: startDateTime,
        endTime: endDateTime,
        isAllDay: values.isAllDay
      });
      return { event: newEvent, isUpdate: false };
    }
  }

  /**
   * Delete an event
   */
  async deleteEvent(eventId: string): Promise<void> {
    return await this.calendarEventsService.deleteCalendarEvent(eventId);
  }

  /**
   * Clone an event
   */
  async cloneEvent(event: CalendarEvent): Promise<CalendarEvent> {
    return await this.calendarEventsService.cloneCalendarEvent(event);
  }

  /**
   * Update an event
   */
  async updateEvent(eventId: string, updates: {
    title?: string;
    description?: string;
    location?: string;
    startTime?: Date;
    endTime?: Date;
    isAllDay?: boolean;
  }): Promise<CalendarEvent> {
    return await this.calendarEventsService.updateCalendarEvent(eventId, {
      title: updates.title,
      description: updates.description,
      location: updates.location,
      start_time: updates.startTime?.toISOString(),
      end_time: updates.endTime?.toISOString(),
      all_day: updates.isAllDay
    });
  }

  /**
   * Move an event to a different calendar
   */
  async moveEventToCalendar(eventId: string, targetCalendarId: string): Promise<CalendarEvent> {
    return await this.calendarEventsService.moveEventToCalendar(eventId, targetCalendarId);
  }

  /**
   * Create an event from a task - scheduler-specific functionality
   */
  async createEventFromTask(task: {
    id: string;
    content: string;
    duration_minutes?: number;
    due_date?: string;
  }, calendarId: string, startTime: Date): Promise<CalendarEvent> {
    const duration = task.duration_minutes || 60; // Default to 1 hour
    const endTime = new Date(startTime.getTime() + duration * 60 * 1000);

    return await this.calendarEventsService.createCalendarEvent({
      title: task.content,
      description: `Created from task: ${task.content}`,
      location: '',
      calendarId: calendarId,
      startTime: startTime,
      endTime: endTime,
      isAllDay: false
    });
  }

  /**
   * Get available time slots for scheduling tasks
   */
  async getAvailableTimeSlots(
    date: Date,
    duration: number,
    calendars: Calendar[]
  ): Promise<{ start: Date; end: Date }[]> {
    // Get all events for the specified date
    const events = await this.calendarEventsService.getCalendarEvents(calendars);
    
    // Filter events for the target date
    const dateStart = new Date(date);
    dateStart.setHours(0, 0, 0, 0);
    const dateEnd = new Date(date);
    dateEnd.setHours(23, 59, 59, 999);

    const dayEvents = events.filter(event => {
      const eventStart = new Date(event.start_time);
      const eventEnd = new Date(event.end_time);
      return eventStart < dateEnd && eventEnd > dateStart;
    });

    // Define working hours (9 AM to 6 PM)
    const workStart = new Date(date);
    workStart.setHours(9, 0, 0, 0);
    const workEnd = new Date(date);
    workEnd.setHours(18, 0, 0, 0);

    // Find available slots
    const availableSlots: { start: Date; end: Date }[] = [];
    const sortedEvents = dayEvents
      .filter(event => !event.all_day) // Exclude all-day events
      .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());

    let currentTime = new Date(workStart);

    for (const event of sortedEvents) {
      const eventStart = new Date(event.start_time);
      const eventEnd = new Date(event.end_time);

      // Check if there's a gap before this event
      if (currentTime < eventStart) {
        const gapDuration = eventStart.getTime() - currentTime.getTime();
        if (gapDuration >= duration * 60 * 1000) {
          // There's enough time for our task
          availableSlots.push({
            start: new Date(currentTime),
            end: new Date(Math.min(eventStart.getTime(), currentTime.getTime() + duration * 60 * 1000))
          });
        }
      }

      // Move current time to after this event
      currentTime = new Date(Math.max(currentTime.getTime(), eventEnd.getTime()));
    }

    // Check if there's time at the end of the day
    if (currentTime < workEnd) {
      const remainingTime = workEnd.getTime() - currentTime.getTime();
      if (remainingTime >= duration * 60 * 1000) {
        availableSlots.push({
          start: new Date(currentTime),
          end: new Date(Math.min(workEnd.getTime(), currentTime.getTime() + duration * 60 * 1000))
        });
      }
    }

    return availableSlots;
  }

  /**
   * Check if an event is from an ICS calendar (read-only)
   */
  isICSEvent(event: CalendarEvent, calendars: Calendar[]): boolean {
    const calendar = calendars.find(cal => cal.id === event.calendar_id);
    return calendar?.type === 'ics';
  }

  /**
   * Check if a calendar is read-only (ICS calendar)
   */
  isReadOnlyCalendar(calendarId: string, calendars: Calendar[]): boolean {
    const calendar = calendars.find(cal => cal.id === calendarId);
    return calendar?.type === 'ics';
  }
}

// No singleton export - services should be instantiated with backend dependency
