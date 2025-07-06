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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useState } from 'react';
import { Task, Project, DEFAULT_PROJECT_NAME } from '@/utils/can-do-list/can-do-list-types';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Check, ChevronsUpDown } from 'lucide-react';
import { cn } from '@/lib/shadcn-utils';

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
  projectId: z.string().optional(),
  importance: z.number().int().min(0).max(10).optional(),
  urgency: z.number().int().min(0).max(10).optional(),
  dueDate: z.string().optional(),
  blockedBy: z.string().optional()
});

type EditTaskFormValues = z.infer<typeof editTaskSchema>;

interface EditTaskDialogProps {
  readonly task: Task | null;
  readonly isOpen: boolean;
  readonly onClose: () => void;
  readonly onSave: (id: string, content: string, estimatedDuration?: number, projectId?: string, importance?: number, urgency?: number, dueDate?: Date, blockedBy?: string) => Promise<void>;
  readonly isLoading?: boolean;
  readonly projects?: Project[];
  readonly tasks?: Task[];
}

export default function EditTaskDialog({ 
  task, 
  isOpen, 
  onClose, 
  onSave, 
  isLoading = false,
  projects = [],
  tasks = []
}: EditTaskDialogProps) {
  const [blockedByOpen, setBlockedByOpen] = useState(false);
  
  const form = useForm<EditTaskFormValues>({
    resolver: zodResolver(editTaskSchema),
    defaultValues: {
      content: '',
      estimatedDuration: '',
      blockedBy: ''
    }
  });

  // Reset form when task changes or dialog opens
  useEffect(() => {
    if (task && isOpen) {
      form.reset({
        content: task.content,
        estimatedDuration: task.estimatedDuration?.toString() ?? '',
        projectId: task.projectId ?? '',
        importance: task.importance ?? 0,
        urgency: task.urgency ?? 0,
        dueDate: task.dueDate ? task.dueDate.toISOString().split('T')[0] : '',
        blockedBy: task.blockedBy ?? ''
      });
    }
  }, [task, isOpen, form]);

  const onSubmit = async (values: EditTaskFormValues) => {
    if (!task) return;
    const duration = values.estimatedDuration ? Number(values.estimatedDuration) : undefined;
    const importance = values.importance === 0 ? undefined : values.importance;
    const urgency = values.urgency === 0 ? undefined : values.urgency;
    const dueDate = values.dueDate ? new Date(values.dueDate + 'T00:00:00.000Z') : undefined;
    const blockedBy = values.blockedBy || undefined;
    
    if (
      values.content.trim() === task.content.trim() &&
      duration === task.estimatedDuration &&
      values.projectId === task.projectId &&
      importance === task.importance &&
      urgency === task.urgency &&
      dueDate?.getTime() === task.dueDate?.getTime() &&
      blockedBy === task.blockedBy
    ) {
      onClose();
      return;
    }
    await onSave(task.id, values.content, duration, values.projectId, importance, urgency, dueDate, blockedBy);
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
    <Dialog open={isOpen} onOpenChange={handleClose} modal={false}>
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

          <div className="space-y-2">
            <Label htmlFor="dueDate">Due Date</Label>
            <Input
              id="dueDate"
              type="date"
              disabled={isLoading}
              {...form.register('dueDate')}
            />
            {form.formState.errors.dueDate && (
              <p className="text-sm text-destructive">
                {form.formState.errors.dueDate.message}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="blockedBy">Blocked By</Label>
            <Popover open={blockedByOpen} onOpenChange={setBlockedByOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={blockedByOpen}
                  className="w-full justify-between"
                  disabled={isLoading}
                >
                  {form.watch('blockedBy') ? 
                    tasks.find(t => t.id === form.watch('blockedBy'))?.content || 'Select a blocking task...' :
                    'Select a blocking task...'
                  }
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[400px] p-0">
                <Command>
                  <CommandInput placeholder="Search tasks..." className="h-9" />
                  <CommandList>
                    <CommandEmpty>No tasks found.</CommandEmpty>
                    <CommandGroup>
                      <CommandItem
                        value="not blocked"
                        onSelect={() => {
                          form.setValue('blockedBy', undefined);
                          setBlockedByOpen(false);
                        }}
                      >
                        Not blocked
                        <Check
                          className={cn(
                            "ml-auto h-4 w-4",
                            !form.watch('blockedBy') ? "opacity-100" : "opacity-0"
                          )}
                        />
                      </CommandItem>
                      {tasks
                        .filter(t => t.id !== task?.id && !t.completed) // Don't show current task or completed tasks
                        .sort((a, b) => a.content.localeCompare(b.content))
                        .map(blockingTask => (
                          <CommandItem
                            key={blockingTask.id}
                            value={blockingTask.content}
                            onSelect={() => {
                              form.setValue('blockedBy', blockingTask.id);
                              setBlockedByOpen(false);
                            }}
                          >
                            <div className="flex items-center gap-2">
                              <span className="truncate max-w-64">{blockingTask.content}</span>
                              {blockingTask.projectId && (
                                <span className="text-xs text-muted-foreground">
                                  ({projects.find(p => p.id === blockingTask.projectId)?.name || 'Unknown'})
                                </span>
                              )}
                            </div>
                            <Check
                              className={cn(
                                "ml-auto h-4 w-4",
                                form.watch('blockedBy') === blockingTask.id ? "opacity-100" : "opacity-0"
                              )}
                            />
                          </CommandItem>
                        ))
                      }
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
            {form.formState.errors.blockedBy && (
              <p className="text-sm text-destructive">
                {form.formState.errors.blockedBy.message}
              </p>
            )}
          </div>

          {/* Priority Section */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="importance">Importance (1-10)</Label>
              <div className="flex items-center space-x-3">
                <Input
                  id="importance"
                  type="range"
                  min="0"
                  max="10"
                  step="1"
                  disabled={isLoading}
                  {...form.register('importance', { valueAsNumber: true })}
                  className="flex-1"
                />
                <span className="text-sm text-muted-foreground w-8">
                  {form.watch('importance') || 0}
                </span>
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="urgency">Urgency (1-10)</Label>
              <div className="flex items-center space-x-3">
                <Input
                  id="urgency"
                  type="range"
                  min="0"
                  max="10"
                  step="1"
                  disabled={isLoading}
                  {...form.register('urgency', { valueAsNumber: true })}
                  className="flex-1"
                />
                <span className="text-sm text-muted-foreground w-8">
                  {form.watch('urgency') || 0}
                </span>
              </div>
            </div>
            
            {/* Show calculated priority */}
            {(() => {
              const importance = form.watch('importance') || 0;
              const urgency = form.watch('urgency') || 0;
              if (importance > 0 || urgency > 0) {
                let priority;
                // If both values are provided, take the average
                if (importance > 0 && urgency > 0) {
                  priority = Math.round((importance + urgency) / 2);
                } else {
                  // If only one value is provided, use that value directly
                  priority = importance > 0 ? importance : urgency;
                }
                return (
                  <div className="text-sm text-muted-foreground">
                    Combined Priority: <span className="font-medium">P{priority}</span>
                  </div>
                );
              }
              return null;
            })()}
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
