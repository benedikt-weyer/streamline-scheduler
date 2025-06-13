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
import { Task, Project, DEFAULT_PROJECT_NAME } from '@/utils/can-do-list/can-do-list-types';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

// Predefined duration options in minutes
const PREDEFINED_DURATIONS = [
  { label: '15 min', value: 15 },
  { label: '30 min', value: 30 },
  { label: '1 hour', value: 60 },
  { label: '3 hours', value: 180 },
] as const;

// Define schema for edit task validation
const editTaskSchema = z.object({
  content: z.string().min(1, { message: "Task content is required" }),
  estimatedDuration: z
    .union([
      z.string().regex(/^\d*$/, { message: 'Must be a number' }),
      z.number().int().min(0).optional()
    ])
    .optional(),
  projectId: z.string().optional()
});

type EditTaskFormValues = z.infer<typeof editTaskSchema>;

interface EditTaskDialogProps {
  readonly task: Task | null;
  readonly isOpen: boolean;
  readonly onClose: () => void;
  readonly onSave: (id: string, content: string, estimatedDuration?: number, projectId?: string) => Promise<void>;
  readonly isLoading?: boolean;
  readonly projects?: Project[];
}

export default function EditTaskDialog({ 
  task, 
  isOpen, 
  onClose, 
  onSave, 
  isLoading = false,
  projects = []
}: EditTaskDialogProps) {
  const form = useForm<EditTaskFormValues>({
    resolver: zodResolver(editTaskSchema),
    defaultValues: {
      content: '',
      estimatedDuration: ''
    }
  });

  // Reset form when task changes or dialog opens
  useEffect(() => {
    if (task && isOpen) {
      form.reset({
        content: task.content,
        estimatedDuration: task.estimatedDuration?.toString() ?? '',
        projectId: task.projectId ?? ''
      });
    }
  }, [task, isOpen, form]);

  const onSubmit = async (values: EditTaskFormValues) => {
    if (!task) return;
    const duration = values.estimatedDuration ? Number(values.estimatedDuration) : undefined;
    if (
      values.content.trim() === task.content.trim() &&
      duration === task.estimatedDuration &&
      values.projectId === task.projectId
    ) {
      onClose();
      return;
    }
    await onSave(task.id, values.content, duration, values.projectId);
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
          <DialogTitle>Edit Task</DialogTitle>
          <DialogDescription>
            Make changes to your can-do task here. Click save when you're done.
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
          <div className="space-y-2">
            <Label htmlFor="estimatedDuration">Estimated Duration (min)</Label>
            <div className="space-y-3">
              {/* Predefined duration buttons */}
              <div className="flex flex-wrap gap-2">
                {PREDEFINED_DURATIONS.map((duration) => (
                  <Button
                    key={duration.value}
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={isLoading}
                    onClick={() => form.setValue('estimatedDuration', duration.value.toString())}
                    className="text-xs"
                  >
                    {duration.label}
                  </Button>
                ))}
              </div>
              {/* Custom duration input */}
              <Input
                id="estimatedDuration"
                type="number"
                min="0"
                placeholder="Custom duration..."
                disabled={isLoading}
                {...form.register('estimatedDuration')}
              />
            </div>
            {form.formState.errors.estimatedDuration && (
              <p className="text-sm text-destructive">
                {form.formState.errors.estimatedDuration.message}
              </p>
            )}
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="project">Project</Label>
            <Select 
              value={form.watch('projectId') ?? '__inbox__'} 
              onValueChange={(value) => form.setValue('projectId', value === '__inbox__' ? undefined : value)}
              disabled={isLoading}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a project..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__inbox__">
                  <div className="flex items-center gap-2">
                    <span>{DEFAULT_PROJECT_NAME}</span>
                  </div>
                </SelectItem>
                {projects.map(project => (
                  <SelectItem key={project.id} value={project.id}>
                    <div className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: project.color }}
                      />
                      <span>{project.name}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
