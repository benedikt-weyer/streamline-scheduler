import { useCallback } from 'react';
import { Project } from '@/utils/can-do-list/can-do-list-types';
import { ProjectStateActions } from './useProjectState';
import { useError } from '@/utils/context/ErrorContext';
import { 
  addProject, 
  updateProject, 
  deleteProject,
  bulkUpdateProjectOrder,
  updateProjectCollapsedState
} from '../../../app/dashboard/can-do-list/project-api';
import { getCurrentUserId } from '@/utils/auth/current-user';
import { CreateProjectDecryptedRequest, UpdateProjectDecryptedRequest } from '@/utils/api/types';

/**
 * Hook for basic CRUD operations on projects
 */
export const useProjectCRUD = (
  projects: Project[],
  projectActions: ProjectStateActions
) => {
  const { setError } = useError();

  const handleAddProject = useCallback(async (name: string, color: string, parentId?: string): Promise<boolean> => {
    try {
      const userId = getCurrentUserId();
      if (!userId) {
        setError("User not authenticated");
        return false;
      }
      
      const projectData: CreateProjectDecryptedRequest = {
        name: name.trim(),
        color: color,
        parent_id: parentId,
        order: 0,
        collapsed: false
      };
      
      const newProject = await addProject(projectData);
      
      // Convert to local Project type
      const localProject: Project = {
        id: newProject.id,
        name: newProject.name,
        color: newProject.color || '#000000',
        parentId: newProject.parent_id,
        order: newProject.order ?? 0,
        isCollapsed: newProject.collapsed ?? false,
        createdAt: new Date(newProject.created_at),
        updatedAt: new Date(newProject.updated_at),
        user_id: newProject.user_id
      };
      
      projectActions.setProjects(prevProjects => [localProject, ...prevProjects]);
      return true;
    } catch (error) {
      console.error('Error adding project:', error);
      setError('Failed to add new project');
      return false;
    }
  }, [projectActions, setError]);

  const handleUpdateProject = useCallback(async (id: string, name: string, color: string, parentId?: string): Promise<boolean> => {
    try {
      const project = projects.find(p => p.id === id);
      if (!project) return false;
      
      const updateData: Partial<UpdateProjectDecryptedRequest> = {
        name: name.trim(),
        color: color,
        parent_id: parentId
      };
      
      await updateProject(id, updateData);
      
      projectActions.setProjects(prevProjects =>
        prevProjects.map(project =>
          project.id === id
            ? { ...project, name: name.trim(), color: color, parentId: parentId }
            : project
        )
      );
      return true;
    } catch (error) {
      console.error('Error updating project:', error);
      setError('Failed to update project');
      return false;
    }
  }, [projects, projectActions, setError]);

  const handleDeleteProject = useCallback(async (id: string): Promise<boolean> => {
    try {
      await deleteProject(id);
      projectActions.setProjects(prevProjects => prevProjects.filter(project => project.id !== id));
      return true;
    } catch (error) {
      console.error('Error deleting project:', error);
      setError('Failed to delete project');
      return false;
    }
  }, [projectActions, setError]);

  const handleBulkReorderProjects = useCallback(async (
    updates: Array<{ id: string; parentId?: string; displayOrder: number }>
  ): Promise<boolean> => {
    try {
      await bulkUpdateProjectOrder(updates);
      
      // Create update map for faster lookup
      const updateMap = new Map(updates.map(u => [u.id, u]));
      
      // Update local state
      projectActions.setProjects(prevProjects => {
        const updatedProjects = prevProjects.map(project => {
          const update = updateMap.get(project.id);
          return update ? {
            ...project,
            parentId: update.parentId,
            order: update.displayOrder
          } : project;
        });
        
        // Sort by order within each parent group
        return updatedProjects.sort((a, b) => {
          if (a.parentId !== b.parentId) {
            return (a.parentId ?? '').localeCompare(b.parentId ?? '');
          }
          return a.order - b.order;
        });
      });
      
      return true;
    } catch (error) {
      console.error('Error reordering projects:', error);
      setError('Failed to reorder projects');
      return false;
    }
  }, [projectActions, setError]);

  const handleUpdateProjectCollapsedState = useCallback(async (id: string, isCollapsed: boolean): Promise<boolean> => {
    try {
      await updateProjectCollapsedState(id, isCollapsed);
      
      // Update local state
      projectActions.setProjects(prevProjects =>
        prevProjects.map(project =>
          project.id === id
            ? { ...project, isCollapsed }
            : project
        )
      );
      return true;
    } catch (error) {
      console.error('Error updating project collapsed state:', error);
      setError('Failed to update project collapsed state');
      return false;
    }
  }, [projectActions, setError]);

  return {
    handleAddProject,
    handleUpdateProject,
    handleDeleteProject,
    handleBulkReorderProjects,
    handleUpdateProjectCollapsedState
  };
};
