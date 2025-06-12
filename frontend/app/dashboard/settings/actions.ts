'use server';

import { createClient } from '@/utils/supabase/server';
import { revalidatePath } from 'next/cache';

export interface ExportedData {
  version: string;
  timestamp: string;
  userId: string;
  data: {
    tasks: any[];
    projects: any[];
    calendars: any[];
    calendarEvents: any[];
    profile?: any;
  };
}

// Fetch all user data for export
export async function exportAllUserData(): Promise<ExportedData> {
  const supabase = await createClient();
  
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    throw new Error('User not authenticated');
  }

  try {
    // Fetch all data in parallel
    const [tasksResult, projectsResult, calendarsResult, eventsResult] = await Promise.all([
      supabase.from('can_do_list').select('*').eq('user_id', user.id),
      supabase.from('projects').select('*').eq('user_id', user.id),
      supabase.from('calendars').select('*').eq('user_id', user.id),
      supabase.from('calendar_events').select('*').eq('user_id', user.id)
    ]);

    // Try to fetch profile separately (it might not exist)
    let profileResult;
    try {
      profileResult = await supabase.from('profiles').select('*').eq('id', user.id);
    } catch (profileError) {
      console.log('Profiles table not available or no profile found:', profileError);
      profileResult = { data: null, error: null };
    }

    // Check for errors
    if (tasksResult.error) {
      console.error('Tasks fetch error:', tasksResult.error);
      throw new Error(`Failed to fetch tasks: ${tasksResult.error.message}`);
    }
    if (projectsResult.error) {
      console.error('Projects fetch error:', projectsResult.error);
      throw new Error(`Failed to fetch projects: ${projectsResult.error.message}`);
    }
    if (calendarsResult.error) {
      console.error('Calendars fetch error:', calendarsResult.error);
      throw new Error(`Failed to fetch calendars: ${calendarsResult.error.message}`);
    }
    if (eventsResult.error) {
      console.error('Events fetch error:', eventsResult.error);
      throw new Error(`Failed to fetch events: ${eventsResult.error.message}`);
    }
    if (profileResult.error) {
      console.warn('Profile fetch error (non-fatal):', profileResult.error);
      // Don't throw error for profile - it's optional
    }

    // Ensure all data is serializable by converting to plain objects
    const sanitizeData = (data: any): any => {
      if (data === null || data === undefined) {
        return null;
      }
      try {
        return JSON.parse(JSON.stringify(data));
      } catch (error) {
        console.warn('Failed to sanitize data:', error);
        return null;
      }
    };

    const exportData: ExportedData = {
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      userId: user.id,
      data: {
        tasks: sanitizeData(tasksResult.data) || [],
        projects: sanitizeData(projectsResult.data) || [],
        calendars: sanitizeData(calendarsResult.data) || [],
        calendarEvents: sanitizeData(eventsResult.data) || [],
        profile: sanitizeData(profileResult?.data?.[0]) || null
      }
    };

    console.log('Export data prepared:', {
      version: exportData.version,
      timestamp: exportData.timestamp,
      userId: exportData.userId,
      counts: {
        tasks: exportData.data.tasks.length,
        projects: exportData.data.projects.length,
        calendars: exportData.data.calendars.length,
        calendarEvents: exportData.data.calendarEvents.length,
        hasProfile: !!exportData.data.profile
      }
    });

    return exportData;
  } catch (error) {
    console.error('Error exporting user data:', error);
    throw new Error(`Failed to export user data: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// Delete all user data
export async function deleteAllUserData(): Promise<void> {
  const supabase = await createClient();
  
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    throw new Error('User not authenticated');
  }

  try {
    // Delete all data in parallel (order matters due to foreign key constraints)
    await Promise.all([
      supabase.from('calendar_events').delete().eq('user_id', user.id),
      supabase.from('can_do_list').delete().eq('user_id', user.id),
    ]);
    
    await Promise.all([
      supabase.from('calendars').delete().eq('user_id', user.id),
      supabase.from('projects').delete().eq('user_id', user.id),
    ]);
    
    // Profile is optional and references auth.users, so it's safer to delete last
    await supabase.from('profiles').delete().eq('id', user.id);
    
    revalidatePath('/dashboard');
  } catch (error) {
    console.error('Error deleting user data:', error);
    throw new Error('Failed to delete user data');
  }
}

// Import user data (this would be used after validating in dry-run)
export async function importUserData(data: ExportedData): Promise<void> {
  const supabase = await createClient();
  
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    throw new Error('User not authenticated');
  }

  try {
    // Import data in correct order (projects first due to foreign keys)
    if (data.data.projects.length > 0) {
      const projectsToInsert = data.data.projects.map(project => ({
        ...project,
        user_id: user.id, // Ensure user_id is set to current user
        id: undefined // Let Supabase generate new IDs
      }));
      await supabase.from('projects').insert(projectsToInsert);
    }

    if (data.data.calendars.length > 0) {
      const calendarsToInsert = data.data.calendars.map(calendar => ({
        ...calendar,
        user_id: user.id,
        id: undefined
      }));
      await supabase.from('calendars').insert(calendarsToInsert);
    }

    if (data.data.tasks.length > 0) {
      const tasksToInsert = data.data.tasks.map(task => ({
        ...task,
        user_id: user.id,
        id: undefined
      }));
      await supabase.from('can_do_list').insert(tasksToInsert);
    }

    if (data.data.calendarEvents.length > 0) {
      const eventsToInsert = data.data.calendarEvents.map(event => ({
        ...event,
        user_id: user.id,
        id: undefined
      }));
      await supabase.from('calendar_events').insert(eventsToInsert);
    }

    if (data.data.profile) {
      // For profile, we might want to update if exists, insert if not
      await supabase.from('profiles').upsert({
        ...data.data.profile,
        id: user.id
      });
    }
    
    revalidatePath('/dashboard');
  } catch (error) {
    console.error('Error importing user data:', error);
    throw new Error('Failed to import user data');
  }
} 