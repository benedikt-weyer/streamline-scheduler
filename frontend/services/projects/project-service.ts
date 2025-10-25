'use client';

import { DecryptedBackendInterface } from '@/utils/api/decrypted-backend-interface';
import { ProjectDecrypted, CreateProjectDecryptedRequest, UpdateProjectDecryptedRequest } from '@/utils/api/types';

/**
 * Project Service - handles all project-related operations using the decrypted backend
 */
export class ProjectService {
  constructor(private backend: DecryptedBackendInterface) {}

  /**
   * Get all projects for the current user
   */
  async getProjects(): Promise<ProjectDecrypted[]> {
    try {
      const { data: projects } = await this.backend.projects.getAll({ all: true });
      return projects || [];
    } catch (error) {
      console.error('Failed to fetch projects:', error);
      throw new Error('Failed to load projects');
    }
  }

  /**
   * Get a single project by ID
   */
  async getProjectById(id: string): Promise<ProjectDecrypted> {
    try {
      const { data: project } = await this.backend.projects.getById(id);
      if (!project) {
        throw new Error('Project not found');
      }
      return project;
    } catch (error) {
      console.error(`Failed to fetch project ${id}:`, error);
      throw new Error('Failed to load project');
    }
  }

  /**
   * Create a new project
   */
  async createProject(projectData: CreateProjectDecryptedRequest): Promise<ProjectDecrypted> {
    try {
      const { data: project } = await this.backend.projects.create(projectData);
      if (!project) {
        throw new Error('Failed to create project');
      }
      return project;
    } catch (error) {
      console.error('Failed to create project:', error);
      throw new Error('Failed to create project');
    }
  }

  /**
   * Update an existing project
   */
  async updateProject(id: string, updateData: Partial<UpdateProjectDecryptedRequest>): Promise<ProjectDecrypted> {
    try {
      const requestData: UpdateProjectDecryptedRequest = {
        id,
        ...updateData
      };
      const { data: project } = await this.backend.projects.update(requestData);
      if (!project) {
        throw new Error('Failed to update project');
      }
      return project;
    } catch (error) {
      console.error('Failed to update project:', error);
      throw new Error('Failed to update project');
    }
  }

  /**
   * Delete a project
   */
  async deleteProject(id: string): Promise<void> {
    try {
      await this.backend.projects.delete(id);
    } catch (error) {
      console.error(`Failed to delete project ${id}:`, error);
      throw new Error('Failed to delete project');
    }
  }

  /**
   * Reorder projects by updating display order and parent relationships
   */
  async reorderProjects(projectUpdates: Array<{ id: string; displayOrder: number; parentId?: string }>): Promise<void> {
    try {
      // Update each project's display order and parent
      for (const update of projectUpdates) {
        const updateData: UpdateProjectDecryptedRequest = {
          id: update.id,
          order: update.displayOrder,
          parent_id: update.parentId
        };
        
        await this.backend.projects.update(updateData);
      }
    } catch (error) {
      console.error('Failed to reorder projects:', error);
      throw new Error('Failed to reorder projects');
    }
  }

  /**
   * Toggle project collapse state
   */
  async toggleProjectCollapse(id: string, isCollapsed: boolean): Promise<ProjectDecrypted> {
    try {
      const updateData: UpdateProjectDecryptedRequest = {
        id,
        collapsed: isCollapsed
      };
      const { data: project } = await this.backend.projects.update(updateData);
      if (!project) {
        throw new Error('Failed to update project collapse state');
      }
      return project;
    } catch (error) {
      console.error('Failed to toggle project collapse:', error);
      throw new Error('Failed to update project state');
    }
  }

  /**
   * Get project hierarchy (parent-child relationships)
   */
  async getProjectHierarchy(): Promise<ProjectDecrypted[]> {
    try {
      const projects = await this.getProjects();
      // Sort by display order and organize by hierarchy
      return projects.sort((a, b) => (a.order || 0) - (b.order || 0));
    } catch (error) {
      console.error('Failed to get project hierarchy:', error);
      throw new Error('Failed to load project hierarchy');
    }
  }

  /**
   * Get root projects (projects without parents)
   */
  async getRootProjects(): Promise<ProjectDecrypted[]> {
    try {
      const projects = await this.getProjects();
      return projects.filter(project => !project.parent_id);
    } catch (error) {
      console.error('Failed to get root projects:', error);
      throw new Error('Failed to load root projects');
    }
  }

  /**
   * Get child projects for a given parent project
   */
  async getChildProjects(parentId: string): Promise<ProjectDecrypted[]> {
    try {
      const projects = await this.getProjects();
      return projects.filter(project => project.parent_id === parentId);
    } catch (error) {
      console.error('Failed to get child projects:', error);
      throw new Error('Failed to load child projects');
    }
  }

