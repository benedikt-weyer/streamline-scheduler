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
      salt
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
  silent = false
): Promise<EncryptedCanDoItem> {
  const supabase = await createClient();
  
  const { data, error } = await supabase
    .from('can_do_list')
    .update({
      encrypted_data: encryptedData,
      iv,
      salt
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