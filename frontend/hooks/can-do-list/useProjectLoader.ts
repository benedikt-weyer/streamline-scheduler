import { useCallback } from 'react';
import { Project } from '@/utils/can-do-list/can-do-list-types';
import { ProjectStateActions } from './useProjectState';
import { useError } from '@/utils/context/ErrorContext';
import { fetchProjects } from '../../app/dashboard/can-do-list/project-actions';
import { 
  decryptData, 
  deriveKeyFromPassword 
} from '@/utils/cryptography/encryption';

/**
 * Hook for loading and decrypting projects
 */
export const useProjectLoader = (
  projectActions: ProjectStateActions
) => {
  const { setError } = useError();

  const loadProjects = useCallback(async (key: string): Promise<Project[]> => {
    try {
      projectActions.setIsLoading(true);
      console.log('[ProjectLoader] Starting to load projects...');
      const encryptedProjects = await fetchProjects();
      console.log('[ProjectLoader] Fetched encrypted projects:', encryptedProjects.length);
      
      const decryptedProjects = encryptedProjects
        .map(project => {
          try {
            console.log('[ProjectLoader] Decrypting project:', project.id);
            const decryptionKey = deriveKeyFromPassword(key, project.salt);
            const decryptedData = decryptData(project.encrypted_data, decryptionKey, project.iv);
            
            if (!decryptedData) {
              console.warn('[ProjectLoader] Failed to decrypt project data for:', project.id);
              return null;
            }
            
            const decryptedProject = {
              id: project.id,
              name: decryptedData.name,
              color: decryptedData.color,
              parentId: project.parent_id,
              displayOrder: project.display_order ?? 0,
              isCollapsed: project.is_collapsed ?? false,
              createdAt: new Date(project.created_at),
              updatedAt: project.updated_at ? new Date(project.updated_at) : undefined
            };
            
            console.log('[ProjectLoader] Successfully decrypted project:', decryptedProject.name);
            return decryptedProject;
          } catch (error) {
            console.error('[ProjectLoader] Failed to decrypt project:', project.id, error);
            return null;
          }
        })
        .filter((project): project is NonNullable<typeof project> => project !== null);
      
      console.log('[ProjectLoader] Decrypted projects:', decryptedProjects.length);
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
