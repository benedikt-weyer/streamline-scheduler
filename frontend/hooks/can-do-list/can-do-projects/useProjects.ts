import { useMemo } from 'react';
import { ProjectDecrypted } from '@/utils/api/types';
import { useProjectState } from './useProjectState';
import { useProjectLoader } from './useProjectLoader';
import { useProjectCRUD } from './useProjectCRUD';

export interface ProjectHook {
  projects: ProjectDecrypted[];
  isLoading: boolean;
  loadProjects: () => Promise<ProjectDecrypted[]>;
  handleAddProject: (name: string, color: string, parentId?: string) => Promise<boolean>;
  handleUpdateProject: (id: string, name: string, color: string, parentId?: string) => Promise<boolean>;
  handleDeleteProject: (id: string) => Promise<boolean>;
  handleBulkReorderProjects: (updates: Array<{ id: string; parentId?: string; displayOrder: number }>) => Promise<boolean>;
  handleUpdateProjectCollapsedState: (id: string, isCollapsed: boolean) => Promise<boolean>;
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
    handleDeleteProject,
    handleBulkReorderProjects,
    handleUpdateProjectCollapsedState
  } = useProjectCRUD(projects, projectActions);

  // Memoize the returned object to prevent unnecessary re-renders
  return useMemo(() => ({
    projects,
    isLoading,
    loadProjects,
    handleAddProject,
    handleUpdateProject,
    handleDeleteProject,
    handleBulkReorderProjects,
    handleUpdateProjectCollapsedState
  }), [
    projects,
    isLoading,
    loadProjects,
    handleAddProject,
    handleUpdateProject,
    handleDeleteProject,
    handleBulkReorderProjects,
    handleUpdateProjectCollapsedState
  ]);
}