  /**
   * Get the default project (if any)
   */
  async getDefaultProject(): Promise<ProjectDecrypted | null> {
    try {
      const projects = await this.getProjects();
      return projects.find(project => project.is_default) || null;
    } catch (error) {
      console.error('Failed to get default project:', error);
      throw new Error('Failed to load default project');
    }
  }

  /**
   * Set a project as default
   */
  async setDefaultProject(projectId: string): Promise<ProjectDecrypted> {
    try {
      // First, unset all other projects as default
      const allProjects = await this.getProjects();
      for (const project of allProjects) {
        if (project.id !== projectId && project.is_default) {
          await this.updateProject(project.id, { is_default: false });
        }
      }
      
      // Then set the selected project as default
      return await this.updateProject(projectId, { is_default: true });
    } catch (error) {
      console.error(`Failed to set default project ${projectId}:`, error);
      throw new Error('Failed to set default project');
    }
  }

  /**
   * Create a default project if none exists
   */
  async ensureDefaultProject(): Promise<ProjectDecrypted> {
    try {
      const defaultProject = await this.getDefaultProject();
      
      if (defaultProject) {
        return defaultProject;
      }
      
      // Create a default project
      return await this.createProject({
        name: 'General',
        description: 'Default project for tasks',
        color: '#3b82f6', // Blue color
        is_default: true,
        order: 0
      });
    } catch (error) {
      console.error('Failed to ensure default project exists:', error);
      throw new Error('Failed to create default project');
    }
  }

  /**
   * Get project statistics
   */
  async getProjectStats(): Promise<{
    totalProjects: number;
    rootProjects: number;
    defaultProjectId?: string;
  }> {
    try {
      const projects = await this.getProjects();
      
      return {
        totalProjects: projects.length,
        rootProjects: projects.filter(project => !project.parent_id).length,
        defaultProjectId: projects.find(project => project.is_default)?.id,
      };
    } catch (error) {
      console.error('Failed to get project stats:', error);
      throw new Error('Failed to load project statistics');
    }
  }

  /**
   * Search projects by name or description
   */
  async searchProjects(query: string, projects?: ProjectDecrypted[]): Promise<ProjectDecrypted[]> {
    try {
      const allProjects = projects || await this.getProjects();
      const lowercaseQuery = query.toLowerCase();
      
      return allProjects.filter(project => 
        project.name.toLowerCase().includes(lowercaseQuery) ||
        (project.description && project.description.toLowerCase().includes(lowercaseQuery))
      );
    } catch (error) {
      console.error('Failed to search projects:', error);
      throw new Error('Failed to search projects');
    }
  }

  /**
   * Validate project operation (e.g., before deletion)
   */
  async validateProjectOperation(operation: 'delete' | 'move', projectId: string): Promise<{ 
    isValid: boolean; 
    message?: string; 
    childProjects?: ProjectDecrypted[];
  }> {
    try {
      const allProjects = await this.getProjects();
      const project = allProjects.find(proj => proj.id === projectId);
      
      if (!project) {
        return { isValid: false, message: 'Project not found' };
      }
      
      const childProjects = allProjects.filter(proj => proj.parent_id === projectId);
      
      if (operation === 'delete' && childProjects.length > 0) {
        return { 
          isValid: false, 
          message: 'Cannot delete project with child projects',
          childProjects 
        };
      }
      
      return { isValid: true, childProjects };
    } catch (error) {
      console.error('Failed to validate project operation:', error);
      return { isValid: false, message: 'Failed to validate operation' };
    }
  }

  /**
   * Delete project with child projects (moves children to parent or root)
   */
  async deleteProjectWithChildren(
    projectId: string,
    moveChildrenToParent: boolean = true
  ): Promise<void> {
    try {
      const allProjects = await this.getProjects();
      const projectToDelete = allProjects.find(proj => proj.id === projectId);
      
      if (!projectToDelete) {
        throw new Error('Project not found');
      }

      const childProjects = allProjects.filter(proj => proj.parent_id === projectId);
      
      // Move child projects
      for (const childProject of childProjects) {
        const newParentId = moveChildrenToParent ? projectToDelete.parent_id : undefined;
        await this.updateProject(childProject.id, { parent_id: newParentId });
      }
      
      // Delete the project
      await this.deleteProject(projectId);
    } catch (error) {
      console.error(`Failed to delete project with children ${projectId}:`, error);
      throw new Error('Failed to delete project and reorganize children');
    }
  }

  /**
   * Bulk update project order
   */
  async bulkUpdateProjectOrder(projectUpdates: Array<{ id: string; displayOrder: number; parentId?: string }>): Promise<void> {
    return this.reorderProjects(projectUpdates);
  }
}
