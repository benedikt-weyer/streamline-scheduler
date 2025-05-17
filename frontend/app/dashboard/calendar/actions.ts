'use server';

import { createClient } from '@/utils/supabase/server';
import { EncryptedCalendarEvent } from '@/utils/types';

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