'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Form, FormControl, FormField, FormItem, FormLabel } from '@/components/ui/form';
import { Project } from '@/utils/can-do-list/can-do-list-types';
import { getAvailableParents, canMoveProject } from '@/utils/can-do-list/project-hierarchy';
import { Trash2 } from 'lucide-react';

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

// Define schema for edit project validation
const editProjectSchema = z.object({
  name: z.string().min(1, { message: "Project name is required" }).max(50, { message: "Project name must be 50 characters or less" }),
  color: z.string().min(1, { message: "Please select a color" }),
  parentId: z.string().optional(),
});

type EditProjectFormValues = z.infer<typeof editProjectSchema>;

interface EditProjectDialogProps {
  readonly project: Project | null;
  readonly isOpen: boolean;
  readonly onClose: () => void;
  readonly onSave: (id: string, name: string, color: string, parentId?: string) => Promise<boolean>;
  readonly onDelete: (id: string) => Promise<boolean>;
  readonly isLoading?: boolean;
  readonly projects?: Project[];
}

export default function EditProjectDialog({
  project,
  isOpen,
  onClose,
  onSave,
  onDelete,
  isLoading = false,
  projects = []
}: EditProjectDialogProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const form = useForm<EditProjectFormValues>({
    resolver: zodResolver(editProjectSchema),
    defaultValues: {
      name: '',
      color: PROJECT_COLORS[0],
      parentId: undefined
    }
  });

  // Update form when project changes
  useEffect(() => {
    if (project) {
      form.reset({
        name: project.name,
        color: project.color,
        parentId: project.parentId
      });
    }
  }, [project, form]);

  const handleSubmit = async (values: EditProjectFormValues) => {
    if (!project) return;
    
    setIsSaving(true);
    try {
      const success = await onSave(project.id, values.name.trim(), values.color, values.parentId);
      if (success) {
        onClose();
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!project || isDeleting) return;
    
    setIsDeleting(true);
    try {
      const success = await onDelete(project.id);
      if (success) {
        setShowDeleteConfirm(false);
        // Small delay to ensure alert dialog closes before main dialog
        setTimeout(() => {
          onClose();
        }, 100);
      }
    } catch (error) {
      console.error('Error deleting project:', error);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleClose = () => {
    if (!isSaving && !isDeleting) {
      form.reset();
      setShowDeleteConfirm(false);
      onClose();
    }
  };

  const handleDeleteConfirmClose = (open: boolean) => {
    if (!isDeleting) {
      setShowDeleteConfirm(open);
    }
  };

  if (!project) return null;

  return (
    <>
      <Dialog 
        key={project?.id || 'edit-project'} 
        open={isOpen} 
        onOpenChange={(open) => {
          if (!open && !showDeleteConfirm) {
            handleClose();
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Project</DialogTitle>
            <DialogDescription>
              Update the project name and color, or delete the project.
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
                      <div className="space-y-3">
                        {/* Predefined Colors */}
                        <div>
                          <div className="text-sm text-muted-foreground mb-2">Preset Colors</div>
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
                        </div>
                        
                        {/* Custom Color Picker */}
                        <div>
                          <div className="text-sm text-muted-foreground mb-2">Custom Color</div>
                          <div className="flex items-center gap-2">
                            <input
                              type="color"
                              value={field.value}
                              onChange={(e) => field.onChange(e.target.value)}
                              className="w-8 h-8 rounded border border-muted-foreground/30 cursor-pointer disabled:cursor-not-allowed"
                              disabled={isSaving || isLoading}
                            />
                            <Input
                              type="text"
                              value={field.value}
                              onChange={(e) => {
                                const value = e.target.value;
                                // Validate hex color format
                                if (/^#[0-9A-Fa-f]{6}$/.test(value) || value === '') {
                                  field.onChange(value);
                                }
                              }}
                              placeholder="#000000"
                              className="w-24 text-sm font-mono"
                              disabled={isSaving || isLoading}
                            />
                            <div
                              className="w-6 h-6 rounded border border-muted-foreground/30 flex-shrink-0"
                              style={{ backgroundColor: field.value }}
                            />
                          </div>
                        </div>
                      </div>
                    </FormControl>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="parentId"
                render={({ field }) => {
                  if (!project) {
                    return <></>;
                  }
                  
                  const availableParents = getAvailableParents(project.id, projects).filter(p => 
                    canMoveProject(project.id, p.id, projects)
                  );
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
                            {availableParents.map(parentProject => (
                              <SelectItem key={parentProject.id} value={parentProject.id}>
                                {parentProject.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </FormControl>
                    </FormItem>
                  );
                }}
              />

              <DialogFooter className="flex-col sm:flex-row gap-2">
                <Button
                  type="button"
                  variant="destructive"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setShowDeleteConfirm(true);
                  }}
                  disabled={isSaving || isLoading}
                  className="w-full sm:w-auto"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete Project
                </Button>
                <div className="flex gap-2 w-full sm:w-auto">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleClose}
                    disabled={isSaving || isLoading}
                    className="flex-1 sm:flex-none"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={isSaving || isLoading}
                    className="flex-1 sm:flex-none"
                  >
                    {isSaving ? 'Saving...' : 'Save Changes'}
                  </Button>
                </div>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <AlertDialog 
        key={`delete-${project?.id || 'confirm'}`}
        open={showDeleteConfirm} 
        onOpenChange={handleDeleteConfirmClose}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Project</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{project?.name}"? 
              All tasks in this project will be moved to the Inbox.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel 
              disabled={isDeleting}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setShowDeleteConfirm(false);
              }}
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleDelete();
              }}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? 'Deleting...' : 'Delete Project'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
