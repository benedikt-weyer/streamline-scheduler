'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Project, DEFAULT_PROJECT_NAME } from '@/utils/can-do-list/can-do-list-types';
import { ChevronDown, Folder } from 'lucide-react';

interface ProjectSelectorMobileProps {
  readonly projects: Project[];
  readonly selectedProjectId?: string;
  readonly onProjectSelect: (projectId?: string) => void;
  readonly taskCounts: Record<string, number>;
}

export default function ProjectSelectorMobile({
  projects,
  selectedProjectId,
  onProjectSelect,
  taskCounts
}: ProjectSelectorMobileProps) {
  const [isOpen, setIsOpen] = useState(false);

  const handleProjectSelect = (projectId?: string) => {
    onProjectSelect(projectId);
    setIsOpen(false);
  };

  // Get current project name and task count
  const currentProject = selectedProjectId 
    ? projects.find(p => p.id === selectedProjectId)
    : null;
  
  const currentProjectName = currentProject?.name ?? DEFAULT_PROJECT_NAME;
  const currentTaskCount = selectedProjectId 
    ? taskCounts[selectedProjectId] || 0
    : taskCounts['inbox'] || 0;

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="flex items-center gap-2">
          <div className="flex items-center gap-2">
            {currentProject && (
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: currentProject.color }}
              />
            )}
            <span className="truncate max-w-24">{currentProjectName}</span>
            {currentTaskCount > 0 && (
              <Badge variant="secondary" className="text-xs">
                {currentTaskCount}
              </Badge>
            )}
          </div>
          <ChevronDown className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      
      <DropdownMenuContent align="end" className="w-64">
        {/* Inbox */}
        <DropdownMenuItem
          onClick={() => handleProjectSelect(undefined)}
          className={`flex items-center justify-between ${
            selectedProjectId === undefined ? 'bg-accent' : ''
          }`}
        >
          <div className="flex items-center gap-2">
            <Folder className="h-4 w-4" />
            <span>{DEFAULT_PROJECT_NAME}</span>
          </div>
          {(taskCounts['inbox'] || 0) > 0 && (
            <Badge variant="secondary" className="text-xs">
              {taskCounts['inbox']}
            </Badge>
          )}
        </DropdownMenuItem>

        {/* User Projects */}
        {projects.length > 0 && (
          <>
            <div className="border-t my-1" />
            {projects
              .filter(p => !p.parentId) // Show only top-level projects for simplicity on mobile
              .sort((a, b) => a.displayOrder - b.displayOrder)
              .map((project) => (
                <DropdownMenuItem
                  key={project.id}
                  onClick={() => handleProjectSelect(project.id)}
                  className={`flex items-center justify-between ${
                    selectedProjectId === project.id ? 'bg-accent' : ''
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: project.color }}
                    />
                    <span className="truncate">{project.name}</span>
                  </div>
                  {(taskCounts[project.id] || 0) > 0 && (
                    <Badge variant="secondary" className="text-xs">
                      {taskCounts[project.id]}
                    </Badge>
                  )}
                </DropdownMenuItem>
              ))}
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
} 