'use client';

import { getBackend } from '@/utils/api/backend-interface';

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

// Export all user data
export async function exportUserData(): Promise<ExportedData> {
  try {
    const backend = getBackend();
    
    // Get user info
    const { data: { user } } = await backend.auth.getUser();
    if (!user) {
      throw new Error('User not authenticated');
    }

    // Fetch all user data
    const [canDoListResult, projectsResult, calendarsResult, calendarEventsResult] = await Promise.all([
      backend.canDoList.list(),
      backend.projects.list(),
      backend.calendars.list(),
      backend.calendarEvents.list(),
    ]);

    return {
      version: '1.0',
      timestamp: new Date().toISOString(),
      userId: user.id,
      data: {
        can_do_list: canDoListResult.data,
        projects: projectsResult.data,
        calendars: calendarsResult.data,
        calendar_events: calendarEventsResult.data,
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

    // Import in the correct order (projects first, then tasks that reference them)
    
    // Import projects
    for (const project of data.data.projects) {
      await backend.projects.create({
        encrypted_data: project.encrypted_data,
        iv: project.iv,
        salt: project.salt,
        parent_id: project.parent_id,
        display_order: project.display_order,
        is_collapsed: project.is_collapsed,
      });
    }

    // Import can-do list items
    for (const task of data.data.can_do_list) {
      await backend.canDoList.create({
        encrypted_data: task.encrypted_data,
        iv: task.iv,
        salt: task.salt,
        project_id: task.project_id,
        display_order: task.display_order,
      });
    }

    // Import calendars
    for (const calendar of data.data.calendars) {
      await backend.calendars.create({
        encrypted_data: calendar.encrypted_data,
        iv: calendar.iv,
        salt: calendar.salt,
        is_default: calendar.is_default,
      });
    }

    // Import calendar events
    for (const event of data.data.calendar_events) {
      await backend.calendarEvents.create({
        encrypted_data: event.encrypted_data,
        iv: event.iv,
        salt: event.salt,
      });
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

    // Get all data first
    const [canDoListResult, projectsResult, calendarsResult, calendarEventsResult] = await Promise.all([
      backend.canDoList.list(),
      backend.projects.list(),
      backend.calendars.list(),
      backend.calendarEvents.list(),
    ]);

    // Delete in reverse order (children first, then parents)
    
    // Delete calendar events
    for (const event of calendarEventsResult.data) {
      await backend.calendarEvents.delete(event.id);
    }

    // Delete calendars
    for (const calendar of calendarsResult.data) {
      await backend.calendars.delete(calendar.id);
    }

    // Delete can-do list items
    for (const task of canDoListResult.data) {
      await backend.canDoList.delete(task.id);
    }

    // Delete projects
    for (const project of projectsResult.data) {
      await backend.projects.delete(project.id);
    }
  } catch (error) {
    console.error('Failed to clear user data:', error);
    throw error;
  }
}

// Change user password
export async function changePassword(newPassword: string): Promise<void> {
  try {
    const backend = getBackend();
    await backend.auth.updatePassword(newPassword);
  } catch (error) {
    console.error('Failed to change password:', error);
    throw error;
  }
}