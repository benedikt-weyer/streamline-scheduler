"use server";

import { createClient } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";
import { EncryptedCanDoItem } from "@/utils/can-do-list/can-do-list-types";

// Fetch all encrypted can-do items for the current user
export async function fetchCanDoItems(silent = false): Promise<EncryptedCanDoItem[]> {
  const supabase = await createClient();
  
  const { data, error } = await supabase
    .from('can_do_list')
    .select('*')
    .order('created_at', { ascending: false });
  
  if (error) {
    if (!silent) {
      console.error("Error fetching can-do items:", error);
    }
    throw new Error(`Failed to fetch can-do items: ${error.message}`);
  }
  
  return data as EncryptedCanDoItem[];
}

// Add a new encrypted can-do item
export async function addCanDoItem(
  encryptedData: string,
  iv: string,
  salt: string,
  projectId?: string,
  silent = false
): Promise<EncryptedCanDoItem> {
  const supabase = await createClient();
  
  // Get the authenticated user
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    throw new Error('User must be authenticated to add items');
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
      console.error("Error adding can-do item:", error);
    }
    throw new Error(`Failed to add can-do item: ${error.message}`);
  }
  
  revalidatePath('/dashboard/can-do-list');
  return data as EncryptedCanDoItem;
}

// Update an existing encrypted can-do item
export async function updateCanDoItem(
  id: string,
  encryptedData: string,
  iv: string,
  salt: string,
  projectId?: string,
  silent = false
): Promise<EncryptedCanDoItem> {
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
      console.error("Error updating can-do item:", error);
    }
    throw new Error(`Failed to update can-do item: ${error.message}`);
  }
  
  revalidatePath('/dashboard/can-do-list');
  return data as EncryptedCanDoItem;
}

// Move an item to a different project
export async function moveCanDoItemToProject(
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
      console.error("Error moving can-do item:", error);
    }
    throw new Error(`Failed to move can-do item: ${error.message}`);
  }
  
  revalidatePath('/dashboard/can-do-list');
}

// Delete a can-do item
export async function deleteCanDoItem(id: string, silent = false): Promise<void> {
  const supabase = await createClient();
  
  const { error } = await supabase
    .from('can_do_list')
    .delete()
    .eq('id', id);
  
  if (error) {
    if (!silent) {
      console.error("Error deleting can-do item:", error);
    }
    throw new Error(`Failed to delete can-do item: ${error.message}`);
  }
  
  revalidatePath('/dashboard/can-do-list');
}

// Bulk delete can-do items by IDs
export async function bulkDeleteCanDoItems(ids: string[], silent = false): Promise<void> {
  const supabase = await createClient();
  
  // Get the authenticated user
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    throw new Error('User must be authenticated to delete items');
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
      console.error("Error bulk deleting can-do items:", error);
    }
    throw new Error(`Failed to bulk delete can-do items: ${error.message}`);
  }
  
  revalidatePath('/dashboard/can-do-list');
}

// Fetch can-do items for a specific project
export async function fetchCanDoItemsByProject(projectId?: string, silent = false): Promise<EncryptedCanDoItem[]> {
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
  
  return data as EncryptedCanDoItem[];
}