'use client';

import { CanDoItem } from '@/utils/can-do-list/can-do-list-types';
import ItemListItem from './item-list-item';

interface ItemListProps {
  readonly items: CanDoItem[];
  readonly isLoading: boolean;
  readonly onToggleComplete: (id: string, completed: boolean) => Promise<void>;
  readonly onDeleteItem: (id: string) => Promise<void>;
  readonly onUpdateItem: (id: string, content: string) => Promise<void>;
}

export default function ItemList({ items, isLoading, onToggleComplete, onDeleteItem, onUpdateItem }: ItemListProps) {
  if (isLoading || items.length === 0) return null;

  return (
    <ul className="space-y-2">
      {items.map(item => (
        <ItemListItem
          key={item.id}
          item={item}
          onToggleComplete={onToggleComplete}
          onDeleteItem={onDeleteItem}
          onUpdateItem={onUpdateItem}
        />
      ))}
    </ul>
  );
}
