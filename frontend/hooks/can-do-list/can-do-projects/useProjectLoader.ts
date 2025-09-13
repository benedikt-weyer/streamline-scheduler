import { useCallback } from 'react';
import { Project } from '@/utils/can-do-list/can-do-list-types';
import { ProjectStateActions } from './useProjectState';
import { useError } from '@/utils/context/ErrorContext';
import { fetchProjects } from '../../../app/dashboard/can-do-list/project-api';

/**
 * Hook for loading projects
 */
export const useProjectLoader = (
  projectActions: ProjectStateActions
) => {
  const { setError } = useError();

  const loadProjects = useCallback(async (): Promise<Project[]> => {
    try {
      projectActions.setIsLoading(true);
      console.log('[ProjectLoader] Starting to load projects...');
      const decryptedProjects = await fetchProjects();
      console.log('[ProjectLoader] Fetched projects:', decryptedProjects.length);
      
      // Convert from ProjectDecrypted to Project type
      const projects: Project[] = decryptedProjects.map(project => ({
        id: project.id,
        name: project.name,
        description: project.description,
        color: project.color || '#000000',
        user_id: project.user_id,
        order: project.order ?? 0,
        parentId: project.parent_id,
        isCollapsed: project.collapsed ?? false,
        createdAt: new Date(project.created_at),
        updatedAt: project.updated_at ? new Date(project.updated_at) : undefined
      }));
      
      console.log('[ProjectLoader] Processed projects:', projects.length);
      // Debug: Log all projects with their parent relationships
      projects.forEach(p => {
        console.log(`[ProjectLoader] Project: "${p.name}" (ID: ${p.id}, ParentID: ${p.parentId})`);
      });
      projectActions.setProjects(projects);
      projectActions.setIsLoading(false);
      return projects;
    } catch (error) {
      console.error('Error loading projects:', error);
      setError('Failed to load projects');
      projectActions.setIsLoading(false);
      return [];
    }
  }, [projectActions, setError]);

  return {
    loadProjects
  };
};
