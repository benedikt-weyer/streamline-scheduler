import { Project } from './can-do-list-types';

/**
 * Utility functions for working with hierarchical projects
 */

export interface ProjectNode extends Project {
  children: ProjectNode[];
  level: number;
}

/**
 * Build a hierarchical tree structure from flat project list
 */
export function buildProjectTree(projects: Project[]): ProjectNode[] {
  if (!projects || !Array.isArray(projects)) {
    return [];
  }
  
  const projectMap = new Map<string, ProjectNode>();
  const rootProjects: ProjectNode[] = [];

  // First pass: create all project nodes
  projects.forEach(project => {
    projectMap.set(project.id, {
      ...project,
      children: [],
      level: 0
    });
  });

  // Second pass: build the tree structure
  projects.forEach(project => {
    const projectNode = projectMap.get(project.id)!;
    
    if (project.parentId) {
      const parent = projectMap.get(project.parentId);
      if (parent) {
        projectNode.level = parent.level + 1;
        parent.children.push(projectNode);
      } else {
        // Parent not found, treat as root
        rootProjects.push(projectNode);
      }
    } else {
      // Root project
      rootProjects.push(projectNode);
    }
  });

  // Sort children recursively
  const sortProjects = (nodes: ProjectNode[]) => {
    nodes.sort((a, b) => a.name.localeCompare(b.name));
    nodes.forEach(node => sortProjects(node.children));
  };

  sortProjects(rootProjects);
  return rootProjects;
}

/**
 * Flatten a project tree back to a list with level information
 */
export function flattenProjectTree(tree: ProjectNode[]): ProjectNode[] {
  const result: ProjectNode[] = [];
  
  const flatten = (nodes: ProjectNode[]) => {
    nodes.forEach(node => {
      result.push(node);
      flatten(node.children);
    });
  };
  
  flatten(tree);
  return result;
}

/**
 * Get all parent projects for a given project
 */
export function getProjectPath(projectId: string, projects: Project[]): Project[] {
  if (!projects || !Array.isArray(projects)) {
    return [];
  }
  
  const projectMap = new Map<string, Project>();
  projects.forEach(p => projectMap.set(p.id, p));
  
  const path: Project[] = [];
  let currentProject = projectMap.get(projectId);
  
  while (currentProject) {
    path.unshift(currentProject);
    currentProject = currentProject.parentId ? projectMap.get(currentProject.parentId) : undefined;
  }
  
  return path;
}

/**
 * Get all descendant projects for a given project
 */
export function getProjectDescendants(projectId: string, projects: Project[]): Project[] {
  if (!projects || !Array.isArray(projects)) {
    return [];
  }
  
  const descendants: Project[] = [];
  const children = projects.filter(p => p.parentId === projectId);
  
  children.forEach(child => {
    descendants.push(child);
    descendants.push(...getProjectDescendants(child.id, projects));
  });
  
  return descendants;
}

/**
 * Check if a project can be moved to a new parent (prevents circular references)
 */
export function canMoveProject(projectId: string, newParentId: string | undefined, projects: Project[]): boolean {
  if (!projects || !Array.isArray(projects)) {
    return true;
  }
  if (!newParentId) return true; // Can always move to root
  if (projectId === newParentId) return false; // Can't be parent of self
  
  // Check if newParentId is a descendant of projectId
  const descendants = getProjectDescendants(projectId, projects);
  return !descendants.some(d => d.id === newParentId);
}

/**
 * Get available parent options for a project (excludes self and descendants)
 * Overloaded to handle both new projects and existing projects
 */
export function getAvailableParents(projects: Project[]): Project[];
export function getAvailableParents(projectId: string, projects: Project[]): Project[];
export function getAvailableParents(projectIdOrProjects: string | Project[], projects?: Project[]): Project[] {
  // Handle overload: if first param is array, it's for new projects
  if (Array.isArray(projectIdOrProjects)) {
    return projectIdOrProjects || [];
  }
  
  // Handle existing project case
  const projectId = projectIdOrProjects;
  const projectsList = projects || [];
  
  if (!projectsList || !Array.isArray(projectsList)) {
    return [];
  }
  
  const descendants = getProjectDescendants(projectId, projectsList);
  const excludedIds = new Set([projectId, ...descendants.map(d => d.id)]);
  
  return projectsList.filter(p => !excludedIds.has(p.id));
}
