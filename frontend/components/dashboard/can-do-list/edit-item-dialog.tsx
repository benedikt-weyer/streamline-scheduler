'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect } from 'react';
import { CanDoItem } from '@/utils/can-do-list/can-do-list-types';

// Define schema for edit item validation
const editItemSchema = z.object({
  content: z.string().min(1, { message: "Item content is required" })
});

type EditItemFormValues = z.infer<typeof editItemSchema>;

interface EditItemDialogProps {
  readonly item: CanDoItem | null;
  readonly isOpen: boolean;
  readonly onClose: () => void;
  readonly onSave: (id: string, content: string) => Promise<void>;
  readonly isLoading?: boolean;
}

export default function EditItemDialog({ 
  item, 
  isOpen, 
  onClose, 
  onSave, 
  isLoading = false 
}: EditItemDialogProps) {
  const form = useForm<EditItemFormValues>({
    resolver: zodResolver(editItemSchema),
    defaultValues: {
      content: ''
    }
  });

  // Reset form when item changes or dialog opens
  useEffect(() => {
    if (item && isOpen) {
      form.reset({ content: item.content });
    }
  }, [item, isOpen, form]);

  const onSubmit = async (values: EditItemFormValues) => {
    if (!item) return;
    
    if (values.content.trim() === item.content.trim()) {
      onClose();
      return;
    }
    
    await onSave(item.id, values.content);
    onClose();
  };

  const handleClose = () => {
    if (!isLoading) {
      onClose();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape' && !isLoading) {
      e.preventDefault();
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[425px]" onKeyDown={handleKeyDown}>
        <DialogHeader>
          <DialogTitle>Edit Item</DialogTitle>
          <DialogDescription>
            Make changes to your can-do item here. Click save when you're done.
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="content">Content</Label>
            <Input
              id="content"
              autoFocus
              disabled={isLoading}
              {...form.register('content')}
            />
            {form.formState.errors.content && (
              <p className="text-sm text-destructive">
                {form.formState.errors.content.message}
              </p>
            )}
          </div>
          
          <DialogFooter>
            <Button 
              type="button" 
              variant="outline" 
              onClick={handleClose}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={isLoading}
            >
              {isLoading ? 'Saving...' : 'Save changes'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
