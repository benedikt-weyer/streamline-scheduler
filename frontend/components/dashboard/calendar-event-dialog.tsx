import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Form, FormControl, FormField, FormItem, FormLabel } from '@/components/ui/form';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { CalendarEvent } from '@/utils/types';
import { format } from 'date-fns';

import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { useEffect } from 'react';

// Define schema for event validation
export const eventFormSchema = z.object({
  title: z.string().min(1, { message: "Title is required" }),
  description: z.string().optional(),
  startTime: z.string().refine(value => {
    if (!value) return false;
    const parsed = new Date(value);
    return !isNaN(parsed.getTime());
  }, { message: "Valid start time is required" }),
  endTime: z.string().refine(value => {
    if (!value) return false;
    const parsed = new Date(value);
    return !isNaN(parsed.getTime());
  }, { message: "Valid end time is required" })
}).refine(data => {
  const start = new Date(data.startTime);
  const end = new Date(data.endTime);
  return end > start;
}, {
  message: "End time must be after start time",
  path: ["endTime"]
});

export type EventFormValues = z.infer<typeof eventFormSchema>;

interface CalendarEventDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  selectedEvent: CalendarEvent | null;
  onSubmit: (values: EventFormValues) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

export function CalendarEventDialog({ 
  isOpen, 
  onOpenChange, 
  selectedEvent, 
  onSubmit, 
  onDelete 
}: CalendarEventDialogProps) {
  // Initialize form with react-hook-form and zod validation
  const form = useForm<EventFormValues>({
    resolver: zodResolver(eventFormSchema),
    defaultValues: {
      title: selectedEvent?.title || '',
      description: selectedEvent?.description || '',
      startTime: selectedEvent ? format(selectedEvent.startTime, "yyyy-MM-dd'T'HH:mm") : format(new Date(), "yyyy-MM-dd'T'HH:mm"),
      endTime: selectedEvent ? format(selectedEvent.endTime, "yyyy-MM-dd'T'HH:mm") : format(new Date(new Date().getTime() + 60 * 60 * 1000), "yyyy-MM-dd'T'HH:mm")
    }
  });

  // Reset form when selected event changes
  useEffect(() => {
    form.reset({
      title: selectedEvent?.title || '',
      description: selectedEvent?.description || '',
      startTime: selectedEvent ? format(selectedEvent.startTime, "yyyy-MM-dd'T'HH:mm") : format(new Date(), "yyyy-MM-dd'T'HH:mm"),
      endTime: selectedEvent ? format(selectedEvent.endTime, "yyyy-MM-dd'T'HH:mm") : format(new Date(new Date().getTime() + 60 * 60 * 1000), "yyyy-MM-dd'T'HH:mm")
    });
  }, [selectedEvent, form]);

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{selectedEvent ? 'Edit Event' : 'Add New Event'}</DialogTitle>
        </DialogHeader>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Title</FormLabel>
                  <FormControl>
                    <Input placeholder="Event title" {...field} />
                  </FormControl>
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description (optional)</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Event description" {...field} />
                  </FormControl>
                </FormItem>
              )}
            />
            
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="startTime"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Start Time</FormLabel>
                    <FormControl>
                      <Input type="datetime-local" {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="endTime"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>End Time</FormLabel>
                    <FormControl>
                      <Input type="datetime-local" {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>
            
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              {selectedEvent && (
                <Button
                  type="button"
                  variant="destructive"
                  onClick={() => onDelete(selectedEvent.id)}
                >
                  Delete
                </Button>
              )}
              <Button type="submit">
                {selectedEvent ? 'Update' : 'Add'} Event
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}