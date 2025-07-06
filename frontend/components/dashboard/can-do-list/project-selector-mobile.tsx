'use client';

import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Project, Task, DEFAULT_PROJECT_NAME } from '@/utils/can-do-list/can-do-list-types';
import { ChevronDown, Folder, Star, List } from 'lucide-react';

interface ProjectSelectorMobileProps {
  readonly projects: Project[];
  readonly tasks?: Task[];
  readonly selectedProjectId?: string;
  readonly onProjectSelect: (projectId?: string) => void;
  readonly onRecommendedSelect?: () => void;
  readonly onAllTasksSelect?: () => void;
  readonly taskCounts: Record<string, number>;
  readonly isRecommendedSelected?: boolean;
  readonly isAllTasksSelected?: boolean;
}

interface FlattenedProject extends Project {
  depth: number;
}

export default function ProjectSelectorMobile({
  projects,
  tasks = [],
  selectedProjectId,
  onProjectSelect,
  onRecommendedSelect,
  onAllTasksSelect,
  taskCounts,
  isRecommendedSelected = false,
  isAllTasksSelected = false
}: ProjectSelectorMobileProps) {
  const [isOpen, setIsOpen] = useState(false);

  const handleProjectSelect = (projectId?: string) => {
    onProjectSelect(projectId);
    setIsOpen(false);
  };

  const handleRecommendedSelect = () => {
    onRecommendedSelect?.();
    setIsOpen(false);
  };

  const handleAllTasksSelect = () => {
    onAllTasksSelect?.();
    setIsOpen(false);
  };

  // Flatten nested projects for mobile display
  const flattenedProjects = useMemo(() => {
    const flattened: FlattenedProject[] = [];
    
    const addProjectsRecursively = (parentId?: string, depth: number = 0) => {
      const childProjects = projects
        .filter(p => {
          const projectParentId = p.parentId ?? undefined;
          const targetParentId = parentId ?? undefined;
          return projectParentId === targetParentId;
        })
        .sort((a, b) => a.displayOrder - b.displayOrder);
      
      childProjects.forEach(project => {
        flattened.push({ ...project, depth });
        addProjectsRecursively(project.id, depth + 1);
      });
    };
    
    addProjectsRecursively();
    return flattened;
  }, [projects]);

  // Calculate recommended tasks count
  const recommendedCount = tasks.filter(task => !task.completed && (task.importance || task.urgency || task.dueDate)).length;

  // Get current project name and task count
  const currentProject = selectedProjectId 
    ? projects.find(p => p.id === selectedProjectId)
    : null;
  
  const currentProjectName = isRecommendedSelected 
    ? 'Recommended'
    : isAllTasksSelected
      ? 'All Tasks'
      : currentProject?.name ?? DEFAULT_PROJECT_NAME;
  const currentTaskCount = isRecommendedSelected
    ? recommendedCount
    : isAllTasksSelected
      ? taskCounts['all'] || 0
      : selectedProjectId 
        ? taskCounts[selectedProjectId] || 0
        : taskCounts['inbox'] || 0;

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="flex items-center gap-2">
          <div className="flex items-center gap-2">
            {isRecommendedSelected ? (
              <Star className="w-3 h-3 text-amber-500" />
            ) : isAllTasksSelected ? (
              <List className="w-3 h-3" />
            ) : currentProject ? (
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: currentProject.color }}
              />
            ) : (
              <Folder className="w-3 h-3" />
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
        {/* Recommended Tasks */}
        {recommendedCount > 0 && onRecommendedSelect && (
          <DropdownMenuItem
            onClick={handleRecommendedSelect}
            className={`flex items-center justify-between ${
              isRecommendedSelected ? 'bg-accent' : ''
            }`}
          >
            <div className="flex items-center gap-2">
              <Star className="h-4 w-4 text-amber-500" />
              <span>Recommended</span>
            </div>
            <Badge variant="secondary" className="text-xs">
              {recommendedCount}
            </Badge>
          </DropdownMenuItem>
        )}

        {/* All Tasks */}
        {onAllTasksSelect && (
          <DropdownMenuItem
            onClick={handleAllTasksSelect}
            className={`flex items-center justify-between ${
              isAllTasksSelected ? 'bg-accent' : ''
            }`}
          >
            <div className="flex items-center gap-2">
              <List className="h-4 w-4" />
              <span>All Tasks</span>
            </div>
            <Badge variant="secondary" className="text-xs">
              {taskCounts['all'] || 0}
            </Badge>
          </DropdownMenuItem>
        )}

        {/* Inbox */}
        <DropdownMenuItem
          onClick={() => handleProjectSelect(undefined)}
          className={`flex items-center justify-between ${
            selectedProjectId === undefined && !isRecommendedSelected && !isAllTasksSelected ? 'bg-accent' : ''
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
        {flattenedProjects.length > 0 && (
          <>
            <div className="border-t my-1" />
            {flattenedProjects.map((project) => (
              <DropdownMenuItem
                key={project.id}
                onClick={() => handleProjectSelect(project.id)}
                className={`flex items-center justify-between ${
                  selectedProjectId === project.id ? 'bg-accent' : ''
                }`}
              >
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  {/* Indentation for nested projects */}
                  <div style={{ width: `${project.depth * 16}px` }} className="flex-shrink-0" />
                  
                  <div
                    className="w-3 h-3 rounded-full flex-shrink-0"
                    style={{ backgroundColor: project.color }}
                  />
                  <span className="truncate">{project.name}</span>
                </div>
                {(taskCounts[project.id] || 0) > 0 && (
                  <Badge variant="secondary" className="text-xs flex-shrink-0 ml-2">
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