"use server";

import { createClient } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";
import { EncryptedTask } from "@/utils/can-do-list/can-do-list-types";

// Fetch all encrypted tasks for the current user
export async function fetchTasks(silent = false): Promise<EncryptedTask[]> {
  const supabase = await createClient();
  
  const { data, error } = await supabase
    .from('can_do_list')
    .select('*')
    .order('created_at', { ascending: false });
  
  if (error) {
    if (!silent) {
      console.error("Error fetching tasks:", error);
    }
    throw new Error(`Failed to fetch tasks: ${error.message}`);
  }
  
  return data as EncryptedTask[];
}

// Add a new encrypted task
export async function addTask(
  encryptedData: string,
  iv: string,
  salt: string,
  projectId?: string,
  silent = false
): Promise<EncryptedTask> {
  const supabase = await createClient();
  
  // Get the authenticated user
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    throw new Error('User must be authenticated to add tasks');
  }
  
  const { data, error } = await supabase
    .from('can_do_list')
    .insert({
      user_id: user.id,
      encrypted_data: encryptedData,
      iv,
      salt,
      project_id: projectId
    })
    .select()
    .single();
  
  if (error) {
    if (!silent) {
      console.error("Error adding task:", error);
    }
    throw new Error(`Failed to add task: ${error.message}`);
  }
  
  revalidatePath('/dashboard/can-do-list');
  return data as EncryptedTask;
}

// Update an existing encrypted task
export async function updateTask(
  id: string,
  encryptedData: string,
  iv: string,
  salt: string,
  projectId?: string,
  silent = false
): Promise<EncryptedTask> {
  const supabase = await createClient();
  
  const { data, error } = await supabase
    .from('can_do_list')
    .update({
      encrypted_data: encryptedData,
      iv,
      salt,
      project_id: projectId
    })
    .eq('id', id)
    .select()
    .single();
  
  if (error) {
    if (!silent) {
      console.error("Error updating task:", error);
    }
    throw new Error(`Failed to update task: ${error.message}`);
  }
  
  revalidatePath('/dashboard/can-do-list');
  return data as EncryptedTask;
}

// Move a task to a different project
export async function moveTaskToProject(
  id: string,
  projectId?: string,
  silent = false
): Promise<void> {
  const supabase = await createClient();
  
  const { error } = await supabase
    .from('can_do_list')
    .update({
      project_id: projectId
    })
    .eq('id', id);
  
  if (error) {
    if (!silent) {
      console.error("Error moving task:", error);
    }
    throw new Error(`Failed to move task: ${error.message}`);
  }
  
  revalidatePath('/dashboard/can-do-list');
}

// Delete a task
export async function deleteTask(id: string, silent = false): Promise<void> {
  const supabase = await createClient();
  
  const { error } = await supabase
    .from('can_do_list')
    .delete()
    .eq('id', id);
  
  if (error) {
    if (!silent) {
      console.error("Error deleting task:", error);
    }
    throw new Error(`Failed to delete task: ${error.message}`);
  }
  
  revalidatePath('/dashboard/can-do-list');
}

// Bulk delete tasks by IDs
export async function bulkDeleteTasks(ids: string[], silent = false): Promise<void> {
  const supabase = await createClient();
  
  // Get the authenticated user
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    throw new Error('User must be authenticated to delete tasks');
  }
  
  if (ids.length === 0) {
    return;
  }
  
  const { error } = await supabase
    .from('can_do_list')
    .delete()
    .eq('user_id', user.id)
    .in('id', ids);
  
  if (error) {
    if (!silent) {
      console.error("Error bulk deleting tasks:", error);
    }
    throw new Error(`Failed to bulk delete tasks: ${error.message}`);
  }
  
  revalidatePath('/dashboard/can-do-list');
}

// Fetch can-do items for a specific project
export async function fetchTasksByProject(projectId?: string, silent = false): Promise<EncryptedTask[]> {
  const supabase = await createClient();
  
  let query = supabase
    .from('can_do_list')
    .select('*')
    .order('created_at', { ascending: false });
  
  // If projectId is null or undefined, get items without a project
  if (projectId === null || projectId === undefined) {
    query = query.is('project_id', null);
  } else {
    query = query.eq('project_id', projectId);
  }
  
  const { data, error } = await query;
  
  if (error) {
    if (!silent) {
      console.error("Error fetching can-do items by project:", error);
    }
    throw new Error(`Failed to fetch can-do items by project: ${error.message}`);
  }
  
  return data as EncryptedTask[];
}