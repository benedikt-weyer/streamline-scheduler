'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Project, DEFAULT_PROJECT_NAME } from '@/utils/can-do-list/can-do-list-types';
import { Plus, Settings, Folder, FolderOpen } from 'lucide-react';
import AddProjectDialog from './add-project-dialog';
import EditProjectDialog from './edit-project-dialog';

interface ProjectSidebarProps {
  readonly projects: Project[];
  readonly selectedProjectId?: string;
  readonly onProjectSelect: (projectId?: string) => void;
  readonly onAddProject: (name: string, color: string) => Promise<boolean>;
  readonly onUpdateProject: (id: string, name: string, color: string) => Promise<boolean>;
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

  const handleAddProject = async (name: string, color: string) => {
    const success = await onAddProject(name, color);
    if (success) {
      setIsAddDialogOpen(false);
    }
    return success;
  };

  const handleEditProject = async (id: string, name: string, color: string) => {
    const success = await onUpdateProject(id, name, color);
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
        <div className="p-2 space-y-1">
          {/* Default Inbox Project */}
          <button
            onClick={() => onProjectSelect(undefined)}
            className={`w-full flex items-center justify-between p-2 text-left rounded-md transition-colors ${
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

          {/* User Projects */}
          {projects.map(project => {
            const count = itemCounts[project.id] || 0;
            const isSelected = selectedProjectId === project.id;

            return (
              <div key={project.id} className="relative group">
                <button
                  onClick={() => onProjectSelect(project.id)}
                  className={`w-full flex items-center justify-between p-2 text-left rounded-md transition-colors ${
                    isSelected
                      ? 'bg-primary text-primary-foreground'
                      : 'hover:bg-muted/50'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    {isSelected ? (
                      <FolderOpen className="h-4 w-4 flex-shrink-0" />
                    ) : (
                      <Folder className="h-4 w-4 flex-shrink-0" />
                    )}
                    <div
                      className="w-3 h-3 rounded-full flex-shrink-0"
                      style={{ backgroundColor: project.color }}
                    />
                    <span className="truncate">{project.name}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    {count > 0 && (
                      <Badge variant="secondary" className="text-xs group-hover:opacity-0 transition-opacity">
                        {count}
                      </Badge>
                    )}
                  </div>
                </button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setEditingProject(project)}
                  className={`absolute right-2 top-1/2 transform -translate-y-1/2 h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity ${
                    isSelected ? 'hover:bg-primary-foreground/20' : ''
                  }`}
                >
                  <Settings className={`h-3 w-3 ${isSelected ? 'text-primary-foreground' : ''}`} />
                  <span className="sr-only">Edit Project</span>
                </Button>
              </div>
            );
          })}
        </div>
      </div>

      <AddProjectDialog
        isOpen={isAddDialogOpen}
        onClose={() => setIsAddDialogOpen(false)}
        onSave={handleAddProject}
        isLoading={isLoading}
      />

      <EditProjectDialog
        project={editingProject}
        isOpen={editingProject !== null}
        onClose={() => setEditingProject(null)}
        onSave={handleEditProject}
        onDelete={handleDeleteProject}
        isLoading={isLoading}
      />
    </div>
  );
}
