'use client';

import { useCanDoList } from '@/hooks/can-do-list/useCanDoList';
import { useEncryptionKey } from '@/hooks/cryptography/useEncryptionKey';
import { useError } from '@/utils/context/ErrorContext';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';

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
  estimatedDuration: z.string().optional(),
});

type AddItemFormValues = {
  content: string;
  estimatedDuration?: string;
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
  const form = useForm<{ content: string; estimatedDuration?: string }>({
    resolver: zodResolver(addItemSchema),
    defaultValues: {
      content: '',
      estimatedDuration: ''
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
    const duration = values.estimatedDuration ? Number(values.estimatedDuration) : undefined;
    const success = await handleAddItem(values.content, duration);
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
          <CanDoListHeader isSubscribed={isSubscribed} />
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
