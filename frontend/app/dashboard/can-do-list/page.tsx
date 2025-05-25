'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Form, FormControl, FormField, FormItem } from '@/components/ui/form';

import { useCanDoList } from '@/hooks/can-do-list/useCanDoList';
import { useEncryptionKey } from '@/hooks/cryptography/useEncryptionKey';
import { ErrorProvider, useError } from '@/utils/context/ErrorContext';

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import Link from 'next/link';



// Define schema for new item validation
const addItemSchema = z.object({
  content: z.string().min(1, { message: "Item content is required" })
});

type AddItemFormValues = z.infer<typeof addItemSchema>;

function CanDoListContent() {
  const { encryptionKey, isLoading: isLoadingKey } = useEncryptionKey();
  const { error } = useError();

  // Use the main can-do list hook
  const {
    items,
    isLoading,
    loadItems,
    handleAddItem,
    handleToggleComplete,
    handleDeleteItem,
    isSubscribed
  } = useCanDoList(encryptionKey);

  // Initialize form with react-hook-form and zod validation
  const form = useForm<AddItemFormValues>({
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
    if (!encryptionKey) return;
    
    const success = await handleAddItem(values.content);
    if (success) {
      form.reset();
    }
  };

  // Handle toggle complete action
  const onToggleComplete = async (id: string, completed: boolean) => {
    await handleToggleComplete(id, completed);
  };

  // Handle delete action
  const onDeleteItem = async (id: string) => {
    await handleDeleteItem(id);
  };

  if (!encryptionKey && !isLoadingKey) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] p-4">
        <h1 className="text-2xl font-bold mb-4">Authentication Required</h1>
        <p className="text-center mb-4">
          You need to log in first to access your encrypted Can-Do List.
        </p>
        <Link href="/sign-in">
          <Button>Sign In</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto p-4">
      <h1 className="text-2xl font-bold mb-6">Your Can-Do List</h1>
      <p className="text-sm text-muted-foreground mb-4">
        Your list is encrypted and can only be read with your password.
        {isSubscribed && <span className="ml-2 text-green-600">● Live updates enabled</span>}
      </p>
      
      {error && (
        <div className="bg-destructive/10 text-destructive p-3 rounded-md mb-4">
          {error}
        </div>
      )}
      
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="flex gap-2 mb-6">
          <FormField
            control={form.control}
            name="content"
            render={({ field }) => (
              <FormItem className="flex-grow">
                <FormControl>
                  <Input
                    placeholder="Add a new item..."
                    {...field}
                  />
                </FormControl>
              </FormItem>
            )}
          />
          <Button type="submit" disabled={isLoading}>
            Add
          </Button>
        </form>
      </Form>
      
      {/* Display loading, empty state, or items list */}
      {isLoading && (
        <div className="text-center py-8">Loading your encrypted list...</div>
      )}
      
      {!isLoading && items.length === 0 && (
        <div className="text-center py-8 text-muted-foreground">
          Your list is empty. Add your first item above!
        </div>
      )}
      
      {!isLoading && items.length > 0 && (
        <ul className="space-y-2">
          {items.map(item => (
            <li 
              key={item.id} 
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
          ))}
        </ul>
      )}
    </div>
  );
}

export default function CanDoListPage() {
  return (
    <ErrorProvider>
      <CanDoListContent />
    </ErrorProvider>
  );
}