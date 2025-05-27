import { useCallback } from 'react';
import { Project } from '@/utils/can-do-list/can-do-list-types';
import { ProjectStateActions } from './useProjectState';
import { useError } from '@/utils/context/ErrorContext';
import { 
  addProject, 
  updateProject, 
  deleteProject
} from '../../app/dashboard/can-do-list/project-actions';
import { 
  encryptData, 
  generateIV, 
  generateSalt, 
  deriveKeyFromPassword 
} from '@/utils/cryptography/encryption';

/**
 * Hook for basic CRUD operations on projects
 */
export const useProjectCRUD = (
  projects: Project[],
  projectActions: ProjectStateActions,
  encryptionKey: string | null
) => {
  const { setError } = useError();

  const handleAddProject = useCallback(async (name: string, color: string, parentId?: string): Promise<boolean> => {
    if (!encryptionKey) return false;
    
    try {
      const salt = generateSalt();
      const iv = generateIV();
      const derivedKey = deriveKeyFromPassword(encryptionKey, salt);
      
      const projectData = {
        name: name.trim(),
        color: color
      };
      
      const encryptedData = encryptData(projectData, derivedKey, iv);
      const newEncryptedProject = await addProject(encryptedData, iv, salt, parentId);
      
      const newProject: Project = {
        id: newEncryptedProject.id,
        name: projectData.name,
        color: projectData.color,
        parentId: parentId,
        createdAt: new Date(newEncryptedProject.created_at),
        updatedAt: new Date(newEncryptedProject.updated_at)
      };
      
      projectActions.setProjects(prevProjects => [newProject, ...prevProjects]);
      return true;
    } catch (error) {
      console.error('Error adding project:', error);
      setError('Failed to add new project');
      return false;
    }
  }, [encryptionKey, projectActions, setError]);

  const handleUpdateProject = useCallback(async (id: string, name: string, color: string, parentId?: string): Promise<boolean> => {
    if (!encryptionKey) return false;
    
    try {
      const project = projects.find(p => p.id === id);
      if (!project) return false;
      
      // For simplicity, we'll generate new salt and IV for updates
      // In a production app, you might want to reuse the existing ones
      const salt = generateSalt();
      const iv = generateIV();
      const derivedKey = deriveKeyFromPassword(encryptionKey, salt);
      
      const updatedProjectData = {
        name: name.trim(),
        color: color
      };
      
      const encryptedData = encryptData(updatedProjectData, derivedKey, iv);
      await updateProject(id, encryptedData, iv, salt, parentId);
      
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
  }, [encryptionKey, projects, projectActions, setError]);

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

  return {
    handleAddProject,
    handleUpdateProject,
    handleDeleteProject
  };
};
