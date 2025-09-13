import { useCallback } from 'react';
import { ProjectDecrypted } from '@/utils/api/types';
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

  const loadProjects = useCallback(async (): Promise<ProjectDecrypted[]> => {
    try {
      projectActions.setIsLoading(true);
      console.log('[ProjectLoader] Starting to load projects...');
      const decryptedProjects = await fetchProjects();
      console.log('[ProjectLoader] Fetched projects:', decryptedProjects.length);
      
      console.log('[ProjectLoader] Processed projects:', decryptedProjects.length);
      // Debug: Log all projects with their parent relationships
      decryptedProjects.forEach(p => {
        console.log(`[ProjectLoader] Project: "${p.name}" (ID: ${p.id}, ParentID: ${p.parent_id})`);
      });
      
      projectActions.setProjects(decryptedProjects);
      projectActions.setIsLoading(false);
      return decryptedProjects;
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
