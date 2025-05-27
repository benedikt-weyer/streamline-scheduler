'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/utils/supabase/server';
import { EncryptedProject } from '@/utils/can-do-list/can-do-list-types';

// Fetch all encrypted projects for the current user
export async function fetchProjects(): Promise<EncryptedProject[]> {
  const supabase = await createClient();
  
  // Get the authenticated user
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    throw new Error('User must be authenticated to fetch projects');
  }
  
  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });
  
  if (error) {
    console.error("Error fetching projects:", error);
    throw new Error(`Failed to fetch projects: ${error.message}`);
  }
  
  return data as EncryptedProject[];
}

// Add a new encrypted project
export async function addProject(
  encryptedData: string,
  iv: string,
  salt: string,
  parentId?: string,
  silent = false
): Promise<EncryptedProject> {
  const supabase = await createClient();
  
  // Get the authenticated user
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    throw new Error('User must be authenticated to add projects');
  }
  
  const { data, error } = await supabase
    .from('projects')
    .insert({
      user_id: user.id,
      encrypted_data: encryptedData,
      iv,
      salt,
      parent_id: parentId
    })
    .select()
    .single();
  
  if (error) {
    if (!silent) {
      console.error("Error adding project:", error);
    }
    throw new Error(`Failed to add project: ${error.message}`);
  }
  
  revalidatePath('/dashboard/can-do-list');
  return data as EncryptedProject;
}

// Update an existing encrypted project
export async function updateProject(
  id: string,
  encryptedData: string,
  iv: string,
  salt: string,
  parentId?: string,
  silent = false
): Promise<void> {
  const supabase = await createClient();
  
  // Get the authenticated user
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    throw new Error('User must be authenticated to update projects');
  }
  
  const { error } = await supabase
    .from('projects')
    .update({
      encrypted_data: encryptedData,
      iv,
      salt,
      parent_id: parentId,
      updated_at: new Date().toISOString()
    })
    .eq('id', id)
    .eq('user_id', user.id);
  
  if (error) {
    if (!silent) {
      console.error("Error updating project:", error);
    }
    throw new Error(`Failed to update project: ${error.message}`);
  }
  
  revalidatePath('/dashboard/can-do-list');
}

// Delete a project
export async function deleteProject(id: string, silent = false): Promise<void> {
  const supabase = await createClient();
  
  // Get the authenticated user
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    throw new Error('User must be authenticated to delete projects');
  }
  
  const { error } = await supabase
    .from('projects')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id);
  
  if (error) {
    if (!silent) {
      console.error("Error deleting project:", error);
    }
    throw new Error(`Failed to delete project: ${error.message}`);
  }
  
  revalidatePath('/dashboard/can-do-list');
}
