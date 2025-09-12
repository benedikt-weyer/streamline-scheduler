'use client';

import { getBackend } from '@/utils/api/backend-interface';
import { encryptData, generateSalt, generateIV, deriveKeyFromPassword } from '@/utils/cryptography/encryption';

export interface ExportedData {
  version: string;
  timestamp: string;
  userId: string;
  data: {
    can_do_list: any[];
    projects: any[];
    calendars: any[];
    calendar_events: any[];
  };
}

export interface DecryptedTask {
  id?: string;
  content: string;
  completed: boolean;
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

export interface DecryptedProject {
  id?: string;
  name: string;
  description?: string;
  color?: string;
  parentId?: string;
  isCollapsed: boolean;
  displayOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface DecryptedCalendar {
  id?: string;
  name: string;
  color: string;
  isVisible?: boolean;
  isDefault?: boolean;
  type?: 'regular' | 'ics';
  icsUrl?: string;
  lastSync?: string;
  createdAt: string;
  updatedAt: string;
}

export interface DecryptedCalendarEvent {
  id?: string;
  title: string;
  description?: string;
  location?: string;
  startTime: string;
  endTime: string;
  isAllDay?: boolean;
  calendarId?: string;
  recurrenceRule?: string;
  recurrencePattern?: {
    frequency: string;
    endDate?: string;
    interval?: number;
  };
  recurrenceException?: string[];
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
    const backend = getBackend();
    
    // Use the backend's data management export method if available
    if (backend.dataManagement?.exportUserData) {
      return await backend.dataManagement.exportUserData();
    }
    
    // Fallback to direct implementation
    const { data: { user } } = await backend.auth.getUser();
    if (!user) {
      throw new Error('User not authenticated');
    }

