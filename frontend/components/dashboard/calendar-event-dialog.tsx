import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Form, FormControl, FormField, FormItem, FormLabel } from '@/components/ui/form';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { CalendarEvent } from '@/utils/types';
import { format, parse, isValid } from 'date-fns';

import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { useEffect } from 'react';

// Define schema for event validation
export const eventFormSchema = z.object({
  title: z.string().min(1, { message: "Title is required" }),
  description: z.string().optional(),
  startDate: z.string().refine(value => {
    if (!value) return false;
    const parsed = parse(value, 'yyyy-MM-dd', new Date());
    return isValid(parsed);
  }, { message: "Valid start date is required" }),
  startTime: z.string().refine(value => {
    if (!value) return false;
    const parsed = parse(value, 'HH:mm', new Date());
    return isValid(parsed);
  }, { message: "Valid start time is required" }),
  endDate: z.string().refine(value => {
    if (!value) return false;
    const parsed = parse(value, 'yyyy-MM-dd', new Date());
    return isValid(parsed);
  }, { message: "Valid end date is required" }),
  endTime: z.string().refine(value => {
    if (!value) return false;
    const parsed = parse(value, 'HH:mm', new Date());
    return isValid(parsed);
  }, { message: "Valid end time is required" })
}).refine(data => {
  // Combine date and time to create complete datetime for validation
  const startDate = parse(data.startDate, 'yyyy-MM-dd', new Date());
  const startTime = parse(data.startTime, 'HH:mm', new Date());
  const endDate = parse(data.endDate, 'yyyy-MM-dd', new Date());
  const endTime = parse(data.endTime, 'HH:mm', new Date());
  
  if (!isValid(startDate) || !isValid(startTime) || !isValid(endDate) || !isValid(endTime)) {
    return false;
  }
  
  const start = new Date(
    startDate.getFullYear(), 
    startDate.getMonth(), 
    startDate.getDate(), 
    startTime.getHours(), 
    startTime.getMinutes()
  );
  
  const end = new Date(
    endDate.getFullYear(), 
    endDate.getMonth(), 
    endDate.getDate(), 
    endTime.getHours(), 
    endTime.getMinutes()
  );
  
  return end > start;
}, {
  message: "End date/time must be after start date/time",
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

// Helper function to combine date and time into a single Date object
const combineDateAndTime = (dateStr: string, timeStr: string): Date => {
  const datePart = parse(dateStr, 'yyyy-MM-dd', new Date());
  const timePart = parse(timeStr, 'HH:mm', new Date());
  
  return new Date(
    datePart.getFullYear(),
    datePart.getMonth(),
    datePart.getDate(),
    timePart.getHours(),
    timePart.getMinutes()
  );
};

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
      startDate: selectedEvent ? format(selectedEvent.startTime, "yyyy-MM-dd") : format(new Date(), "yyyy-MM-dd"),
      startTime: selectedEvent ? format(selectedEvent.startTime, "HH:mm") : format(new Date(), "HH:mm"),
      endDate: selectedEvent ? format(selectedEvent.endTime, "yyyy-MM-dd") : format(new Date(), "yyyy-MM-dd"),
      endTime: selectedEvent ? format(selectedEvent.endTime, "HH:mm") : format(new Date(new Date().getTime() + 60 * 60 * 1000), "HH:mm")
    }
  });

  // Reset form when selected event changes
  useEffect(() => {
    form.reset({
      title: selectedEvent?.title || '',
      description: selectedEvent?.description || '',
      startDate: selectedEvent ? format(selectedEvent.startTime, "yyyy-MM-dd") : format(new Date(), "yyyy-MM-dd"),
      startTime: selectedEvent ? format(selectedEvent.startTime, "HH:mm") : format(new Date(), "HH:mm"),
      endDate: selectedEvent ? format(selectedEvent.endTime, "yyyy-MM-dd") : format(new Date(), "yyyy-MM-dd"),
      endTime: selectedEvent ? format(selectedEvent.endTime, "HH:mm") : format(new Date(new Date().getTime() + 60 * 60 * 1000), "HH:mm")
    });
  }, [selectedEvent, form]);

  // Handle form submission
  const handleFormSubmit = async (values: EventFormValues) => {
    // Convert the separate date and time fields into datetime strings for the API
    const startDateTime = combineDateAndTime(values.startDate, values.startTime);
    const endDateTime = combineDateAndTime(values.endDate, values.endTime);
    
    // Create the event data for submission
    const eventData = {
      title: values.title,
      description: values.description || '',
      startTime: startDateTime.toISOString(),
      endTime: endDateTime.toISOString()
    };
    
    // Call the onSubmit callback with the event data
    await onSubmit(eventData as any);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{selectedEvent ? 'Edit Event' : 'Add New Event'}</DialogTitle>
        </DialogHeader>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleFormSubmit)} className="space-y-4">
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
            
            {/* Start Date and Time */}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="startDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Start Date</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="startTime"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Start Time</FormLabel>
                    <FormControl>
                      <Input type="time" {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>
            
            {/* End Date and Time */}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="endDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>End Date</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
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
                      <Input type="time" {...field} />
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