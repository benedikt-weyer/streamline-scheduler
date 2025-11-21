'use client';

import { getBackend } from '@/utils/api/backend-interface';
import { getDecryptedBackend } from '@/utils/api/decrypted-backend';
import { encryptData, generateSalt, generateIV, deriveKeyFromPassword } from '@/utils/cryptography/encryption';
import { 
  CanDoItemDecrypted, 
  CanDoItemEncrypted, 
  ProjectDecrypted, 
  ProjectEncrypted, 
  CalendarDecrypted, 
  CalendarEncrypted,
  CalendarEventDecrypted,
  CalendarEventEncrypted
} from '@/utils/api/types';

export interface ExportedData {
  version: string;
  timestamp: string;
  userId: string;
  data: {
    can_do_list: CanDoItemDecrypted[];
    projects: ProjectDecrypted[];
    calendars: CalendarDecrypted[];
    calendar_events: CalendarEventDecrypted[];
  };
}

// Domain-specific extensions for export/import
export interface DecryptedTask extends Omit<CanDoItemDecrypted, 'created_at' | 'updated_at' | 'project_id' | 'display_order'> {
  estimatedDuration?: number;
  impact?: number;
  urgency?: number;
  dueDate?: string;
  blockedBy?: string[];
  projectId?: string;
  displayOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface DecryptedProject extends Omit<ProjectDecrypted, 'created_at' | 'updated_at' | 'parent_id' | 'collapsed'> {
  parentId?: string;
  isCollapsed: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface DecryptedCalendar extends Omit<CalendarDecrypted, 'created_at' | 'updated_at' | 'is_visible' | 'is_default' | 'ics_url' | 'last_sync'> {
  isVisible?: boolean;
  isDefault?: boolean;
  icsUrl?: string;
  lastSync?: string;
  createdAt: string;
  updatedAt: string;
}

export interface DecryptedCalendarEvent extends Omit<CalendarEventDecrypted, 'created_at' | 'updated_at' | 'start_time' | 'end_time' | 'all_day' | 'calendar_id'> {
  startTime: string;
  endTime: string;
  isAllDay?: boolean;
  calendarId?: string;
  recurrencePattern?: {
    frequency: string;
    endDate?: string;
    interval?: number;
    daysOfWeek?: number[];
  };
  createdAt: string;
  updatedAt: string;
}

export interface DecryptedExportData {
  version: string;
  timestamp: string;
  userId: string;
  data: {
    tasks: DecryptedTask[];
    projects: DecryptedProject[];
    calendars: DecryptedCalendar[];
    calendarEvents: DecryptedCalendarEvent[];
    profile?: any;
  };
}

// Export all user data
export async function exportUserData(): Promise<ExportedData> {
  try {
    const rawBackend = getBackend();
    const decryptedBackend = getDecryptedBackend();
    
    // Use the backend's data management export method if available
    if (rawBackend.dataManagement?.exportUserData) {
      return await rawBackend.dataManagement.exportUserData();
    }
    
    // Fallback to direct implementation
    const { data: { user } } = await rawBackend.auth.getUser();
    if (!user) {
      throw new Error('User not authenticated');
    }

    // Fetch all user data using decrypted backend
    const [canDoListResult, projectsResult, calendarsResult, calendarEventsResult] = await Promise.all([
      decryptedBackend.canDoList.getAll(),
      decryptedBackend.projects.getAll({ all: true }), // Get all projects including children
      decryptedBackend.calendars.getAll(),
      decryptedBackend.calendarEvents.getAll(),
    ]);

    return {
      version: '1.0',
      timestamp: new Date().toISOString(),
      userId: user.id,
      data: {
        can_do_list: canDoListResult.data || [],
        projects: projectsResult.data || [],
        calendars: calendarsResult.data || [],
        calendar_events: calendarEventsResult.data || [],
      },
    };
  } catch (error) {
    console.error('Failed to export user data:', error);
    throw error;
  }
}

// Import user data
export async function importUserData(data: ExportedData): Promise<void> {
  try {
    const rawBackend = getBackend();

    // Use the backend's data management import method which handles encryption properly
    if (rawBackend.dataManagement?.importUserData) {
      return await rawBackend.dataManagement.importUserData(data);
    }

    // If no backend import method, the data should be handled by a more sophisticated import
    throw new Error('Backend import method not available. Import functionality requires backend support.');
  } catch (error) {
    console.error('Failed to import user data:', error);
    throw error;
  }
}

// Clear all user data
export async function clearAllUserData(): Promise<void> {
  try {
    const rawBackend = getBackend();

    // Use the backend's data management clear method if available
    if (rawBackend.dataManagement?.clearAllUserData) {
      return await rawBackend.dataManagement.clearAllUserData();
    }

    // Fallback to direct implementation
    // Get all data first
    const [canDoListResult, projectsResult, calendarsResult, calendarEventsResult] = await Promise.all([
      rawBackend.canDoList.getAll(),
      rawBackend.projects.getAll({ all: true }), // Get all projects including children
      rawBackend.calendars.getAll(),
      rawBackend.calendarEvents.getAll(),
    ]);

    // Delete in reverse order (children first, then parents)
    
    // Delete calendar events
    if (calendarEventsResult.data) {
      for (const event of calendarEventsResult.data) {
        await rawBackend.calendarEvents.delete(event.id);
      }
    }

    // Delete calendars
    if (calendarsResult.data) {
      for (const calendar of calendarsResult.data) {
        await rawBackend.calendars.delete(calendar.id);
      }
    }

    // Delete can-do list items
    if (canDoListResult.data) {
      for (const task of canDoListResult.data) {
        await rawBackend.canDoList.delete(task.id);
      }
    }

    // Delete projects
    if (projectsResult.data) {
      for (const project of projectsResult.data) {
        await rawBackend.projects.delete(project.id);
      }
    }
  } catch (error) {
    console.error('Failed to clear user data:', error);
    throw error;
  }
}

// Import decrypted user data (delegate to backend)
export async function importDecryptedUserData(data: DecryptedExportData, encryptionKey: string): Promise<void> {
  try {
    const backend = getDecryptedBackend();
    
    // Convert DecryptedExportData to ExportedData format and delegate to main import
    const exportData: ExportedData = {
      version: data.version,
      timestamp: data.timestamp,
      userId: data.userId,
      data: {
        can_do_list: data.data.tasks as any, // Type conversion handled by backend
        projects: data.data.projects as any,
        calendars: data.data.calendars as any,
        calendar_events: data.data.calendarEvents as any,
      }
    };
    
    return importUserData(exportData);
  } catch (error) {
    console.error('Failed to import decrypted user data:', error);
    throw error;
  }
}

// Change user password
export async function changePassword(newPassword: string): Promise<void> {
  try {
    const backend = getBackend();
    await backend.auth.updatePassword({ password: newPassword });
  } catch (error) {
    console.error('Failed to change password:', error);
    throw error;
  }
}