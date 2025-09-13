import { useState, useCallback, useMemo } from 'react';
import { ProjectDecrypted } from '@/utils/api/types';

export interface ProjectStateActions {
  setProjects: (projects: ProjectDecrypted[] | ((prev: ProjectDecrypted[]) => ProjectDecrypted[])) => void;
  setIsLoading: (loading: boolean) => void;
}

/**
 * Hook for managing project state
 */
export const useProjectState = (): [ProjectDecrypted[], boolean, ProjectStateActions] => {
  const [projects, setProjectsInternal] = useState<ProjectDecrypted[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const setProjects = useCallback((projectsOrUpdater: ProjectDecrypted[] | ((prev: ProjectDecrypted[]) => ProjectDecrypted[])) => {
    setProjectsInternal(prevProjects => {
      const newProjects = typeof projectsOrUpdater === 'function' 
        ? projectsOrUpdater(prevProjects) 
        : projectsOrUpdater;
      
      // Sort projects by display_order within parent groups
      return newProjects.sort((a, b) => {
        // First sort by parent_id to group together
        if (a.parent_id !== b.parent_id) {
          return (a.parent_id ?? '').localeCompare(b.parent_id ?? '');
        }
        // Then sort by display_order within the same parent
        return a.order - b.order;
      });
    });
  }, []);

  const actions: ProjectStateActions = useMemo(() => ({
    setProjects,
    setIsLoading
  }), [setProjects]);

  return [projects, isLoading, actions];
};
