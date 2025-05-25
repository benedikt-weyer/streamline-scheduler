'use client';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { CanDoItem } from '@/utils/can-do-list/can-do-list-types';

interface ItemListItemProps {
  item: CanDoItem;
  onToggleComplete: (id: string, completed: boolean) => Promise<void>;
  onDeleteItem: (id: string) => Promise<void>;
}

export default function ItemListItem({ item, onToggleComplete, onDeleteItem }: ItemListItemProps) {
  return (
    <li 
      className={`flex items-center justify-between p-3 rounded-md border ${
        item.completed ? 'bg-muted' : ''
      }`}
    >
      <div className="flex items-center space-x-3">
        <Checkbox
          checked={item.completed}
          onCheckedChange={() => onToggleComplete(item.id, item.completed)}
          id={`item-${item.id}`}
        />
        <label
          htmlFor={`item-${item.id}`}
          className={`${item.completed ? 'line-through text-muted-foreground' : ''}`}
        >
          {item.content}
        </label>
      </div>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => onDeleteItem(item.id)}
        className="text-destructive hover:text-destructive/80"
      >
        Delete
      </Button>
    </li>
  );
}
