'use client';

import React, { useState } from 'react';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Form, FormControl, FormField, FormItem, FormLabel } from '@/components/ui/form';
import { Project } from '@/utils/can-do-list/can-do-list-types';
import { getAvailableParents } from '@/utils/can-do-list/project-hierarchy';

// Predefined color options
const PROJECT_COLORS = [
  '#ef4444', // red-500
  '#f97316', // orange-500
  '#eab308', // yellow-500
  '#22c55e', // green-500
  '#06b6d4', // cyan-500
  '#3b82f6', // blue-500
  '#8b5cf6', // violet-500
  '#ec4899', // pink-500
  '#6b7280', // gray-500
  '#78716c', // stone-500
] as const;

// Define schema for add project validation
const addProjectSchema = z.object({
  name: z.string().min(1, { message: "Project name is required" }).max(50, { message: "Project name must be 50 characters or less" }),
  color: z.string().min(1, { message: "Please select a color" }),
  parentId: z.string().optional(),
});

type AddProjectFormValues = z.infer<typeof addProjectSchema>;

interface AddProjectDialogProps {
  readonly isOpen: boolean;
  readonly onClose: () => void;
  readonly onSave: (name: string, color: string, parentId?: string) => Promise<boolean>;
  readonly isLoading?: boolean;
  readonly projects?: Project[];
  readonly preselectedParentId?: string;
}

export default function AddProjectDialog({
  isOpen,
  onClose,
  onSave,
  isLoading = false,
  projects = [],
  preselectedParentId
}: AddProjectDialogProps) {
  const [isSaving, setIsSaving] = useState(false);

  const form = useForm<AddProjectFormValues>({
    resolver: zodResolver(addProjectSchema),
    defaultValues: {
      name: '',
      color: PROJECT_COLORS[0],
      parentId: preselectedParentId
    }
  });

  // Update form when preselectedParentId changes
  React.useEffect(() => {
    if (preselectedParentId !== undefined) {
      form.setValue('parentId', preselectedParentId);
    } else {
      form.setValue('parentId', undefined);
    }
  }, [preselectedParentId, form]);

  const handleSubmit = async (values: AddProjectFormValues) => {
    setIsSaving(true);
    try {
      const success = await onSave(values.name.trim(), values.color, values.parentId);
      if (success) {
        form.reset();
        onClose();
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleClose = () => {
    form.reset();
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add New Project</DialogTitle>
          <DialogDescription>
            Create a new project to organize your tasks. Choose a name and color.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Project Name</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder="Enter project name..."
                      disabled={isSaving || isLoading}
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="color"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Color</FormLabel>
                  <FormControl>
                    <div className="grid grid-cols-5 gap-2">
                      {PROJECT_COLORS.map(color => (
                        <button
                          key={color}
                          type="button"
                          onClick={() => field.onChange(color)}
                          className={`w-8 h-8 rounded-full border-2 transition-all ${
                            field.value === color
                              ? 'border-foreground scale-110'
                              : 'border-muted-foreground/30 hover:border-muted-foreground/60'
                          }`}
                          style={{ backgroundColor: color }}
                          disabled={isSaving || isLoading}
                        >
                          <span className="sr-only">Select {color}</span>
                        </button>
                      ))}
                    </div>
                  </FormControl>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="parentId"
              render={({ field }) => {
                const availableParents = getAvailableParents(projects);
                return (
                  <FormItem>
                    <FormLabel>Parent Project (Optional)</FormLabel>
                    <FormControl>
                      <Select 
                        value={field.value || 'NO_PARENT'} 
                        onValueChange={(value) => field.onChange(value === 'NO_PARENT' ? undefined : value)}
                        disabled={isSaving || isLoading}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select a parent project..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="NO_PARENT">No parent (top-level project)</SelectItem>
                          {availableParents.map(project => (
                            <SelectItem key={project.id} value={project.id}>
                              {project.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </FormControl>
                  </FormItem>
                );
              }}
            />

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={handleClose}
                disabled={isSaving || isLoading}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSaving || isLoading}
              >
                {isSaving ? 'Creating...' : 'Create Project'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