    // Fetch all user data
    const [canDoListResult, projectsResult, calendarsResult, calendarEventsResult] = await Promise.all([
      backend.canDoList.getAll(),
      backend.projects.getAll({ all: true }), // Get all projects including children
      backend.calendars.getAll(),
      backend.calendarEvents.getAll(),
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
    const backend = getBackend();

    // Use the backend's data management import method if available
    if (backend.dataManagement?.importUserData) {
      return await backend.dataManagement.importUserData(data);
    }

    // Fallback to direct implementation
    // Import in the correct order (projects first, then tasks that reference them)
    
    // Import projects
    if (data.data?.projects) {
      for (const project of data.data.projects) {
        await backend.projects.create({
          name: project.name || 'Imported Project',
          description: project.description,
          color: project.color,
          encrypted_data: project.encrypted_data,
          iv: project.iv,
          salt: project.salt,
          parent_id: project.parent_id,
          order: project.display_order || project.order || 0,
          collapsed: project.is_collapsed || project.collapsed || false,
        });
      }
    }

    // Import can-do list items
    if (data.data?.can_do_list) {
      for (const task of data.data.can_do_list) {
        // Handle urgency conversion (could be number 0-10 or already a priority string)
        let priority = task.priority;
        if (!priority && typeof task.urgency === 'number') {
          priority = task.urgency >= 8 ? 'high' : task.urgency >= 5 ? 'medium' : 'low';
        }
        
        await backend.canDoList.create({
          content: task.content || 'Imported Task',
          due_date: task.due_date || task.dueDate,
          priority: priority,
          tags: task.tags,
          duration_minutes: task.duration_minutes || task.estimatedDuration,
          encrypted_data: task.encrypted_data,
          iv: task.iv,
          salt: task.salt,
          project_id: task.project_id || task.projectId,
          order: task.display_order || task.order || 0,
        });
      }
    }

    // Import calendars
    if (data.data?.calendars) {
      for (const calendar of data.data.calendars) {
        await backend.calendars.create({
          encrypted_data: calendar.encrypted_data || JSON.stringify(calendar), // Use encrypted data if available
          iv: calendar.iv || 'placeholder_iv',
          salt: calendar.salt || 'placeholder_salt',
          is_default: calendar.is_default || false,
          // Backward compatibility fields
          name: calendar.name || 'Imported Calendar',
          color: calendar.color || '#3b82f6',
          is_visible: calendar.is_visible !== false,
          type: calendar.type || 'regular',
          ics_url: calendar.ics_url || calendar.icsUrl,
          last_sync: calendar.last_sync || calendar.lastSync,
        });
      }
    }

    // Import calendar events
    if (data.data?.calendar_events) {
      for (const event of data.data.calendar_events) {
        await backend.calendarEvents.create({
          encrypted_data: event.encrypted_data || JSON.stringify(event), // Use encrypted data if available
          iv: event.iv || 'placeholder_iv',
          salt: event.salt || 'placeholder_salt',
          // Backward compatibility fields
          title: event.title || 'Imported Event',
          description: event.description,
          location: event.location,
          start_time: event.start_time || new Date().toISOString(),
          end_time: event.end_time || new Date(Date.now() + 60 * 60 * 1000).toISOString(),
          all_day: event.all_day || false,
          calendar_id: event.calendar_id,
          recurrence_rule: event.recurrence_rule,
          recurrence_exception: event.recurrence_exception,
        });
      }
    }
  } catch (error) {
    console.error('Failed to import user data:', error);
    throw error;
  }
}

// Clear all user data
export async function clearAllUserData(): Promise<void> {
  try {
    const backend = getBackend();

    // Use the backend's data management clear method if available
    if (backend.dataManagement?.clearAllUserData) {
      return await backend.dataManagement.clearAllUserData();
    }

    // Fallback to direct implementation
    // Get all data first
    const [canDoListResult, projectsResult, calendarsResult, calendarEventsResult] = await Promise.all([
      backend.canDoList.getAll(),
      backend.projects.getAll({ all: true }), // Get all projects including children
      backend.calendars.getAll(),
      backend.calendarEvents.getAll(),
    ]);

    // Delete in reverse order (children first, then parents)
    
    // Delete calendar events
    if (calendarEventsResult.data) {
      for (const event of calendarEventsResult.data) {
        await backend.calendarEvents.delete(event.id);
      }
    }

    // Delete calendars
    if (calendarsResult.data) {
      for (const calendar of calendarsResult.data) {
        await backend.calendars.delete(calendar.id);
      }
    }

    // Delete can-do list items
    if (canDoListResult.data) {
      for (const task of canDoListResult.data) {
        await backend.canDoList.delete(task.id);
      }
    }

    // Delete projects
    if (projectsResult.data) {
      for (const project of projectsResult.data) {
        await backend.projects.delete(project.id);
      }
    }
  } catch (error) {
    console.error('Failed to clear user data:', error);
    throw error;
  }
}

// Import decrypted user data (convert to encrypted format first)
export async function importDecryptedUserData(data: DecryptedExportData, encryptionKey: string): Promise<void> {
  try {
    const backend = getBackend();

    // Track ID mappings: old ID -> new ID
    const projectIdMapping: Map<string, string> = new Map();
    const calendarIdMapping: Map<string, string> = new Map();

    // For decrypted data, we must encrypt it before sending to the backend
    // Direct implementation with proper field mapping and encryption
    // Import projects first (sorted by hierarchy to avoid foreign key violations)
    if (data.data?.projects) {
      console.log('[Import] Found projects to import:', data.data.projects.length);
      data.data.projects.forEach((p, index) => {
        console.log(`[Import] Project ${index + 1}: "${p.name}" (parentId: ${p.parentId})`);
      });
      
      // Sort projects to ensure parents are created before children
      // Simple approach: parents (no parentId) first, then all children
      const sortedProjects = [...data.data.projects].sort((a, b) => {
        // Parents (no parentId) come first
        if (!a.parentId && b.parentId) return -1;
        if (a.parentId && !b.parentId) return 1;
        // If both have parents or both don't, maintain original order
        return 0;
      });
      
      for (const project of sortedProjects) {
        // Encrypt project data
        const salt = generateSalt();
        const iv = generateIV();
        const derivedKey = deriveKeyFromPassword(encryptionKey, salt);
        
        const projectData = {
          name: project.name || 'Imported Project',
          description: project.description,
          color: project.color,
        };
        
        const encryptedData = encryptData(projectData, derivedKey, iv);
        
        // Map the parent ID to the new ID if it exists
        const mappedParentId = project.parentId ? projectIdMapping.get(project.parentId) : undefined;
        
        const createdProject = await backend.projects.create({
          // Encrypted data (future E2EE approach)
          encrypted_data: encryptedData,
          iv: iv,
          salt: salt,
          // Backward compatibility fields (current backend expects these)
          name: project.name || 'Imported Project',
          description: project.description,
          color: project.color,
          parent_id: mappedParentId,
          order: project.displayOrder || 0,
          collapsed: project.isCollapsed || false,
        });
        
        // Store the ID mapping for children to reference
        if (project.id && createdProject.data?.id) {
          projectIdMapping.set(project.id, createdProject.data.id);
        }
      }
    }

    // Import can-do list items (tasks)
    if (data.data?.tasks) {
      for (const task of data.data.tasks) {
        // Encrypt task data to preserve impact/urgency granularity (0-10 scale)
        const salt = generateSalt();
        const iv = generateIV();
        const derivedKey = deriveKeyFromPassword(encryptionKey, salt);
        
        const taskData = {
          content: task.content.trim(),
          completed: task.completed,
          estimatedDuration: task.estimatedDuration,
          impact: task.impact,
          urgency: task.urgency,
          dueDate: task.dueDate,
          blockedBy: task.blockedBy
        };
        
        const encryptedData = encryptData(taskData, derivedKey, iv);
        
        // Convert urgency (0-10) to priority for backward compatibility
        const priority = task.urgency ? (task.urgency >= 8 ? 'high' : task.urgency >= 5 ? 'medium' : 'low') : undefined;
        
        // Map the project ID to the new ID if it exists
        const mappedProjectId = task.projectId ? projectIdMapping.get(task.projectId) : undefined;
        
        await backend.canDoList.create({
          // Encrypted data (preserves full granularity)
          encrypted_data: encryptedData,
          iv: iv,
          salt: salt,
          // Backward compatibility fields
          content: task.content || 'Imported Task',
          due_date: task.dueDate,
          priority: priority,
          tags: undefined, // Not available in DecryptedTask
          duration_minutes: task.estimatedDuration,
          project_id: mappedProjectId,
          order: task.displayOrder || 0,
        });
      }
    }

    // Import calendars
    if (data.data?.calendars) {
      for (const calendar of data.data.calendars) {
        // Encrypt calendar data including ICS parameters
        const salt = generateSalt();
        const iv = generateIV();
        const derivedKey = deriveKeyFromPassword(encryptionKey, salt);
        
        const calendarData = {
          name: calendar.name || 'Imported Calendar',
          color: calendar.color || '#3b82f6',
          is_visible: calendar.isVisible !== false,
          type: calendar.type || 'regular',
          ics_url: calendar.icsUrl,
          last_sync: calendar.lastSync,
        };
        
        const encryptedData = encryptData(calendarData, derivedKey, iv);
        
        const createdCalendar = await backend.calendars.create({
          // Encrypted data (preserves ICS parameters)
          encrypted_data: encryptedData,
          iv: iv,
          salt: salt,
          is_default: calendar.isDefault || false,
          // Backward compatibility fields
          name: calendar.name || 'Imported Calendar',
          color: calendar.color || '#3b82f6',
          is_visible: calendar.isVisible !== false,
          type: calendar.type || 'regular',
          ics_url: calendar.icsUrl,
          last_sync: calendar.lastSync,
        });
        
        // Store the ID mapping for events to reference
        if (calendar.id && createdCalendar.data?.id) {
          calendarIdMapping.set(calendar.id, createdCalendar.data.id);
        }
      }
    }

    // Import calendar events
    if (data.data?.calendarEvents) {
      for (const event of data.data.calendarEvents) {
        // Skip events without a calendar ID - they can't be imported
        if (!event.calendarId) {
          console.warn('Skipping calendar event without calendarId:', event.title);
          continue;
        }

        // Map the calendar ID to the new ID
        const mappedCalendarId = calendarIdMapping.get(event.calendarId);
        if (!mappedCalendarId) {
          console.warn('Skipping calendar event with unmapped calendarId:', event.title, event.calendarId);
          continue;
        }

        // Convert recurrencePattern to recurrenceRule if needed
        let recurrenceRule = event.recurrenceRule;
        if (!recurrenceRule && event.recurrencePattern) {
          // Basic conversion from recurrencePattern to RRULE format
          const { frequency, interval, endDate } = event.recurrencePattern;
          const freq = frequency.toUpperCase();
          recurrenceRule = `FREQ=${freq}`;
          if (interval && interval !== 1) {
            recurrenceRule += `;INTERVAL=${interval}`;
          }
          if (endDate) {
            // Convert endDate to UNTIL format (YYYYMMDDTHHMMSSZ)
            const until = new Date(endDate).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
            recurrenceRule += `;UNTIL=${until}`;
          }
        }

        // Encrypt calendar event data including location
        const salt = generateSalt();
        const iv = generateIV();
        const derivedKey = deriveKeyFromPassword(encryptionKey, salt);
        
        const eventData = {
          title: event.title || 'Imported Event',
          description: event.description,
          location: event.location,
          startTime: event.startTime || new Date().toISOString(),
          endTime: event.endTime || new Date(Date.now() + 60 * 60 * 1000).toISOString(),
          isAllDay: event.isAllDay || false,
          calendarId: mappedCalendarId,
          recurrenceRule: recurrenceRule,
          recurrenceException: event.recurrenceException,
        };
        
        const encryptedData = encryptData(eventData, derivedKey, iv);
        
        await backend.calendarEvents.create({
          // Encrypted data (preserves location and all event details)
          encrypted_data: encryptedData,
          iv: iv,
          salt: salt,
          // Backward compatibility fields
          title: event.title || 'Imported Event',
          description: event.description,
          location: event.location,
          start_time: event.startTime || new Date().toISOString(),
          end_time: event.endTime || new Date(Date.now() + 60 * 60 * 1000).toISOString(),
          all_day: event.isAllDay || false,
          calendar_id: mappedCalendarId,
          recurrence_rule: recurrenceRule,
          recurrence_exception: event.recurrenceException,
        });
      }
    }
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