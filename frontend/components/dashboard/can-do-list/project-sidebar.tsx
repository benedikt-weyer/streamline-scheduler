'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Project, DEFAULT_PROJECT_NAME } from '@/utils/can-do-list/can-do-list-types';
import { buildProjectTree, flattenProjectTree, ProjectNode } from '@/utils/can-do-list/project-hierarchy';
import { Plus, Settings, Folder, FolderOpen, ChevronRight, ChevronDown } from 'lucide-react';
import AddProjectDialog from './add-project-dialog';
import EditProjectDialog from './edit-project-dialog';

interface ProjectSidebarProps {
  readonly projects: Project[];
  readonly selectedProjectId?: string;
  readonly onProjectSelect: (projectId?: string) => void;
  readonly onAddProject: (name: string, color: string, parentId?: string) => Promise<boolean>;
  readonly onUpdateProject: (id: string, name: string, color: string, parentId?: string) => Promise<boolean>;
  readonly onDeleteProject: (id: string) => Promise<boolean>;
  readonly isLoading?: boolean;
  readonly itemCounts?: Record<string, number>;
}

export default function ProjectSidebar({
  projects,
  selectedProjectId,
  onProjectSelect,
  onAddProject,
  onUpdateProject,
  onDeleteProject,
  isLoading = false,
  itemCounts = {}
}: ProjectSidebarProps) {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set());
  const [selectedParentForAdd, setSelectedParentForAdd] = useState<string | undefined>(undefined);

  const handleAddProject = async (name: string, color: string, parentId?: string) => {
    const success = await onAddProject(name, color, parentId || selectedParentForAdd);
    if (success) {
      setIsAddDialogOpen(false);
      setSelectedParentForAdd(undefined);
    }
    return success;
  };

  const handleEditProject = async (id: string, name: string, color: string, parentId?: string) => {
    const success = await onUpdateProject(id, name, color, parentId);
    if (success) {
      setEditingProject(null);
    }
    return success;
  };

  const handleDeleteProject = async (id: string) => {
    const success = await onDeleteProject(id);
    if (success) {
      setEditingProject(null);
      // If we're deleting the currently selected project, switch to inbox
      if (selectedProjectId === id) {
        onProjectSelect(undefined);
      }
    }
    return success;
  };

  const toggleProjectExpanded = (projectId: string) => {
    setExpandedProjects(prev => {
      const newSet = new Set(prev);
      if (newSet.has(projectId)) {
        newSet.delete(projectId);
      } else {
        newSet.add(projectId);
      }
      return newSet;
    });
  };

  const openAddDialogForParent = (parentId?: string) => {
    setSelectedParentForAdd(parentId);
    setIsAddDialogOpen(true);
  };

  // Build project tree and flatten it for display
  const projectTree = buildProjectTree(projects);
  const flattenedProjects = flattenProjectTree(projectTree);

  // Render a single project item
  const renderProjectItem = (projectNode: ProjectNode) => {
    const count = itemCounts[projectNode.id] || 0;
    const isSelected = selectedProjectId === projectNode.id;
    const hasChildren = projectNode.children.length > 0;
    const isExpanded = expandedProjects.has(projectNode.id);
    const indentLevel = projectNode.level;

    return (
      <div key={projectNode.id} className="relative group">
        <div 
          className="relative flex items-center"
          style={{ paddingLeft: indentLevel > 0 ? `${indentLevel * 16 + 8}px` : '0px' }}
        >
          {/* Expand/Collapse button for projects with children */}
          {hasChildren && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => toggleProjectExpanded(projectNode.id)}
              className="h-6 w-6 p-0 mr-1 hover:bg-muted/50"
            >
              {isExpanded ? (
                <ChevronDown className="h-3 w-3" />
              ) : (
                <ChevronRight className="h-3 w-3" />
              )}
            </Button>
          )}
          
          {/* Project button */}
          <button
            onClick={() => onProjectSelect(projectNode.id)}
            className={`flex-1 flex items-center justify-between p-2 text-left rounded-md transition-colors ${
              isSelected
                ? 'bg-primary text-primary-foreground'
                : 'hover:bg-muted/50'
            } ${!hasChildren && indentLevel > 0 ? 'ml-7' : ''}`}
          >
            <div className="flex items-center gap-2 min-w-0">
              {isSelected ? (
                <FolderOpen className="h-4 w-4 flex-shrink-0" />
              ) : (
                <Folder className="h-4 w-4 flex-shrink-0" />
              )}
              <div
                className="w-3 h-3 rounded-full flex-shrink-0"
                style={{ backgroundColor: projectNode.color }}
              />
              <span className="truncate">{projectNode.name}</span>
            </div>
            <div className="flex items-center gap-1">
              {count > 0 && (
                <Badge variant="secondary" className="text-xs group-hover:opacity-0 transition-opacity">
                  {count}
                </Badge>
              )}
            </div>
          </button>
          
          {/* Actions dropdown */}
          <div className="absolute right-2 top-1/2 transform -translate-y-1/2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => openAddDialogForParent(projectNode.id)}
              className={`h-6 w-6 p-0 ${isSelected ? 'hover:bg-primary-foreground/20' : ''}`}
              title="Add subproject"
            >
              <Plus className={`h-3 w-3 ${isSelected ? 'text-primary-foreground' : ''}`} />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setEditingProject(projectNode)}
              className={`h-6 w-6 p-0 ${isSelected ? 'hover:bg-primary-foreground/20' : ''}`}
              title="Edit project"
            >
              <Settings className={`h-3 w-3 ${isSelected ? 'text-primary-foreground' : ''}`} />
            </Button>
          </div>
        </div>
        
        {/* Render children if expanded */}
        {hasChildren && isExpanded && (
          <div className="space-y-1">
            {projectNode.children.map(renderProjectItem)}
          </div>
        )}
      </div>
    );
  };

  // Calculate inbox count (items without project)
  const inboxCount = itemCounts['inbox'] || 0;

  return (
    <div className="w-72 bg-muted/30 border-r border-border h-full flex flex-col">
      <div className="p-4 border-b border-border">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
            Projects
          </h2>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsAddDialogOpen(true)}
            className="h-6 w-6 p-0"
          >
            <Plus className="h-4 w-4" />
            <span className="sr-only">Add Project</span>
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="px-2 space-y-1">
          {/* Default Inbox Project */}
          <button
            onClick={() => onProjectSelect(undefined)}
            className={`w-full flex items-center justify-between p-2 text-left rounded-md transition-colors my-3 ${
              selectedProjectId === undefined
                ? 'bg-primary text-primary-foreground'
                : 'hover:bg-muted/50'
            }`}
          >
            <div className="flex items-center gap-2 min-w-0">
              {selectedProjectId === undefined ? (
                <FolderOpen className="h-4 w-4 flex-shrink-0" />
              ) : (
                <Folder className="h-4 w-4 flex-shrink-0" />
              )}
              <span className="truncate font-medium">{DEFAULT_PROJECT_NAME}</span>
            </div>
            {inboxCount > 0 && (
              <Badge variant="secondary" className="text-xs">
                {inboxCount}
              </Badge>
            )}
          </button>

          {/* Divider between inbox and user projects */}
          {projects.length > 0 && (
            <div className="border-t border-foreground/10 mx-4 h-4" />
          )}

          {/* Hierarchical User Projects */}
          <div className="space-y-1">
            {projectTree.map(renderProjectItem)}
          </div>
        </div>
      </div>

      <AddProjectDialog
        isOpen={isAddDialogOpen}
        onClose={() => {
          setIsAddDialogOpen(false);
          setSelectedParentForAdd(undefined);
        }}
        onSave={handleAddProject}
        isLoading={isLoading}
        projects={projects}
        preselectedParentId={selectedParentForAdd}
      />

      <EditProjectDialog
        project={editingProject}
        isOpen={editingProject !== null}
        onClose={() => setEditingProject(null)}
        onSave={handleEditProject}
        onDelete={handleDeleteProject}
        isLoading={isLoading}
        projects={projects}
      />
    </div>
  );
}
