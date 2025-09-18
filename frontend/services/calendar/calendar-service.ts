'use client';

import { DecryptedBackendInterface } from '@/utils/api/decrypted-backend-interface';
import { Calendar, CalendarType } from '@/utils/calendar/calendar-types';
import { CalendarDecrypted, CreateCalendarDecryptedRequest, UpdateCalendarDecryptedRequest } from '@/utils/api/types';

/**
 * Calendar Service - handles all calendar-related operations using the decrypted backend
 */
export class CalendarService {
  constructor(private backend: DecryptedBackendInterface) {}

  /**
   * Get all calendars for the current user
   */
  async getCalendars(): Promise<Calendar[]> {
    try {
      const { data: calendarsData } = await this.backend.calendars.getAll();
      
      return calendarsData.map(cal => this.mapCalendarDecryptedToCalendar(cal));
    } catch (error) {
      console.error('Failed to fetch calendars:', error);
      throw new Error('Failed to load calendars');
    }
  }

  /**
   * Get a specific calendar by ID
   */
  async getCalendarById(id: string): Promise<Calendar | null> {
    try {
      const { data: calendarData } = await this.backend.calendars.getById(id);
      
      if (!calendarData) {
        return null;
      }
      
      return this.mapCalendarDecryptedToCalendar(calendarData);
    } catch (error) {
      console.error(`Failed to fetch calendar ${id}:`, error);
      throw new Error(`Failed to load calendar ${id}`);
    }
  }

  /**
   * Create a new calendar
   */
  async createCalendar(name: string, color: string, type: CalendarType = CalendarType.Regular, icsUrl?: string): Promise<Calendar> {
    try {
      const calendarData: CreateCalendarDecryptedRequest = {
        name: name.trim(),
        color,
        is_visible: true,
        is_default: false,
        type,
        ics_url: icsUrl,
        last_sync: type === 'ics' ? new Date().toISOString() : undefined,
      };

      const { data: newCalendar } = await this.backend.calendars.create(calendarData);
      
      if (!newCalendar) {
        throw new Error('Calendar creation failed - no data returned');
      }

      return this.mapCalendarDecryptedToCalendar(newCalendar);
    } catch (error) {
      console.error('Failed to create calendar:', error);
      throw new Error('Failed to create calendar');
    }
  }

  /**
   * Update an existing calendar
   */
  async updateCalendar(id: string, updates: Partial<{ name: string; color: string; isVisible: boolean; isDefault: boolean; icsUrl?: string }>): Promise<Calendar> {
    try {
      // First, fetch the current calendar to get all existing data
      const currentCalendar = await this.getCalendarById(id);
      if (!currentCalendar) {
        throw new Error(`Calendar ${id} not found`);
      }

      // Merge updates with existing data
      const updateData: UpdateCalendarDecryptedRequest = {
        id,
        name: updates.name?.trim() ?? currentCalendar.name,
        color: updates.color ?? currentCalendar.color,
        is_visible: updates.isVisible ?? currentCalendar.is_visible,
        is_default: updates.isDefault ?? currentCalendar.is_default,
        type: currentCalendar.type,
        ics_url: updates.icsUrl ?? currentCalendar.ics_url,
        last_sync: updates.icsUrl !== undefined ? new Date().toISOString() : currentCalendar.last_sync,
      };

      const { data: updatedCalendar } = await this.backend.calendars.update(updateData);
      
      if (!updatedCalendar) {
        throw new Error('Calendar update failed - no data returned');
      }

      return this.mapCalendarDecryptedToCalendar(updatedCalendar);
    } catch (error) {
      console.error(`Failed to update calendar ${id}:`, error);
      throw new Error('Failed to update calendar');
    }
  }

  /**
   * Delete a calendar
   */
  async deleteCalendar(id: string): Promise<void> {
    try {
      await this.backend.calendars.delete(id);
    } catch (error) {
      console.error(`Failed to delete calendar ${id}:`, error);
      throw new Error('Failed to delete calendar');
    }
  }

  /**
   * Toggle calendar visibility
   */
  async toggleCalendarVisibility(id: string, isVisible: boolean): Promise<Calendar> {
    return this.updateCalendar(id, { isVisible });
  }

