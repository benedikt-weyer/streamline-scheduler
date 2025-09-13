'use client';

import { getDecryptedBackend } from '@/utils/api/decrypted-backend';
import { Project } from '@/utils/can-do-list/can-do-list-types';
import { ProjectDecrypted, CreateProjectDecryptedRequest, UpdateProjectDecryptedRequest } from '@/utils/api/types';
import { getCurrentUserId } from '@/utils/auth/current-user';

// Fetch all projects for the current user
export async function fetchProjects(): Promise<ProjectDecrypted[]> {
  try {
    const backend = getDecryptedBackend();
    const { data: projects } = await backend.projects.getAll({ all: true });
    return projects || [];
  } catch (error) {
    console.error('Failed to fetch projects:', error);
    throw error;
  }
}

// Add a new project
export async function addProject(projectData: CreateProjectDecryptedRequest): Promise<ProjectDecrypted> {
  try {
    const backend = getDecryptedBackend();
    const { data: project } = await backend.projects.create(projectData);
    if (!project) {
      throw new Error('Failed to create project');
    }
    return project;
  } catch (error) {
    console.error('Failed to add project:', error);
    throw error;
  }
}

// Update an existing project
export async function updateProject(
  id: string,
  updateData: Partial<UpdateProjectDecryptedRequest>
): Promise<ProjectDecrypted> {
  try {
    const backend = getDecryptedBackend();
    const requestData: UpdateProjectDecryptedRequest = {
      id,
      ...updateData
    };
    const { data: project } = await backend.projects.update(requestData);
    if (!project) {
      throw new Error('Failed to update project');
    }
    return project;
  } catch (error) {
    console.error('Failed to update project:', error);
    throw error;
  }
}

// Delete a project
export async function deleteProject(id: string): Promise<void> {
  try {
    const backend = getDecryptedBackend();
    await backend.projects.delete(id);
  } catch (error) {
    console.error('Failed to delete project:', error);
    throw error;
  }
}

// Reorder projects
export async function reorderProjects(projectUpdates: Array<{ id: string; displayOrder: number; parentId?: string }>): Promise<void> {
  try {
    const backend = getDecryptedBackend();
    
    // Update each project's display order and parent
    for (const update of projectUpdates) {
      const updateData: UpdateProjectDecryptedRequest = {
        id: update.id,
        order: update.displayOrder,
        parent_id: update.parentId
      };
      
      await backend.projects.update(updateData);
    }
  } catch (error) {
    console.error('Failed to reorder projects:', error);
    throw error;
  }
}

// Toggle project collapse state
export async function toggleProjectCollapse(id: string, isCollapsed: boolean): Promise<ProjectDecrypted> {
  try {
    const backend = getDecryptedBackend();
    const updateData: UpdateProjectDecryptedRequest = {
      id,
      collapsed: isCollapsed
    };
    const { data: project } = await backend.projects.update(updateData);
    if (!project) {
      throw new Error('Failed to update project collapse state');
    }
    return project;
  } catch (error) {
    console.error('Failed to toggle project collapse:', error);
    throw error;
  }
}

// Bulk update project order (alias for reorderProjects)
export const bulkUpdateProjectOrder = reorderProjects;

// Update project collapsed state (alias for toggleProjectCollapse)
export const updateProjectCollapsedState = toggleProjectCollapse;