import { useCallback, useMemo } from 'react';
import { Project } from '@/utils/can-do-list/can-do-list-types';
import { useProjectState } from './useProjectState';
import { useProjectLoader } from './useProjectLoader';
import { useProjectCRUD } from './useProjectCRUD';

export interface ProjectHook {
  projects: Project[];
  isLoading: boolean;
  loadProjects: (key: string) => Promise<Project[]>;
  handleAddProject: (name: string, color: string) => Promise<boolean>;
  handleUpdateProject: (id: string, name: string, color: string) => Promise<boolean>;
  handleDeleteProject: (id: string) => Promise<boolean>;
}

/**
 * Main orchestrating hook for projects
 * Coordinates all project-related operations through smaller, focused hooks
 */
export function useProjects(encryptionKey: string | null): ProjectHook {
  // Initialize project state management
  const [projects, isLoading, projectActions] = useProjectState();

  // Initialize specialized hooks
  const { loadProjects } = useProjectLoader(projectActions);
  
  const { 
    handleAddProject, 
    handleUpdateProject,
    handleDeleteProject 
  } = useProjectCRUD(projects, projectActions, encryptionKey);

  // Memoize the returned object to prevent unnecessary re-renders
  return useMemo(() => ({
    projects,
    isLoading,
    loadProjects,
    handleAddProject,
    handleUpdateProject,
    handleDeleteProject
  }), [
    projects,
    isLoading,
    loadProjects,
    handleAddProject,
    handleUpdateProject,
    handleDeleteProject
  ]);
}
