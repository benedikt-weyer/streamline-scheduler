'use server';

import { createClient } from '@/utils/supabase/server';
import { EncryptedCalendarEvent, EncryptedCalendar } from '@/utils/types';

// Fetch all encrypted calendar events for the current user
export async function fetchCalendarEvents(): Promise<EncryptedCalendarEvent[]> {
  try {
    const supabase = await createClient();
    
    // Get the current authenticated user
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      throw new Error('User not authenticated');
    }
    
    const { data: events, error } = await supabase
      .from('calendar_events')
      .select('*')
      .eq('user_id', user.id) // Only fetch events for the authenticated user
      .order('created_at', { ascending: true });
    
    if (error) {
      console.error('Error fetching calendar events:', error);
      throw new Error(error.message);
    }
    
    return events as EncryptedCalendarEvent[];
  } catch (error) {
    console.error('Failed to fetch calendar events:', error);
    throw error;
  }
}

// Add a new encrypted calendar event
export async function addCalendarEvent(
  encryptedData: string,
  iv: string,
  salt: string
): Promise<EncryptedCalendarEvent> {
  try {
    const supabase = await createClient();
    
    // Get the current authenticated user
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      throw new Error('User not authenticated');
    }
    
    const { data, error } = await supabase
      .from('calendar_events')
      .insert({
        user_id: user.id, // Associate the event with the authenticated user
        encrypted_data: encryptedData,
        iv,
        salt,
      })
      .select()
      .single();
    
    if (error) {
      console.error('Error adding calendar event:', error);
      throw new Error(error.message);
    }
    
    return data as EncryptedCalendarEvent;
  } catch (error) {
    console.error('Failed to add calendar event:', error);
    throw error;
  }
}

// Update an existing encrypted calendar event
export async function updateCalendarEvent(
  id: string,
  encryptedData: string,
  iv: string,
  salt: string
): Promise<EncryptedCalendarEvent> {
  try {
    const supabase = await createClient();
    
    // Get the current authenticated user
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      throw new Error('User not authenticated');
    }
    
    const { data, error } = await supabase
      .from('calendar_events')
      .update({
        encrypted_data: encryptedData,
        iv,
        salt,
      })
      .eq('id', id)
      .eq('user_id', user.id) // Ensure the event belongs to the authenticated user
      .select()
      .single();
    
    if (error) {
      console.error('Error updating calendar event:', error);
      throw new Error(error.message);
    }
    
    return data as EncryptedCalendarEvent;
  } catch (error) {
    console.error('Failed to update calendar event:', error);
    throw error;
  }
}

// Delete a calendar event
export async function deleteCalendarEvent(id: string): Promise<void> {
  try {
    const supabase = await createClient();
    
    // Get the current authenticated user
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      throw new Error('User not authenticated');
    }
    
    const { error } = await supabase
      .from('calendar_events')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id); // Ensure the event belongs to the authenticated user
    
    if (error) {
      console.error('Error deleting calendar event:', error);
      throw new Error(error.message);
    }
  } catch (error) {
    console.error('Failed to delete calendar event:', error);
    throw error;
  }
}

// CALENDAR MANAGEMENT FUNCTIONS

// Fetch all encrypted calendars for the current user
export async function fetchCalendars(): Promise<EncryptedCalendar[]> {
  try {
    const supabase = await createClient();
    
    // Get the current authenticated user
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      throw new Error('User not authenticated');
    }
    
    const { data: calendars, error } = await supabase
      .from('calendars')
      .select('*')
      .eq('user_id', user.id) // Only fetch calendars for the authenticated user
      .order('created_at', { ascending: true });
    
    if (error) {
      console.error('Error fetching calendars:', error);
      throw new Error(error.message);
    }
    
    return calendars as EncryptedCalendar[];
  } catch (error) {
    console.error('Failed to fetch calendars:', error);
    throw error;
  }
}

// Add a new encrypted calendar
export async function addCalendar(
  encryptedData: string,
  iv: string,
  salt: string,
  isDefault: boolean = false
): Promise<EncryptedCalendar> {
  try {
    const supabase = await createClient();
    
    // Get the current authenticated user
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      throw new Error('User not authenticated');
    }
    
    // If this is the default calendar, ensure no other calendar is default
    if (isDefault) {
      await supabase
        .from('calendars')
        .update({ is_default: false })
        .eq('user_id', user.id)
        .eq('is_default', true);
    }
    
    const { data, error } = await supabase
      .from('calendars')
      .insert({
        user_id: user.id, // Associate the calendar with the authenticated user
        encrypted_data: encryptedData,
        iv,
        salt,
        is_default: isDefault,
      })
      .select()
      .single();
    
    if (error) {
      console.error('Error adding calendar:', error);
      throw new Error(error.message);
    }
    
    return data as EncryptedCalendar;
  } catch (error) {
    console.error('Failed to add calendar:', error);
    throw error;
  }
}

