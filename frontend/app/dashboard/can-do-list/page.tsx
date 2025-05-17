'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { fetchCanDoItems, addCanDoItem, updateCanDoItem, deleteCanDoItem } from './actions';
import { 
  decryptData, 
  encryptData, 
  generateIV, 
  generateSalt, 
  getHashedPassword, 
  deriveKeyFromPassword 
} from '@/utils/encryption';
import { CanDoItem } from '@/utils/types';
import Link from 'next/link';

export default function CanDoListPage() {
  const [items, setItems] = useState<CanDoItem[]>([]);
  const [newItemContent, setNewItemContent] = useState('');
  const [encryptionKey, setEncryptionKey] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load encryption key from cookie and fetch items on component mount
  useEffect(() => {
    const hashedPassword = getHashedPassword();
    
    if (!hashedPassword) {
      setError('Please log in again to access your encrypted Can-Do List');
      setIsLoading(false);
      return;
    }
    
    setEncryptionKey(hashedPassword);
    loadItems(hashedPassword);
  }, []);

  // Load and decrypt items
  const loadItems = async (key: string) => {
    try {
      setIsLoading(true);
      const encryptedItems = await fetchCanDoItems();
      
      const decryptedItems = encryptedItems
        .map(item => {
          try {
            const decryptionKey = deriveKeyFromPassword(key, item.salt);
            const decryptedData = decryptData(item.encrypted_data, decryptionKey, item.iv);
            
            if (!decryptedData) return null;
            
            return {
              id: item.id,
              content: decryptedData.content,
              completed: decryptedData.completed,
              createdAt: new Date(item.created_at),
              updatedAt: item.updated_at ? new Date(item.updated_at) : undefined
            };
          } catch (error) {
            console.error('Failed to decrypt item:', error);
            return null;
          }
        })
        .filter((item): item is NonNullable<typeof item> => item !== null);
      
      setItems(decryptedItems);
    } catch (error) {
      console.error('Error loading items:', error);
      setError('Failed to load your Can-Do List items');
    } finally {
      setIsLoading(false);
    }
  };

  // Add a new item
  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!newItemContent.trim() || !encryptionKey) return;
    
    try {
      const salt = generateSalt();
      const iv = generateIV();
      const derivedKey = deriveKeyFromPassword(encryptionKey, salt);
      
      const itemData = {
        content: newItemContent.trim(),
        completed: false
      };
      
      const encryptedData = encryptData(itemData, derivedKey, iv);
      
      const newEncryptedItem = await addCanDoItem(encryptedData, iv, salt);
      
      const newItem: CanDoItem = {
        id: newEncryptedItem.id,
        content: itemData.content,
        completed: itemData.completed,
        createdAt: new Date(newEncryptedItem.created_at),
        updatedAt: new Date(newEncryptedItem.updated_at)
      };
      
      setItems(prevItems => [newItem, ...prevItems]);
      setNewItemContent('');
    } catch (error) {
      console.error('Error adding item:', error);
      setError('Failed to add new item');
    }
  };

  // Toggle item completion status
  const handleToggleComplete = async (id: string, completed: boolean) => {
    if (!encryptionKey) return;
    
    try {
      const item = items.find(item => item.id === id);
      if (!item) return;
      
      // Find the corresponding encrypted item to get salt and IV
      const encryptedItems = await fetchCanDoItems();
      const encryptedItem = encryptedItems.find(item => item.id === id);
      if (!encryptedItem) return;
      
      const salt = encryptedItem.salt;
      const iv = encryptedItem.iv;
      const derivedKey = deriveKeyFromPassword(encryptionKey, salt);
      
      const updatedItemData = {
        content: item.content,
        completed: !completed
      };
      
      const encryptedData = encryptData(updatedItemData, derivedKey, iv);
      
      await updateCanDoItem(id, encryptedData, iv, salt);
      
      setItems(prevItems =>
        prevItems.map(item =>
          item.id === id
            ? { ...item, completed: !completed }
            : item
        )
      );
    } catch (error) {
      console.error('Error toggling item completion:', error);
      setError('Failed to update item');
    }
  };

  // Delete an item
  const handleDeleteItem = async (id: string) => {
    try {
      await deleteCanDoItem(id);
      setItems(prevItems => prevItems.filter(item => item.id !== id));
    } catch (error) {
      console.error('Error deleting item:', error);
      setError('Failed to delete item');
    }
  };

  if (!encryptionKey && !isLoading) {
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
      </p>
      
      {error && (
        <div className="bg-destructive/10 text-destructive p-3 rounded-md mb-4">
          {error}
        </div>
      )}
      
      <form onSubmit={handleAddItem} className="flex gap-2 mb-6">
        <Input
          type="text"
          placeholder="Add a new item..."
          value={newItemContent}
          onChange={(e) => setNewItemContent(e.target.value)}
          className="flex-grow"
        />
        <Button type="submit" disabled={!newItemContent.trim() || isLoading}>
          Add
        </Button>
      </form>
      
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
                  onCheckedChange={() => handleToggleComplete(item.id, item.completed)}
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
                onClick={() => handleDeleteItem(item.id)}
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