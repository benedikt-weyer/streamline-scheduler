import { writable, derived, get } from 'svelte/store';
import type { Calendar, CalendarEvent, EncryptedCalendar, EncryptedCalendarEvent } from '$lib/types/calendar';
import { 
  fetchCalendars, 
  createCalendar, 
  updateCalendar, 
  deleteCalendar,
  fetchCalendarEvents,
  createCalendarEvent,
  updateCalendarEvent,
  deleteCalendarEvent
} from '$lib/api/calendar';
import { 
  generateSalt, 
  generateIV, 
  deriveKeyFromPassword, 
  encryptData,
  decryptData
} from '$lib/crypto/encryption';

// Calendar stores
export const calendars = writable<Calendar[]>([]);
export const calendarEvents = writable<CalendarEvent[]>([]);
export const isLoadingCalendars = writable<boolean>(false);
export const isLoadingEvents = writable<boolean>(false);
export const calendarError = writable<string | null>(null);

// Helper functions for encryption/decryption
function encryptCalendarData(calendar: Partial<Calendar>, encryptionKey: string): { encryptedData: string; iv: string; salt: string } {
  const salt = generateSalt();
  const iv = generateIV();
  const derivedKey = deriveKeyFromPassword(encryptionKey, salt);
  const encryptedData = encryptData(JSON.stringify(calendar), derivedKey, iv);
  
  return { encryptedData, iv, salt };
}

function decryptCalendarData(encrypted: EncryptedCalendar, encryptionKey: string): Calendar | null {
  try {
    const derivedKey = deriveKeyFromPassword(encryptionKey, encrypted.salt);
    const decryptedData = decryptData(encrypted.encrypted_data, derivedKey, encrypted.iv);
    
    if (!decryptedData) return null;
    
    return {
      id: encrypted.id,
      name: decryptedData.name,
      color: decryptedData.color,
      isVisible: decryptedData.isVisible ?? true,
      isDefault: encrypted.is_default,
      type: decryptedData.type || 'regular',
      icsUrl: decryptedData.icsUrl,
      lastSync: decryptedData.lastSync ? new Date(decryptedData.lastSync) : undefined,
      createdAt: new Date(encrypted.created_at),
      updatedAt: encrypted.updated_at ? new Date(encrypted.updated_at) : undefined
    };
  } catch (error) {
    console.error('Error decrypting calendar:', error);
    return null;
  }
}

function encryptEventData(event: Partial<CalendarEvent>, encryptionKey: string): { encryptedData: string; iv: string; salt: string } {
  const salt = generateSalt();
  const iv = generateIV();
  const derivedKey = deriveKeyFromPassword(encryptionKey, salt);
  const encryptedData = encryptData(JSON.stringify(event), derivedKey, iv);
  
  return { encryptedData, iv, salt };
}

function decryptEventData(encrypted: EncryptedCalendarEvent, encryptionKey: string): CalendarEvent | null {
  try {
    const derivedKey = deriveKeyFromPassword(encryptionKey, encrypted.salt);
    const decryptedData = decryptData(encrypted.encrypted_data, derivedKey, encrypted.iv);
    
    if (!decryptedData) return null;
    
    return {
      id: encrypted.id,
      title: decryptedData.title,
      description: decryptedData.description,
      location: decryptedData.location,
      startTime: new Date(decryptedData.startTime),
      endTime: new Date(decryptedData.endTime),
      isAllDay: decryptedData.isAllDay,
      calendarId: decryptedData.calendarId,
      createdAt: new Date(encrypted.created_at),
      updatedAt: encrypted.updated_at ? new Date(encrypted.updated_at) : undefined,
      recurrencePattern: decryptedData.recurrencePattern
    };
  } catch (error) {
    console.error('Error decrypting event:', error);
    return null;
  }
}

