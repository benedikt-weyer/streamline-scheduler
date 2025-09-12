'use client';

import { getBackend } from '@/utils/api/backend-interface';
import { EncryptedProject } from '@/utils/can-do-list/can-do-list-types';

// Fetch all encrypted projects for the current user
export async function fetchProjects(): Promise<EncryptedProject[]> {
  try {
    const backend = getBackend();
    const { data: projects } = await backend.projects.list();
    return projects as EncryptedProject[];
  } catch (error) {
    console.error('Failed to fetch projects:', error);
    throw error;
  }
}

// Add a new encrypted project
export async function addProject(
  encryptedData: string,
  iv: string,
  salt: string,
  parentId?: string,
  displayOrder?: number,
  isCollapsed?: boolean
): Promise<EncryptedProject> {
  try {
    const backend = getBackend();
    const { data: project } = await backend.projects.create({
      encrypted_data: encryptedData,
      iv,
      salt,
      parent_id: parentId,
      display_order: displayOrder,
      is_collapsed: isCollapsed,
    });
    return project as EncryptedProject;
  } catch (error) {
    console.error('Failed to add project:', error);
    throw error;
  }
}

// Update an existing encrypted project
export async function updateProject(
  id: string,
  encryptedData?: string,
  iv?: string,
  salt?: string,
  isDefault?: boolean,
  parentId?: string,
  displayOrder?: number,
  isCollapsed?: boolean
): Promise<EncryptedProject> {
  try {
    const backend = getBackend();
    const updateData: any = {};
    
    if (encryptedData !== undefined) updateData.encrypted_data = encryptedData;
    if (iv !== undefined) updateData.iv = iv;
    if (salt !== undefined) updateData.salt = salt;
    if (isDefault !== undefined) updateData.is_default = isDefault;
    if (parentId !== undefined) updateData.parent_id = parentId;
    if (displayOrder !== undefined) updateData.display_order = displayOrder;
    if (isCollapsed !== undefined) updateData.is_collapsed = isCollapsed;

    const { data: project } = await backend.projects.update(id, updateData);
    return project as EncryptedProject;
  } catch (error) {
    console.error('Failed to update project:', error);
    throw error;
  }
}

// Delete a project
export async function deleteProject(id: string): Promise<void> {
  try {
    const backend = getBackend();
    await backend.projects.delete(id);
  } catch (error) {
    console.error('Failed to delete project:', error);
    throw error;
  }
}

// Reorder projects
export async function reorderProjects(projectUpdates: Array<{ id: string; displayOrder: number; parentId?: string }>): Promise<void> {
  try {
    const backend = getBackend();
    
    // Update each project's display order and parent
    for (const update of projectUpdates) {
      const updateData: any = {
        display_order: update.displayOrder,
      };
      if (update.parentId !== undefined) {
        updateData.parent_id = update.parentId;
      }
      
      await backend.projects.update(update.id, updateData);
    }
  } catch (error) {
    console.error('Failed to reorder projects:', error);
    throw error;
  }
}

// Toggle project collapse state
export async function toggleProjectCollapse(id: string, isCollapsed: boolean): Promise<EncryptedProject> {
  try {
    const backend = getBackend();
    const { data: project } = await backend.projects.update(id, {
      is_collapsed: isCollapsed,
    });
    return project as EncryptedProject;
  } catch (error) {
    console.error('Failed to toggle project collapse:', error);
    throw error;
  }
}