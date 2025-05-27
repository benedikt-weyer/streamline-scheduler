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
      const encryptedProjects = await fetchProjects();
      
      const decryptedProjects = encryptedProjects
        .map(project => {
          try {
            const decryptionKey = deriveKeyFromPassword(key, project.salt);
            const decryptedData = decryptData(project.encrypted_data, decryptionKey, project.iv);
            
            if (!decryptedData) return null;
            
            return {
              id: project.id,
              name: decryptedData.name,
              color: decryptedData.color,
              createdAt: new Date(project.created_at),
              updatedAt: project.updated_at ? new Date(project.updated_at) : undefined
            };
          } catch (error) {
            console.error('Failed to decrypt project:', error);
            return null;
          }
        })
        .filter((project): project is NonNullable<typeof project> => project !== null);
      
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
