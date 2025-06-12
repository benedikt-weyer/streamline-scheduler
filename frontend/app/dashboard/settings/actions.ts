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

  console.log('Starting import for user:', user.id);
  console.log('Data to import:', {
    projects: data.data.projects.length,
    calendars: data.data.calendars.length,
    tasks: data.data.tasks.length,
    calendarEvents: data.data.calendarEvents.length,
    hasProfile: !!data.data.profile
  });

  try {
    // Helper function to prepare data for insertion
    const prepareForInsert = (items: any[]) => {
      return items.map(item => {
        const { id, ...rest } = item; // Remove the original id
        return {
          ...rest,
          user_id: user.id // Ensure user_id is set to current user
        };
      });
    };

    // Import data in correct order to handle foreign key constraints

    // 1. Import projects first (they might reference each other)
    if (data.data.projects && data.data.projects.length > 0) {
      console.log('Importing projects...');
      const projectsToInsert = prepareForInsert(data.data.projects);
      
      // For projects with parent relationships, we need to handle them carefully
      // First, import projects without parents
      const rootProjects = projectsToInsert.filter(p => !p.parent_id);
      const childProjects = projectsToInsert.filter(p => p.parent_id);
      
      if (rootProjects.length > 0) {
        const { error: projectError } = await supabase.from('projects').insert(rootProjects);
        if (projectError) {
          console.error('Project import error:', projectError);
          throw new Error(`Failed to import projects: ${projectError.message}`);
        }
        console.log(`Imported ${rootProjects.length} root projects`);
      }
      
      // For child projects, we'll insert them without parent_id for now
      // In a more sophisticated version, we'd map old IDs to new IDs
      if (childProjects.length > 0) {
        const childProjectsWithoutParent = childProjects.map(({ parent_id, ...rest }) => rest);
        const { error: childProjectError } = await supabase.from('projects').insert(childProjectsWithoutParent);
        if (childProjectError) {
          console.error('Child project import error:', childProjectError);
          throw new Error(`Failed to import child projects: ${childProjectError.message}`);
        }
        console.log(`Imported ${childProjects.length} child projects (parent relationships not preserved)`);
      }
    }

    // 2. Import calendars
    if (data.data.calendars && data.data.calendars.length > 0) {
      console.log('Importing calendars...');
      const calendarsToInsert = prepareForInsert(data.data.calendars);
      const { error: calendarError } = await supabase.from('calendars').insert(calendarsToInsert);
      if (calendarError) {
        console.error('Calendar import error:', calendarError);
        throw new Error(`Failed to import calendars: ${calendarError.message}`);
      }
      console.log(`Imported ${calendarsToInsert.length} calendars`);
    }

    // 3. Import tasks (they reference projects, but we'll import them without project_id for now)
    if (data.data.tasks && data.data.tasks.length > 0) {
      console.log('Importing tasks...');
      const tasksToInsert = prepareForInsert(data.data.tasks).map(({ project_id, ...rest }) => rest);
      const { error: taskError } = await supabase.from('can_do_list').insert(tasksToInsert);
      if (taskError) {
        console.error('Task import error:', taskError);
        throw new Error(`Failed to import tasks: ${taskError.message}`);
      }
      console.log(`Imported ${tasksToInsert.length} tasks (project relationships not preserved)`);
    }

    // 4. Import calendar events (they might reference calendars, but we'll import them without calendar_id references for now)
    if (data.data.calendarEvents && data.data.calendarEvents.length > 0) {
      console.log('Importing calendar events...');
      const eventsToInsert = prepareForInsert(data.data.calendarEvents);
      const { error: eventError } = await supabase.from('calendar_events').insert(eventsToInsert);
      if (eventError) {
        console.error('Calendar event import error:', eventError);
        throw new Error(`Failed to import calendar events: ${eventError.message}`);
      }
      console.log(`Imported ${eventsToInsert.length} calendar events`);
    }

    // 5. Import profile (optional)
    if (data.data.profile) {
      console.log('Importing profile...');
      try {
        const { id: originalId, ...profileData } = data.data.profile;
        const { error: profileError } = await supabase.from('profiles').upsert({
          ...profileData,
          id: user.id
        });
        if (profileError) {
          console.warn('Profile import error (non-fatal):', profileError);
        } else {
          console.log('Profile imported successfully');
        }
      } catch (profileError) {
        console.warn('Profile import failed (non-fatal):', profileError);
      }
    }
    
    console.log('Import completed successfully');
    revalidatePath('/dashboard');
  } catch (error) {
    console.error('Error importing user data:', error);
    throw new Error(`Failed to import user data: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
} 