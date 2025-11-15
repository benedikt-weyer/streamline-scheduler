'use client';

import { Calendar, CalendarEvent } from '@/utils/calendar/calendar-types';
import { CalendarService } from '@/services/calendar/calendar-service';
import { CalendarEventsService } from '@/services/calendar-events/calendar-events-service';
import { fetchAndParseICSCalendar } from '@/utils/calendar/ics-parser';
import { DecryptedBackendInterface } from '@/utils/api/decrypted-backend-interface';
import { EventFormValues } from '@/components/calendar/calendar-event-dialog';
import { generateRecurrenceInstancesInRange } from '@/utils/calendar/calendar';
import { getRecurrencePattern } from '@/utils/calendar/eventDataProcessing';

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
      const events = await fetchAndParseICSCalendar(calendar.ics_url, calendar.id);
      // Transform and add calendar_id to each event
      return events.map(event => ({
        ...event,
        calendar_id: calendar.id,
        user_id: calendar.user_id
      }));
    } catch (error) {
      console.error(`Failed to fetch ICS events for calendar ${calendar.name || calendar.id}:`, error);
      
      // Check if it's a CORS error and provide helpful message
      if (error instanceof Error && error.message.includes('CORS_ERROR')) {
        console.warn(`CORS Error for calendar "${calendar.name || calendar.id}": The calendar does not allow cross-origin requests. Please contact your calendar provider to enable CORS.`);
      }
      
      // Return empty array instead of throwing to prevent breaking the entire scheduler
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
        lastSync: new Date().toISOString()
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
          await moveEventCallback(event.id, targetCalendarId);
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
      throw new Error(`Failed to delete calendar with events`);
    }
  }

  /**
   * Set a calendar as default
   */
  async setDefaultCalendar(calendarId: string): Promise<void> {
    await this.calendarService.setDefaultCalendar(calendarId);
  }

  /**
   * Submit an event (create or update)
   */
  async submitEvent(values: EventFormValues): Promise<{ event: CalendarEvent; isUpdate: boolean }> {
    const isUpdate = !!values.id && values.id !== 'new';
    
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
        isAllDay: values.isAllDay,
        taskId: values.taskId
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
        isAllDay: values.isAllDay,
        taskId: values.taskId
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
    calendarId?: string;
    startTime?: Date;
    endTime?: Date;
    isAllDay?: boolean;
    isGroupEvent?: boolean;
    parentGroupEventId?: string;
  }): Promise<CalendarEvent> {
    return await this.calendarEventsService.updateCalendarEvent(eventId, {
      title: updates.title,
      description: updates.description,
      location: updates.location,
      calendarId: updates.calendarId,
      startTime: updates.startTime,
      endTime: updates.endTime,
      isAllDay: updates.isAllDay,
      isGroupEvent: updates.isGroupEvent,
      parentGroupEventId: updates.parentGroupEventId,
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
   * Snap a time to the next 15-minute interval
   */
  private snapToNext15Minutes(date: Date): Date {
    const snapped = new Date(date);
    const minutes = snapped.getMinutes();
    const remainder = minutes % 15;
    
    if (remainder !== 0) {
      // Round up to next 15-minute mark
      snapped.setMinutes(minutes + (15 - remainder));
      snapped.setSeconds(0);
      snapped.setMilliseconds(0);
    } else {
      // Already on a 15-minute mark, just clear seconds/milliseconds
      snapped.setSeconds(0);
      snapped.setMilliseconds(0);
    }
    
    return snapped;
  }

  /**
   * Get available time slots for scheduling tasks
   * Finds gaps between existing events throughout the entire day
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

    // Expand recurring events to include their instances for this day
    const expandedEvents: CalendarEvent[] = [];
    
    for (const event of events) {
      // Check if this is a recurring event
      const recurrencePattern = getRecurrencePattern(event);
      
      if (recurrencePattern && recurrencePattern.frequency !== 'none') {
        // Generate recurring instances for this specific day
        const instances = generateRecurrenceInstancesInRange(
          event,
          dateStart,
          dateEnd,
          recurrencePattern
        );
        
        // Add the original event if it falls on this day
        const eventStart = new Date(event.start_time);
        const eventEnd = new Date(event.end_time);
        if (eventStart < dateEnd && eventEnd > dateStart) {
          expandedEvents.push(event);
        }
        
        // Add all generated instances
        expandedEvents.push(...instances);
      } else {
        // Non-recurring event, just add if it's on this day
        const eventStart = new Date(event.start_time);
        const eventEnd = new Date(event.end_time);
        if (eventStart < dateEnd && eventEnd > dateStart) {
          expandedEvents.push(event);
        }
      }
    }

    // Sort events by start time, excluding all-day events
    const sortedEvents = expandedEvents
      .filter(event => !event.all_day)
      .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());

    const availableSlots: { start: Date; end: Date }[] = [];

    // Determine the earliest possible start time for the day
    // Use the current time if it's today, otherwise start of day
    const now = new Date();
    const isToday = dateStart.toDateString() === now.toDateString();
    const earliestStart = isToday && now > dateStart ? now : dateStart;
    
    // Snap to next 15-minute interval
    const snappedEarliestStart = this.snapToNext15Minutes(earliestStart);

    // If no events exist, the entire day is available (from earliest start time)
    if (sortedEvents.length === 0) {
      availableSlots.push({
        start: new Date(snappedEarliestStart),
        end: new Date(snappedEarliestStart.getTime() + duration * 60 * 1000)
      });
      return availableSlots;
    }

    // Check for gap at the beginning of the day (before first event)
    const firstEventStart = new Date(sortedEvents[0].start_time);
    if (firstEventStart > snappedEarliestStart) {
      const gapDuration = firstEventStart.getTime() - snappedEarliestStart.getTime();
      if (gapDuration >= duration * 60 * 1000) {
        availableSlots.push({
          start: new Date(snappedEarliestStart),
          end: new Date(snappedEarliestStart.getTime() + duration * 60 * 1000)
        });
      }
    }

    // Check for gaps between events
    for (let i = 0; i < sortedEvents.length - 1; i++) {
      const currentEventEnd = new Date(sortedEvents[i].end_time);
      const nextEventStart = new Date(sortedEvents[i + 1].start_time);

      if (currentEventEnd < nextEventStart) {
        // Snap the gap start time to next 15-minute interval
        const snappedGapStart = this.snapToNext15Minutes(currentEventEnd);
        const gapDuration = nextEventStart.getTime() - snappedGapStart.getTime();
        if (gapDuration >= duration * 60 * 1000) {
          availableSlots.push({
            start: new Date(snappedGapStart),
            end: new Date(snappedGapStart.getTime() + duration * 60 * 1000)
          });
        }
      }
    }

    // Check for gap at the end of the day (after last event)
    const lastEventEnd = new Date(sortedEvents[sortedEvents.length - 1].end_time);
    if (lastEventEnd < dateEnd) {
      // Snap the gap start time to next 15-minute interval
      const snappedGapStart = this.snapToNext15Minutes(lastEventEnd);
      const gapDuration = dateEnd.getTime() - snappedGapStart.getTime();
      if (gapDuration >= duration * 60 * 1000) {
        availableSlots.push({
          start: new Date(snappedGapStart),
          end: new Date(snappedGapStart.getTime() + duration * 60 * 1000)
        });
      }
    }

    return availableSlots;
  }

  /**
   * Find the next available free slot starting from now
   */
  async findNextFreeSlot(
    durationMinutes: number,
    calendars: Calendar[]
  ): Promise<{ start: Date; end: Date } | null> {
    const now = new Date();
    const maxDaysToSearch = 7; // Search up to 7 days ahead
    
    for (let dayOffset = 0; dayOffset < maxDaysToSearch; dayOffset++) {
      const searchDate = new Date(now);
      searchDate.setDate(searchDate.getDate() + dayOffset);
      
      const availableSlots = await this.getAvailableTimeSlots(
        searchDate,
        durationMinutes,
        calendars
      );
      
      // Filter out slots that have already passed
      const validSlots = availableSlots.filter(slot => {
        // Always filter out slots in the past, regardless of day offset
        return slot.start > now;
      });
      
      if (validSlots.length > 0) {
        // Return the first available slot
        return validSlots[0];
      }
    }
    
    return null; // No free slot found in the next week
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
