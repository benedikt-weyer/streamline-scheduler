'use client';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { CanDoItem, Project } from '@/utils/can-do-list/can-do-list-types';
import { useState } from 'react';
import { Edit, Trash2, Clock } from 'lucide-react';
import EditItemDialog from './edit-item-dialog';

interface ItemListItemProps {
  readonly item: CanDoItem;
  readonly onToggleComplete: (id: string, completed: boolean) => Promise<void>;
  readonly onDeleteItem: (id: string) => Promise<void>;
  readonly onUpdateItem: (id: string, content: string, estimatedDuration?: number, projectId?: string) => Promise<void>;
  readonly projects?: Project[];
}

export default function ItemListItem({ item, onToggleComplete, onDeleteItem, onUpdateItem, projects = [] }: ItemListItemProps) {
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  const handleEdit = () => {
    setIsEditDialogOpen(true);
  };

  const handleSave = async (id: string, content: string, estimatedDuration?: number, projectId?: string) => {
    setIsUpdating(true);
    try {
      await onUpdateItem(id, content, estimatedDuration, projectId);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleCloseDialog = () => {
    setIsEditDialogOpen(false);
  };

  return (
    <>
      <li 
        className={`flex items-center justify-between rounded-md border ${
          item.completed ? 'bg-muted' : ''
        }`}
      >
        <div className="flex items-center space-x-3 flex-1 min-w-0 p-3">
          <Checkbox
            checked={item.completed}
            id={`item-${item.id}`}
            onCheckedChange={() => onToggleComplete(item.id, !item.completed)}
          />
          <span
            className={`flex-1 min-w-0 cursor-pointer ${
              item.completed ? 'line-through text-muted-foreground' : ''
            }`}
            onClick={() => onToggleComplete(item.id, !item.completed)}
          >
            <span className="block truncate">{item.content}</span>
          </span>
        </div>
        
        <div className="flex items-center space-x-1">
          {item.estimatedDuration && (
            <span className="ml-2 text-xs text-background bg-muted-foreground px-2 py-[2px] rounded-sm flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {item.estimatedDuration} min
            </span>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={handleEdit}
            className="text-muted-foreground hover:text-foreground"
          >
            <Edit className="h-4 w-4" />
            <span className="sr-only">Edit</span>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onDeleteItem(item.id)}
            className="text-destructive hover:text-destructive/80"
          >
            <Trash2 className="h-4 w-4" />
            <span className="sr-only">Delete</span>
          </Button>
        </div>
      </li>

      <EditItemDialog
        item={item}
        isOpen={isEditDialogOpen}
        onClose={handleCloseDialog}
        onSave={handleSave}
        isLoading={isUpdating}
        projects={projects}
      />
    </>
  );
}
