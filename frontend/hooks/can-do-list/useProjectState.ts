import { useState, useCallback, useMemo } from 'react';
import { Project } from '@/utils/can-do-list/can-do-list-types';

export interface ProjectStateActions {
  setProjects: (projects: Project[] | ((prev: Project[]) => Project[])) => void;
  setIsLoading: (loading: boolean) => void;
}

/**
 * Hook for managing project state
 */
export const useProjectState = (): [Project[], boolean, ProjectStateActions] => {
  const [projects, setProjectsInternal] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const setProjects = useCallback((projectsOrUpdater: Project[] | ((prev: Project[]) => Project[])) => {
    setProjectsInternal(prevProjects => {
      const newProjects = typeof projectsOrUpdater === 'function' 
        ? projectsOrUpdater(prevProjects) 
        : projectsOrUpdater;
      
      // Sort projects by displayOrder within parent groups
      return newProjects.sort((a, b) => {
        // First sort by parentId to group together
        if (a.parentId !== b.parentId) {
          return (a.parentId ?? '').localeCompare(b.parentId ?? '');
        }
        // Then sort by displayOrder within the same parent
        return a.displayOrder - b.displayOrder;
      });
    });
  }, []);

  const actions: ProjectStateActions = useMemo(() => ({
    setProjects,
    setIsLoading
  }), [setProjects]);

  return [projects, isLoading, actions];
};
