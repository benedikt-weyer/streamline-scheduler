'use client';

import React, { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ProjectDecrypted, CanDoItemDecrypted } from '@/utils/api/types';
import { DEFAULT_PROJECT_NAME } from '@/utils/can-do-list/can-do-list-types';
import { Plus, Folder, FolderOpen, Star, List, Sun } from 'lucide-react';
import AddProjectDialog from '../add-project-dialog';
import EditProjectDialog from '../edit-project-dialog';
import { SortableTree, TreeItems } from 'dnd-kit-sortable-tree';
import ProjectTreeItem from './project-tree-item';

interface ProjectSidebarProps {
  readonly projects: ProjectDecrypted[];
  readonly tasks?: CanDoItemDecrypted[];
  readonly selectedProjectId?: string;
  readonly onProjectSelect: (projectId?: string) => void;
  readonly onRecommendedSelect: () => void;
  readonly onAllTasksSelect: () => void;
  readonly onMyDaySelect: () => void;
  readonly onAddProject: (name: string, color: string, parentId?: string) => Promise<boolean>;
  readonly onUpdateProject: (id: string, name: string, color: string, parentId?: string) => Promise<boolean>;
  readonly onDeleteProject: (id: string) => Promise<boolean>;
  readonly onBulkReorderProjects: (updates: Array<{ id: string; parentId?: string; displayOrder: number }>) => Promise<boolean>;
  readonly onUpdateProjectCollapsedState: (id: string, isCollapsed: boolean) => Promise<boolean>;
  readonly isLoading?: boolean;
  readonly itemCounts?: Record<string, number>;
  readonly isCollapsed?: boolean;
  readonly isRecommendedSelected?: boolean;
  readonly isAllTasksSelected?: boolean;
  readonly isMyDaySelected?: boolean;
}

interface TreeItemData {
  id: string;
  name: string;
  color: string;
  count: number;
  isSelected: boolean;
  collapsed?: boolean;
  onSelect: () => void;
  onEdit: () => void;
  onAddChild: () => void;
}

