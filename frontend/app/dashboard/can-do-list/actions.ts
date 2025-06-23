"use server";

import { createClientServer } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";
import { EncryptedTask } from "@/utils/can-do-list/can-do-list-types";

// Fetch all encrypted tasks for the current user
export async function fetchTasks(silent = false): Promise<EncryptedTask[]> {
  const supabase = await createClientServer();
  
  const { data, error } = await supabase
    .from('can_do_list')
    .select('*')
    .order('display_order', { ascending: true });
  
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
  displayOrder?: number,
  silent = false
): Promise<EncryptedTask> {
  const supabase = await createClientServer();
  
  // Get the authenticated user
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    throw new Error('User must be authenticated to add tasks');
  }

  // Convert empty string to null for proper database handling
  const normalizedProjectId = projectId === '' ? null : projectId;

  // If no displayOrder provided, add at the top (display order 0) and move all other tasks down
  let finalDisplayOrder = displayOrder;
  if (finalDisplayOrder === undefined) {
    // New tasks should be added at the top (display order 0)
    finalDisplayOrder = 0;
    
    console.log('Adding new task at top, incrementing existing active tasks');
    
    // Get all existing active tasks in this project and increment their display orders
    let query = supabase
      .from('can_do_list')
      .select('id, display_order')
      .eq('user_id', user.id)
      .gte('display_order', 0); // Only get active tasks (positive display_order)
    
    // Handle null project_id correctly
    if (normalizedProjectId === null || normalizedProjectId === undefined) {
      query = query.is('project_id', null);
    } else {
      query = query.eq('project_id', normalizedProjectId);
    }
    
    const { data: existingTasks } = await query;
    
    if (existingTasks && existingTasks.length > 0) {
      // Increment all existing active tasks' display orders by 1
      const updates = existingTasks.map(task => 
        supabase
          .from('can_do_list')
          .update({ display_order: task.display_order + 1 })
          .eq('id', task.id)
          .eq('user_id', user.id)
      );
      
      await Promise.all(updates);
    }
  }

  const { data, error } = await supabase
    .from('can_do_list')
    .insert({
      user_id: user.id,
      encrypted_data: encryptedData,
      iv,
      salt,
      project_id: normalizedProjectId,
      display_order: finalDisplayOrder
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
  displayOrder?: number,
  silent = false
): Promise<EncryptedTask> {
  const supabase = await createClientServer();

  // Convert empty string to null for proper database handling
  const normalizedProjectId = projectId === '' ? null : projectId;

  const updateData: any = {
    encrypted_data: encryptedData,
    iv,
    salt,
    project_id: normalizedProjectId
  };

  if (displayOrder !== undefined) {
    updateData.display_order = displayOrder;
  }
  
  const { data, error } = await supabase
    .from('can_do_list')
    .update(updateData)
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
  const supabase = await createClientServer();
  
  // Convert empty string to null for proper database handling
  const normalizedProjectId = projectId === '' ? null : projectId;
  
  const { error } = await supabase
    .from('can_do_list')
    .update({
      project_id: normalizedProjectId
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
  const supabase = await createClientServer();
  
  // Get the authenticated user
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    throw new Error('User must be authenticated to delete tasks');
  }

  // First, get the task's project_id before deleting it so we can reorder the remaining tasks
  const { data: taskToDelete, error: fetchError } = await supabase
    .from('can_do_list')
    .select('project_id, display_order')
    .eq('id', id)
    .eq('user_id', user.id)
    .single();

  if (fetchError) {
    if (!silent) {
      console.error("Error fetching task before deletion:", fetchError);
    }
    throw new Error(`Failed to fetch task before deletion: ${fetchError.message}`);
  }

  if (!taskToDelete) {
    if (!silent) {
      console.error("Task not found or user not authorized");
    }
    throw new Error("Task not found or user not authorized");
  }

  const { error } = await supabase
    .from('can_do_list')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id);
  
  if (error) {
    if (!silent) {
      console.error("Error deleting task:", error);
    }
    throw new Error(`Failed to delete task: ${error.message}`);
  }

  // Only reorder if the deleted task was an active task (positive display_order)
  if (taskToDelete.display_order >= 0) {
    console.log('Reordering active tasks after deletion for project:', taskToDelete.project_id);
    await reorderActiveTasksInProject(taskToDelete.project_id, silent);
  }
  
  revalidatePath('/dashboard/can-do-list');
}

// Bulk delete tasks by IDs
export async function bulkDeleteTasks(ids: string[], silent = false): Promise<void> {
  const supabase = await createClientServer();
  
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
  const supabase = await createClientServer();
  
  let query = supabase
    .from('can_do_list')
    .select('*')
    .order('display_order', { ascending: true });
  
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

// Bulk update task display orders for drag and drop reordering
export async function bulkUpdateTaskOrder(
  updates: { id: string; displayOrder: number }[],
  silent = false
): Promise<void> {
  const supabase = await createClientServer();
  
  // Get the authenticated user
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    throw new Error('User must be authenticated to update tasks');
  }

  // Perform bulk update using a batch of individual updates
  const updatePromises = updates.map(({ id, displayOrder }) =>
    supabase
      .from('can_do_list')
      .update({ display_order: displayOrder })
      .eq('id', id)
      .eq('user_id', user.id) // Ensure user can only update their own tasks
  );

  const results = await Promise.all(updatePromises);
  
  // Check for any errors
  const errors = results.filter(result => result.error);
  if (errors.length > 0) {
    if (!silent) {
      console.error("Error bulk updating task order:", errors);
    }
    throw new Error(`Failed to update task order: ${errors[0].error?.message}`);
  }

  revalidatePath('/dashboard/can-do-list');
}

// Toggle task completion with automatic reordering
export async function toggleTaskCompleteWithReorder(
  id: string,
  encryptedData: string,
  iv: string,
  salt: string,
  completed: boolean,
  projectId?: string,
  silent = false
): Promise<EncryptedTask> {
  const supabase = await createClientServer();
  
  // Get the authenticated user
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    throw new Error('User must be authenticated to update tasks');
  }

  // Convert empty string to null for proper database handling
  const normalizedProjectId = projectId === '' ? null : projectId;

  let newDisplayOrder: number;

  if (completed) {
    // When completing a task, always set display order to -1
    newDisplayOrder = -1;

    console.log('Completing task, setting display order to -1');
  } else {
    // When uncompleting a task, set it to display order 0 (top)
    // and increment all other active tasks' display orders
    newDisplayOrder = 0;

    console.log('Uncompleting task, incrementing display orders of active tasks');
    
    // First, get all active tasks and increment their display orders manually
    let query = supabase
      .from('can_do_list')
      .select('id, display_order')
      .eq('user_id', user.id)
      .gte('display_order', 0); // Only get active tasks (positive display_order)
    
    // Handle null project_id correctly
    if (normalizedProjectId === null || normalizedProjectId === undefined) {
      query = query.is('project_id', null);
    } else {
      query = query.eq('project_id', normalizedProjectId);
    }
    
    const { data: activeTasks } = await query;
    console.log('select where user_id:', user.id, 'and project_id:', normalizedProjectId ?? null, 'display_order >= 0');
    
    console.log('Active tasks before incrementing:', activeTasks);
    
    if (activeTasks && activeTasks.length > 0) {
      // Increment all active tasks' display orders by 1
      const updates = activeTasks.map(task => 
        supabase
          .from('can_do_list')
          .update({ display_order: task.display_order + 1 })
          .eq('id', task.id)
          .eq('user_id', user.id)
      );
      
      await Promise.all(updates);
    }
  }

  // Update the task with new completion status and display order
  const { data, error } = await supabase
    .from('can_do_list')
    .update({
      encrypted_data: encryptedData,
      iv,
      salt,
      display_order: newDisplayOrder,
      updated_at: new Date().toISOString()
    })
    .eq('id', id)
    .eq('user_id', user.id)
    .select()
    .single();
  
  if (error) {
    if (!silent) {
      console.error("Error toggling task completion:", error);
    }
    throw new Error(`Failed to toggle task completion: ${error.message}`);
  }

  // If we completed a task, reorder remaining active tasks to fill gaps
  if (completed) {
    console.log('Reordering active tasks for project:', normalizedProjectId);
    await reorderActiveTasksInProject(normalizedProjectId, silent);
  }

  revalidatePath('/dashboard/can-do-list');
  return data as EncryptedTask;
}

