'use client';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { CanDoItem } from '@/utils/can-do-list/can-do-list-types';
import { useState } from 'react';
import ItemActions from './item-actions';
import EditItemDialog from './edit-item-dialog';

interface ItemListItemAdvancedProps {
  readonly item: CanDoItem;
  readonly onToggleComplete: (id: string, completed: boolean) => Promise<void>;
  readonly onDeleteItem: (id: string) => Promise<void>;
  readonly onUpdateItem?: (id: string, content: string) => Promise<void>;
  readonly onDuplicateItem?: (item: CanDoItem) => void;
  readonly showAdvancedActions?: boolean;
}

export default function ItemListItemAdvanced({ 
  item, 
  onToggleComplete, 
  onDeleteItem,
  onUpdateItem,
  onDuplicateItem,
  showAdvancedActions = false
}: ItemListItemAdvancedProps) {
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  const handleEdit = onUpdateItem ? () => setIsEditDialogOpen(true) : undefined;
  const handleDuplicate = onDuplicateItem ? () => onDuplicateItem(item) : undefined;
  const handleDelete = () => onDeleteItem(item.id);

  const handleSave = async (id: string, content: string) => {
    if (!onUpdateItem) return;
    setIsUpdating(true);
    try {
      await onUpdateItem(id, content);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleCloseDialog = () => {
    setIsEditDialogOpen(false);
  };

  return (
    <li 
      className={`flex items-center justify-between p-3 rounded-md border transition-colors ${
        item.completed ? 'bg-muted' : 'hover:bg-muted/50'
      }`}
    >
      <div className="flex items-center space-x-3 min-w-0 flex-1">
        <Checkbox
          checked={item.completed}
          onCheckedChange={() => onToggleComplete(item.id, item.completed)}
          id={`item-${item.id}`}
        />
        <label
          htmlFor={`item-${item.id}`}
          className={`cursor-pointer select-none flex-1 min-w-0 ${
            item.completed ? 'line-through text-muted-foreground' : ''
          }`}
        >
          <span className="block truncate">{item.content}</span>
        </label>
      </div>
      
      <div className="flex items-center space-x-1 ml-2">
        {showAdvancedActions ? (
          <ItemActions
            onEdit={handleEdit}
            onDuplicate={handleDuplicate}
            onDelete={handleDelete}
          />
        ) : (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleDelete}
            className="text-destructive hover:text-destructive/80"
          >
            Delete
          </Button>
        )}
      </div>
    </li>
  );
}
