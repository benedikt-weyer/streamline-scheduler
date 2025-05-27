'use client';

import { useCanDoList } from '@/hooks/can-do-list/useCanDoList';
import { useEncryptionKey } from '@/hooks/cryptography/useEncryptionKey';
import { useError } from '@/utils/context/ErrorContext';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { parseDurationFromContent } from '@/utils/can-do-list/duration-parser';

import CanDoListHeader from './can-do-list-header';
import ErrorDisplay from './error-display';
import AddItemForm from './add-item-form';
import LoadingState from './loading-state';
import EmptyState from './empty-state';
import ItemList from './item-list';
import AuthenticationRequired from './authentication-required';

// Define schema for new item validation
const addItemSchema = z.object({
  content: z.string().min(1, { message: "Item content is required" }),
});

type AddItemFormValues = {
  content: string;
};

export default function CanDoListMain() {
  const { encryptionKey, isLoading: isLoadingKey } = useEncryptionKey();
  const { error } = useError();

  // Use the main can-do list hook
  const {
    items,
    isLoading,
    loadItems,
    handleAddItem,
    handleUpdateItem,
    handleToggleComplete,
    handleDeleteItem,
    isSubscribed
  } = useCanDoList(encryptionKey);

  // Initialize form with react-hook-form and zod validation
  const form = useForm<{ content: string }>({
    resolver: zodResolver(addItemSchema),
    defaultValues: {
      content: ''
    }
  });

  // Load items when encryption key becomes available
  useEffect(() => {
    if (encryptionKey) {
      loadItems(encryptionKey);
    }
  }, [encryptionKey, loadItems]);

  // Add a new item using react-hook-form
  const onSubmit = async (values: AddItemFormValues) => {
    // Parse duration hashtags from content
    const parsed = parseDurationFromContent(values.content);
    const success = await handleAddItem(parsed.content, parsed.duration);
    if (success) {
      form.reset();
    }
  };

  // Handle update action
  const onUpdateItem = async (id: string, content: string, estimatedDuration?: number) => {
    await handleUpdateItem(id, content, estimatedDuration);
  };

  // Handle toggle complete action
  const onToggleComplete = async (id: string, completed: boolean) => {
    await handleToggleComplete(id, completed);
  };

  // Handle delete action
  const onDeleteItem = async (id: string) => {
    await handleDeleteItem(id);
  };

  return (
    <>
      <AuthenticationRequired 
        isLoadingKey={isLoadingKey} 
        encryptionKey={encryptionKey} 
      />
      
      {(encryptionKey || isLoadingKey) && (
        <div className="max-w-2xl mx-auto p-4">
          <h1 className="text-2xl font-bold mb-2">Your Can-Do List</h1>
          <ErrorDisplay error={error} />
          <AddItemForm 
            form={form} 
            onSubmit={onSubmit} 
            isLoading={isLoading} 
          />
          <LoadingState isLoading={isLoading} />
          <EmptyState isLoading={isLoading} itemsLength={items.length} />
          <ItemList 
            items={items}
            isLoading={isLoading}
            onToggleComplete={onToggleComplete}
            onDeleteItem={onDeleteItem}
            onUpdateItem={onUpdateItem}
          />
        </div>
      )}
    </>
  );
}