// Helper function to reorder active tasks in a project to fill gaps
async function reorderActiveTasksInProject(projectId?: string | null, silent = false): Promise<void> {
  const supabase = await createClientServer();
  
  // Get the authenticated user
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    throw new Error('User must be authenticated to reorder tasks');
  }

  console.log('Reordering tasks for project:', projectId);

  // Fetch all active tasks (non-completed) for this project, ordered by display_order
  let query = supabase
    .from('can_do_list')
    .select('id, display_order')
    .eq('user_id', user.id)
    .gte('display_order', 0) // Only get tasks with positive display_order (active tasks)
    .order('display_order', { ascending: true });

  // Handle null project_id correctly
  if (projectId === null || projectId === undefined) {
    query = query.is('project_id', null);
  } else {
    query = query.eq('project_id', projectId);
  }

  const { data: activeTasks, error } = await query;

  console.log('Found active tasks:', activeTasks);

  if (error) {
    console.error("Error fetching active tasks for reordering:", error);
    if (!silent) {
      console.error("Error fetching active tasks for reordering:", error);
    }
    return;
  }

  if (!activeTasks || activeTasks.length === 0) {
    console.log('No active tasks found, skipping reorder');
    return;
  }

  // Always reorder to ensure sequential ordering (0, 1, 2, ...)
  // This will fill any gaps left by completed tasks
  const updates = activeTasks.map((task, index) => ({
    id: task.id,
    displayOrder: index
  }));

  console.log('Updates to apply for sequential ordering:', updates);

  // Apply the updates to ensure sequential ordering
  if (updates.length > 0) {
    console.log('Applying bulk updates to ensure sequential ordering');
    await bulkUpdateTaskOrder(updates, silent);
  }
}