// Calendar actions
export const calendarActions = {
  async loadCalendars(encryptionKey: string) {
    isLoadingCalendars.set(true);
    calendarError.set(null);
    
    try {
      const encryptedCalendars = await fetchCalendars();
      const decryptedCalendars: Calendar[] = [];
      
      for (const encrypted of encryptedCalendars) {
        const decrypted = decryptCalendarData(encrypted, encryptionKey);
        if (decrypted) {
          decryptedCalendars.push(decrypted);
        }
      }
      
      // If no calendars exist, create a default one
      if (decryptedCalendars.length === 0) {
        const defaultCalendar = await calendarActions.createCalendar(
          'My Calendar',
          '#3b82f6',
          encryptionKey,
          true
        );
        if (defaultCalendar) {
          decryptedCalendars.push(defaultCalendar);
        }
      }
      
      calendars.set(decryptedCalendars);
    } catch (error) {
      console.error('Error loading calendars:', error);
      calendarError.set(error instanceof Error ? error.message : 'Failed to load calendars');
    } finally {
      isLoadingCalendars.set(false);
    }
  },

  async createCalendar(name: string, color: string, encryptionKey: string, isDefault = false): Promise<Calendar | null> {
    try {
      const calendarData = { name, color, isVisible: true, type: 'regular' as const };
      const { encryptedData, iv, salt } = encryptCalendarData(calendarData, encryptionKey);
      
      const encrypted = await createCalendar(encryptedData, iv, salt);
      const decrypted = decryptCalendarData(encrypted, encryptionKey);
      
      if (decrypted) {
        calendars.update(cals => [...cals, decrypted]);
        return decrypted;
      }
      
      return null;
    } catch (error) {
      console.error('Error creating calendar:', error);
      calendarError.set(error instanceof Error ? error.message : 'Failed to create calendar');
      return null;
    }
  },

  async updateCalendar(id: string, name: string, color: string, encryptionKey: string, isDefault = false): Promise<boolean> {
    try {
      const calendarData = { name, color, isVisible: true, type: 'regular' as const };
      const { encryptedData, iv, salt } = encryptCalendarData(calendarData, encryptionKey);
      
      const encrypted = await updateCalendar(id, encryptedData, iv, salt, isDefault);
      const decrypted = decryptCalendarData(encrypted, encryptionKey);
      
      if (decrypted) {
        calendars.update(cals => cals.map(cal => cal.id === id ? decrypted : cal));
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('Error updating calendar:', error);
      calendarError.set(error instanceof Error ? error.message : 'Failed to update calendar');
      return false;
    }
  },

  async deleteCalendar(id: string): Promise<boolean> {
    try {
      await deleteCalendar(id);
      calendars.update(cals => cals.filter(cal => cal.id !== id));
      return true;
    } catch (error) {
      console.error('Error deleting calendar:', error);
      calendarError.set(error instanceof Error ? error.message : 'Failed to delete calendar');
      return false;
    }
  },

  toggleCalendarVisibility(id: string, isVisible: boolean) {
    calendars.update(cals => 
      cals.map(cal => cal.id === id ? { ...cal, isVisible } : cal)
    );
  }
};

// Event actions
export const eventActions = {
  async loadEvents(encryptionKey: string) {
    isLoadingEvents.set(true);
    calendarError.set(null);
    
    try {
      const encryptedEvents = await fetchCalendarEvents();
      const decryptedEvents: CalendarEvent[] = [];
      
      for (const encrypted of encryptedEvents) {
        const decrypted = decryptEventData(encrypted, encryptionKey);
        if (decrypted) {
          decryptedEvents.push(decrypted);
        }
      }
      
      calendarEvents.set(decryptedEvents);
    } catch (error) {
      console.error('Error loading events:', error);
      calendarError.set(error instanceof Error ? error.message : 'Failed to load events');
    } finally {
      isLoadingEvents.set(false);
    }
  },

  async createEvent(event: Omit<CalendarEvent, 'id' | 'createdAt' | 'updatedAt'>, encryptionKey: string): Promise<CalendarEvent | null> {
    try {
      const { encryptedData, iv, salt } = encryptEventData(event, encryptionKey);
      
      const encrypted = await createCalendarEvent(encryptedData, iv, salt);
      const decrypted = decryptEventData(encrypted, encryptionKey);
      
      if (decrypted) {
        calendarEvents.update(events => [...events, decrypted]);
        return decrypted;
      }
      
      return null;
    } catch (error) {
      console.error('Error creating event:', error);
      calendarError.set(error instanceof Error ? error.message : 'Failed to create event');
      return null;
    }
  },

  async updateEvent(id: string, event: Partial<CalendarEvent>, encryptionKey: string): Promise<boolean> {
    try {
      const { encryptedData, iv, salt } = encryptEventData(event, encryptionKey);
      
      const encrypted = await updateCalendarEvent(id, encryptedData, iv, salt);
      const decrypted = decryptEventData(encrypted, encryptionKey);
      
      if (decrypted) {
        calendarEvents.update(events => events.map(e => e.id === id ? decrypted : e));
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('Error updating event:', error);
      calendarError.set(error instanceof Error ? error.message : 'Failed to update event');
      return false;
    }
  },

  async deleteEvent(id: string): Promise<boolean> {
    try {
      await deleteCalendarEvent(id);
      calendarEvents.update(events => events.filter(e => e.id !== id));
      return true;
    } catch (error) {
      console.error('Error deleting event:', error);
      calendarError.set(error instanceof Error ? error.message : 'Failed to delete event');
      return false;
    }
  }
};

// Derived stores
export const visibleCalendars = derived(
  calendars,
  $calendars => $calendars.filter(cal => cal.isVisible)
);

export const defaultCalendar = derived(
  calendars,
  $calendars => $calendars.find(cal => cal.isDefault)
);

export const visibleEvents = derived(
  [calendarEvents, visibleCalendars],
  ([$events, $visibleCalendars]) => {
    const visibleCalendarIds = new Set($visibleCalendars.map(cal => cal.id));
    return $events.filter(event => visibleCalendarIds.has(event.calendarId));
  }
);
