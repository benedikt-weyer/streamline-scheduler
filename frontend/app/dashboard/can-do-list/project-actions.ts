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
    console.log('[fetchProjects] No authenticated user found');
    throw new Error('User must be authenticated to fetch projects');
  }
  
  console.log('[fetchProjects] Fetching projects for user:', user.id);
  
  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .eq('user_id', user.id)
    .order('display_order', { ascending: true });
  
  if (error) {
    console.error("[fetchProjects] Error fetching projects:", error);
    throw new Error(`Failed to fetch projects: ${error.message}`);
  }
  
  console.log('[fetchProjects] Successfully fetched projects:', data?.length || 0);
  
  return data as EncryptedProject[];
}

// Add a new encrypted project
export async function addProject(
  encryptedData: string,
  iv: string,
  salt: string,
  parentId?: string,
  displayOrder?: number,
  isCollapsed?: boolean,
  silent = false
): Promise<EncryptedProject> {
  const supabase = await createClient();
  
  // Get the authenticated user
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    throw new Error('User must be authenticated to add projects');
  }

  // If no displayOrder provided, get the next order for this parent
  let finalDisplayOrder = displayOrder;
  if (finalDisplayOrder === undefined) {
    const { data: maxOrderData } = await supabase
      .from('projects')
      .select('display_order')
      .eq('user_id', user.id)
      .eq('parent_id', parentId ?? null)
      .order('display_order', { ascending: false })
      .limit(1);
    
    finalDisplayOrder = maxOrderData && maxOrderData.length > 0 
      ? (maxOrderData[0].display_order ?? 0) + 1 
      : 0;
  }
  
  const { data, error } = await supabase
    .from('projects')
    .insert({
      user_id: user.id,
      encrypted_data: encryptedData,
      iv,
      salt,
      parent_id: parentId,
      display_order: finalDisplayOrder,
      is_collapsed: isCollapsed ?? false
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
  displayOrder?: number,
  isCollapsed?: boolean,
  silent = false
): Promise<void> {
  const supabase = await createClient();
  
  // Get the authenticated user
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    throw new Error('User must be authenticated to update projects');
  }
  
  const updateData: any = {
    encrypted_data: encryptedData,
    iv,
    salt,
    parent_id: parentId,
    updated_at: new Date().toISOString()
  };

  if (displayOrder !== undefined) {
    updateData.display_order = displayOrder;
  }

  if (isCollapsed !== undefined) {
    updateData.is_collapsed = isCollapsed;
  }
  
  const { error } = await supabase
    .from('projects')
    .update(updateData)
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

// Update project collapsed state
export async function updateProjectCollapsedState(
  id: string,
  isCollapsed: boolean,
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
      is_collapsed: isCollapsed,
      updated_at: new Date().toISOString()
    })
    .eq('id', id)
    .eq('user_id', user.id);
  
  if (error) {
    if (!silent) {
      console.error("Error updating project collapsed state:", error);
    }
    throw new Error(`Failed to update project collapsed state: ${error.message}`);
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

// Bulk update project orders and parents (for drag and drop)
export async function bulkUpdateProjectOrder(
  updates: Array<{ id: string; parentId?: string; displayOrder: number }>,
  silent = false
): Promise<void> {
  const supabase = await createClient();
  
  // Get the authenticated user
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    throw new Error('User must be authenticated to update projects');
  }

  // Perform bulk update using a transaction-like approach
  for (const update of updates) {
    const { error } = await supabase
      .from('projects')
      .update({
        parent_id: update.parentId ?? null,
        display_order: update.displayOrder,
        updated_at: new Date().toISOString()
      })
      .eq('id', update.id)
      .eq('user_id', user.id);
    
    if (error) {
      if (!silent) {
        console.error("Error updating project order:", error);
      }
      throw new Error(`Failed to update project order: ${error.message}`);
    }
  }
  
  revalidatePath('/dashboard/can-do-list');
}