export default function ProjectSidebarWithDragDrop({
  projects,
  tasks = [],
  selectedProjectId,
  onProjectSelect,
  onRecommendedSelect,
  onAllTasksSelect,
  onMyDaySelect,
  onAddProject,
  onUpdateProject,
  onDeleteProject,
  onBulkReorderProjects,
  onUpdateProjectCollapsedState,
  isLoading = false,
  itemCounts = {},
  isCollapsed = false,
  isRecommendedSelected = false,
  isAllTasksSelected = false,
  isMyDaySelected = false
}: ProjectSidebarProps) {
  
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<ProjectDecrypted | null>(null);
  const [selectedParentForAdd, setSelectedParentForAdd] = useState<string | undefined>(undefined);

  const handleAddProject = async (name: string, color: string, parentId?: string) => {
    const success = await onAddProject(name, color, parentId ?? selectedParentForAdd);
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

  const openAddDialogForParent = (parentId?: string) => {
    setSelectedParentForAdd(parentId);
    setIsAddDialogOpen(true);
  };

  // Convert projects to tree items format
  const treeItems: TreeItems<TreeItemData> = useMemo(() => {
    
    // Create callback functions outside the mapping to reduce nesting
    const createSelectHandler = (projectId: string) => () => onProjectSelect(projectId);
    const createEditHandler = (project: ProjectDecrypted) => () => setEditingProject(project);
    const createAddChildHandler = (projectId: string) => () => openAddDialogForParent(projectId);

    // Build tree structure
    const buildTree = (parentId?: string): TreeItems<TreeItemData> => {
      const filteredProjects = projects
        .filter(p => {
          // Normalize null and undefined to be equivalent for comparison
          const projectParentId = p.parent_id ?? undefined;
          const targetParentId = parentId ?? undefined;
          return projectParentId === targetParentId;
        })
        .sort((a, b) => a.order - b.order);
      
      
      return filteredProjects.map(project => ({
        id: project.id,
        name: project.name,
        color: project.color || '#6b7280',
        count: itemCounts[project.id] || 0,
        isSelected: selectedProjectId === project.id,
        onSelect: createSelectHandler(project.id),
        onEdit: createEditHandler(project),
        onAddChild: createAddChildHandler(project.id),
        children: buildTree(project.id),
        collapsed: project.collapsed
      }));
    };

    const result = buildTree();
    return result;
  }, [projects, itemCounts, selectedProjectId, onProjectSelect]);

  // Handle tree items change from drag and drop or collapse/expand
  const handleItemsChanged = async (newItems: TreeItems<TreeItemData>) => {
    // Check for collapsed state changes and update them individually
    projects.forEach(project => {
      const findItemById = (items: TreeItems<TreeItemData>, id: string): TreeItemData | null => {
        for (const item of items) {
          if (item.id === id) return item;
          if (item.children) {
            const found = findItemById(item.children, id);
            if (found) return found;
          }
        }
        return null;
      };

      const treeItem = findItemById(newItems, project.id);
      if (treeItem && project.collapsed !== (treeItem.collapsed ?? false)) {
        // Update collapsed state in database
        onUpdateProjectCollapsedState(project.id, treeItem.collapsed ?? false);
      }
    });
    
    // Convert tree back to flat list with new order and parents for drag-and-drop
    const updates: Array<{ id: string; parentId?: string; displayOrder: number }> = [];
    
    const extractUpdates = (items: TreeItems<TreeItemData>, parentId?: string) => {
      items.forEach((item, index) => {
        updates.push({
          id: item.id,
          parentId: parentId,
          displayOrder: index
        });
        
        if (item.children) {
          extractUpdates(item.children, item.id);
        }
      });
    };

    extractUpdates(newItems);
    
    // Apply the updates
    await onBulkReorderProjects(updates);
  };

  // Calculate inbox count (items without project)
  const inboxCount = itemCounts['inbox'] || 0;

  // Collapsed view
  if (isCollapsed) {
    return (
      <div className="w-16 bg-muted/30 border-r border-border h-full flex flex-col items-center py-4">
        <div className="flex flex-col items-center gap-2">
          <Folder className="h-6 w-6 text-muted-foreground" />
          {inboxCount > 0 && (
            <div className="w-2 h-2 bg-primary rounded-full" title={`${inboxCount} tasks in inbox`} />
          )}
        </div>
      </div>
    );
  }

  // Calculate recommended tasks count
      const recommendedCount = tasks.filter(task => !task.completed && ((task.impact || 0) > 3 || (task.urgency || 0) > 3 || task.due_date)).length;

  // Calculate My Day tasks count
  const myDayCount = tasks.filter(task => !task.completed && task.my_day).length;

  // Calculate all tasks count
  const allTasksCount = itemCounts['all'] || 0;

  return (
    <div className="bg-muted/30 border-r border-border h-full flex flex-col">
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
        <div className="px-2">
          {/* My Day */}
          <button
            onClick={onMyDaySelect}
            className={`w-full flex items-center justify-between p-2 text-left rounded-md transition-colors my-2 ${
              isMyDaySelected
                ? 'bg-primary text-primary-foreground'
                : 'hover:bg-muted/50'
            }`}
          >
            <div className="flex items-center gap-2 min-w-0">
              <Sun className="h-4 w-4 flex-shrink-0 text-amber-500" />
              <span className="truncate font-medium">My Day</span>
            </div>
            {myDayCount > 0 && (
              <Badge variant="secondary" className="text-xs">
                {myDayCount}
              </Badge>
            )}
          </button>

          {/* Recommended Tasks */}
          {recommendedCount > 0 && (
            <button
              onClick={onRecommendedSelect}
              className={`w-full flex items-center justify-between p-2 text-left rounded-md transition-colors my-2 ${
                isRecommendedSelected
                  ? 'bg-primary text-primary-foreground'
                  : 'hover:bg-muted/50'
              }`}
            >
              <div className="flex items-center gap-2 min-w-0">
                <Star className="h-4 w-4 flex-shrink-0 text-amber-500" />
                <span className="truncate font-medium">Recommended</span>
              </div>
              <Badge variant="secondary" className="text-xs">
                {recommendedCount}
              </Badge>
            </button>
          )}

          {/* Default Inbox Project */}
          <button
            onClick={() => onProjectSelect(undefined)}
            className={`w-full flex items-center justify-between p-2 text-left rounded-md transition-colors my-2 ${
              selectedProjectId === undefined && !isRecommendedSelected && !isAllTasksSelected && !isMyDaySelected
                ? 'bg-primary text-primary-foreground'
                : 'hover:bg-muted/50'
            }`}
          >
            <div className="flex items-center gap-2 min-w-0">
              {selectedProjectId === undefined && !isRecommendedSelected && !isAllTasksSelected && !isMyDaySelected ? (
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

          {/* All Tasks */}
          <button
            onClick={onAllTasksSelect}
            className={`w-full flex items-center justify-between p-2 text-left rounded-md transition-colors my-2 ${
              isAllTasksSelected
                ? 'bg-primary text-primary-foreground'
                : 'hover:bg-muted/50'
            }`}
          >
            <div className="flex items-center gap-2 min-w-0">
              <List className="h-4 w-4 flex-shrink-0" />
              <span className="truncate font-medium">All Tasks</span>
            </div>
            {allTasksCount > 0 && (
              <Badge variant="secondary" className="text-xs">
                {allTasksCount}
              </Badge>
            )}
          </button>

          {/* Divider between task overviews and projects */}
          {projects.length > 0 && (
            <div className="border-t border-foreground/10 mx-4 h-4" />
          )}

          {/* Draggable Project Tree */}
          <div className="space-y-1">
            <SortableTree
              items={treeItems}
              onItemsChanged={handleItemsChanged}
              TreeItemComponent={ProjectTreeItem}
              indentationWidth={16}
              pointerSensorOptions={{
                activationConstraint: {
                  distance: 8
                }
              }}
            />
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