  /**
   * Set a calendar as default
   */
  async setDefaultCalendar(id: string): Promise<Calendar> {
    return this.updateCalendar(id, { isDefault: true });
  }

  /**
   * Create an ICS calendar
   */
  async createICSCalendar(name: string, color: string, icsUrl: string): Promise<Calendar> {
    return this.createCalendar(name, color, CalendarType.ICS, icsUrl);
  }

  /**
   * Refresh an ICS calendar
   */
  async refreshICSCalendar(id: string): Promise<Calendar> {
    return this.updateCalendar(id, { icsUrl: undefined }); // This will trigger a last_sync update
  }

  /**
   * Create a default calendar if none exist
   */
  async createDefaultCalendar(): Promise<Calendar> {
    try {
      const calendars = await this.getCalendars();
      
      if (calendars.length === 0) {
        return this.createCalendar('My Calendar', '#4f46e5');
      }
      
      // If no default calendar exists, make the first one default
      const defaultCalendar = calendars.find(cal => cal.is_default);
      if (!defaultCalendar) {
        return this.setDefaultCalendar(calendars[0].id);
      }
      
      return defaultCalendar;
    } catch (error) {
      console.error('Failed to create default calendar:', error);
      throw new Error('Failed to create default calendar');
    }
  }

  /**
   * Get the default calendar
   */
  async getDefaultCalendar(): Promise<Calendar | null> {
    try {
      const calendars = await this.getCalendars();
      return calendars.find(cal => cal.is_default) || null;
    } catch (error) {
      console.error('Failed to get default calendar:', error);
      throw new Error('Failed to get default calendar');
    }
  }

  /**
   * Map CalendarDecrypted to Calendar type with normalization
   */
  private mapCalendarDecryptedToCalendar(calendarDecrypted: CalendarDecrypted): Calendar {
    // Normalize the calendar data (handle legacy camelCase properties and provide defaults)
    const normalized: Calendar = {
      id: calendarDecrypted.id,
      created_at: calendarDecrypted.created_at,
      updated_at: calendarDecrypted.updated_at,
      user_id: calendarDecrypted.user_id,
      is_default: calendarDecrypted.is_default,
      // Handle both new snake_case and legacy camelCase properties, with fallback defaults
      name: calendarDecrypted.name || (calendarDecrypted as any).name || `Calendar ${calendarDecrypted.id.slice(0, 8)}`,
      color: calendarDecrypted.color || (calendarDecrypted as any).color || '#3b82f6',
      is_visible: calendarDecrypted.is_visible ?? (calendarDecrypted as any).isVisible ?? true,
      type: (calendarDecrypted.type || (calendarDecrypted as any).type || 'regular') as 'regular' | 'ics',
      ics_url: calendarDecrypted.ics_url || (calendarDecrypted as any).icsUrl,
      last_sync: calendarDecrypted.last_sync || (calendarDecrypted as any).lastSync,
    };

    // Auto-fix corrupted data in the background if legacy properties or missing essential fields detected
    const hasLegacyProps = (calendarDecrypted as any).isVisible !== undefined || 
                           (calendarDecrypted as any).icsUrl !== undefined || 
                           (calendarDecrypted as any).lastSync !== undefined;
    
    const hasMissingEssentialFields = !calendarDecrypted.name || !calendarDecrypted.color;
    
    if (hasLegacyProps || hasMissingEssentialFields) {
      this.autoFixCalendar(calendarDecrypted.id, normalized).catch(error => 
        console.warn('Background calendar fix failed:', error)
      );
    }

    return normalized;
  }

  /**
   * Auto-fix corrupted calendar data in the background
   */
  private async autoFixCalendar(id: string, normalizedData: Calendar): Promise<void> {
    try {
      // Use direct backend update to avoid recursion in getCalendarById
      const updateData: UpdateCalendarDecryptedRequest = {
        id,
        name: normalizedData.name,
        color: normalizedData.color,
        is_visible: normalizedData.is_visible,
        is_default: normalizedData.is_default,
        type: normalizedData.type,
        ics_url: normalizedData.ics_url,
        last_sync: normalizedData.last_sync,
      };

      await this.backend.calendars.update(updateData);
    } catch (error) {
      console.warn(`Failed to auto-fix calendar ${id}:`, error);
    }
  }
}

// No singleton export - services should be instantiated with backend dependency
