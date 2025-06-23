'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, Settings, Folder, FolderOpen, ChevronDown, ChevronRight } from 'lucide-react';
import { SimpleTreeItemWrapper, TreeItemComponentProps } from 'dnd-kit-sortable-tree';

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

const ProjectTreeItem = React.forwardRef<
  HTMLDivElement,
  TreeItemComponentProps<TreeItemData>
>((props, ref) => {
  const { item, onCollapse } = props;
  // Check if this item has children by looking at the children in the tree data structure
  // TreeItems in dnd-kit-sortable-tree have a children property containing child items
  const hasChildren = (item as any).children && (item as any).children.length > 0;

  const handleToggleCollapse = (e: React.MouseEvent) => {
    e.stopPropagation();
    // Use the onCollapse callback provided by dnd-kit-sortable-tree
    if (onCollapse && hasChildren) {
      onCollapse();
    }
  };

  return (
    <SimpleTreeItemWrapper 
      {...props} 
      ref={ref} 
      className="no-border-tree-item"
    >
      <div className="relative flex items-center w-full group">
        {/* Custom Collapse/Expand button for projects with children */}
        <div className="w-3 h-6 mr-2 flex items-center justify-center">
          {hasChildren && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleToggleCollapse}
              className="h-full w-full p-0 hover:bg-muted/50"
            >
              {item.collapsed ? (
                <ChevronRight className="h-3 w-3" />
              ) : (
                <ChevronDown className="h-3 w-3" />
              )}
            </Button>
          )}
        </div>
        
        {/* Project button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            e.preventDefault();
            item.onSelect();
          }}
          className={`flex-1 flex items-center justify-between p-2 text-left rounded-md transition-colors overflow-hidden ${
            item.isSelected
              ? 'bg-primary text-primary-foreground'
              : 'hover:bg-muted/50'
          }`}
        >
          <div className="flex items-center gap-2 min-w-0">
            {item.isSelected ? (
              <FolderOpen className="h-4 w-4 flex-shrink-0" />
            ) : (
              <Folder className="h-4 w-4 flex-shrink-0" />
            )}
            <div
              className="w-3 h-3 rounded-full flex-shrink-0"
              style={{ backgroundColor: item.color }}
            />
            <span className="truncate">{item.name}</span>
          </div>
          <div className="flex items-center gap-1">
            {item.count > 0 && (
              <Badge variant="secondary" className="text-xs group-hover:opacity-0 transition-opacity !text-primary">
                {item.count}
              </Badge>
            )}
          </div>
        </button>
        
        {/* Actions dropdown */}
        <div className="absolute right-2 top-1/2 transform -translate-y-1/2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button
            variant="ghost"
            size="sm"
            onClick={item.onAddChild}
            className={`h-6 w-6 p-0 ${item.isSelected ? 'hover:bg-primary-foreground/20' : ''}`}
            title="Add subproject"
          >
            <Plus className={`h-3 w-3 ${item.isSelected ? 'text-primary-foreground' : ''}`} />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={item.onEdit}
            className={`h-6 w-6 p-0 ${item.isSelected ? 'hover:bg-primary-foreground/20' : ''}`}
            title="Edit project"
          >
            <Settings className={`h-3 w-3 ${item.isSelected ? 'text-primary-foreground' : ''}`} />
          </Button>
        </div>
      </div>
    </SimpleTreeItemWrapper>
  );
});

ProjectTreeItem.displayName = 'ProjectTreeItem';

export default ProjectTreeItem;