// Update an existing encrypted calendar
export async function updateCalendar(
  id: string,
  encryptedData: string,
  iv: string,
  salt: string,
  isDefault: boolean = false
): Promise<EncryptedCalendar> {
  try {
    const supabase = await createClient();
    
    // Get the current authenticated user
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      throw new Error('User not authenticated');
    }
    
    // If this is the default calendar, ensure no other calendar is default
    if (isDefault) {
      await supabase
        .from('calendars')
        .update({ is_default: false })
        .eq('user_id', user.id)
        .eq('is_default', true)
        .neq('id', id); // Don't update the current calendar
    }
    
    const { data, error } = await supabase
      .from('calendars')
      .update({
        encrypted_data: encryptedData,
        iv,
        salt,
        is_default: isDefault,
      })
      .eq('id', id)
      .eq('user_id', user.id) // Ensure the calendar belongs to the authenticated user
      .select()
      .single();
    
    if (error) {
      console.error('Error updating calendar:', error);
      throw new Error(error.message);
    }
    
    return data as EncryptedCalendar;
  } catch (error) {
    console.error('Failed to update calendar:', error);
    throw error;
  }
}

// Delete a calendar and optionally move its events to another calendar
export async function deleteCalendar(id: string, moveToCalendarId?: string): Promise<void> {
  try {
    const supabase = await createClient();
    
    // Get the current authenticated user
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      throw new Error('User not authenticated');
    }
    
    // Start a transaction to ensure all operations succeed or fail together
    const { error: transactionError } = await supabase.rpc('begin_transaction');
    if (transactionError) throw new Error(transactionError.message);
    
    try {
      // If moveToCalendarId is provided, update all events from this calendar to the new one
      if (moveToCalendarId) {
        // Update all calendar events in the database with this calendar ID to the new one
        // This requires updating the encrypted_data of each event, which needs to be done client-side
        // Here we're just getting all the events that need to be updated
        const { data: eventsToMove, error: fetchError } = await supabase
          .from('calendar_events')
          .select('*')
          .eq('user_id', user.id)
          .contains('encrypted_data', `"calendarId":"${id}"`);
        
        if (fetchError) throw new Error(fetchError.message);
        
        // The actual event updates will need to be done client-side where we can decrypt/encrypt
        // We'll return the events that need to be moved and let the client handle it
        if (eventsToMove && eventsToMove.length > 0) {
          // This is just a placeholder - actual updates happen client-side
          console.log(`${eventsToMove.length} events need to be moved from calendar ${id} to ${moveToCalendarId}`);
        }
      }
      
      // Delete the calendar
      const { error: deleteError } = await supabase
        .from('calendars')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id); // Ensure the calendar belongs to the authenticated user
      
      if (deleteError) throw new Error(deleteError.message);
      
      // Commit the transaction
      const { error: commitError } = await supabase.rpc('commit_transaction');
      if (commitError) throw new Error(commitError.message);
    } catch (error) {
      // Rollback the transaction on error
      await supabase.rpc('rollback_transaction');
      throw error;
    }
  } catch (error) {
    console.error('Failed to delete calendar:', error);
    throw error;
  }
}

// Update an existing calendar event to change its calendar ID
export async function updateEventCalendar(
  eventId: string,
  encryptedData: string,
  iv: string,
  salt: string
): Promise<EncryptedCalendarEvent> {
  try {
    const supabase = await createClient();
    
    // Get the current authenticated user
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      throw new Error('User not authenticated');
    }
    
    const { data, error } = await supabase
      .from('calendar_events')
      .update({
        encrypted_data: encryptedData,
        iv,
        salt,
      })
      .eq('id', eventId)
      .eq('user_id', user.id) // Ensure the event belongs to the authenticated user
      .select()
      .single();
    
    if (error) {
      console.error('Error updating event calendar:', error);
      throw new Error(error.message);
    }
    
    return data as EncryptedCalendarEvent;
  } catch (error) {
    console.error('Failed to update event calendar:', error);
    throw error;
  }
}