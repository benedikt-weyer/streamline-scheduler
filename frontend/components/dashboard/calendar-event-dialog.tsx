import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { TimeInput, type QuickTimeOption } from '@/components/ui/time-input';
import { Form, FormControl, FormField, FormItem, FormLabel } from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Calendar, CalendarEvent, RecurrenceFrequency, RecurrencePattern } from '@/utils/types';
import { format, parse, isValid, addHours, addMinutes, subHours, subMinutes } from 'date-fns';

import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { useEffect } from 'react';

// Define schema for event validation
export const eventFormSchema = z.object({
  title: z.string().min(1, { message: "Title is required" }),
  description: z.string().optional(),
  calendarId: z.string().min(1, { message: "Calendar is required" }),
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
  }, { message: "Valid end time is required" }),
  // Recurrence fields
  recurrenceFrequency: z.nativeEnum(RecurrenceFrequency).default(RecurrenceFrequency.None),
  recurrenceEndDate: z.string().optional(),
  recurrenceInterval: z.coerce.number().min(1).default(1)
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
  calendars: Calendar[];
  defaultCalendarId?: string;
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
  calendars,
  defaultCalendarId,
  onSubmit, 
  onDelete 
}: CalendarEventDialogProps) {
  // Determine which calendar ID to use
  const initialCalendarId = selectedEvent?.calendarId || defaultCalendarId || 
    (calendars.length > 0 ? calendars.find(cal => cal.isDefault)?.id || calendars[0].id : '');

  // Initialize form with react-hook-form and zod validation
  const form = useForm<EventFormValues>({
    resolver: zodResolver(eventFormSchema),
    defaultValues: {
      title: selectedEvent?.title || '',
      description: selectedEvent?.description || '',
      calendarId: initialCalendarId,
      startDate: selectedEvent ? format(selectedEvent.startTime, "yyyy-MM-dd") : format(new Date(), "yyyy-MM-dd"),
      startTime: selectedEvent ? format(selectedEvent.startTime, "HH:mm") : format(new Date(), "HH:mm"),
      endDate: selectedEvent ? format(selectedEvent.endTime, "yyyy-MM-dd") : format(new Date(), "yyyy-MM-dd"),
      endTime: selectedEvent ? format(selectedEvent.endTime, "HH:mm") : format(new Date(new Date().getTime() + 60 * 60 * 1000), "HH:mm"),
      recurrenceFrequency: selectedEvent?.recurrencePattern?.frequency || RecurrenceFrequency.None,
      recurrenceEndDate: selectedEvent?.recurrencePattern?.endDate 
        ? format(selectedEvent.recurrencePattern.endDate, "yyyy-MM-dd") 
        : '',
      recurrenceInterval: selectedEvent?.recurrencePattern?.interval || 1
    }
  });

  // Reset form when selected event changes
  useEffect(() => {
    const calendarId = selectedEvent?.calendarId || defaultCalendarId || 
      (calendars.length > 0 ? calendars.find(cal => cal.isDefault)?.id || calendars[0].id : '');
      
    form.reset({
      title: selectedEvent?.title || '',
      description: selectedEvent?.description || '',
      calendarId,
      startDate: selectedEvent ? format(selectedEvent.startTime, "yyyy-MM-dd") : format(new Date(), "yyyy-MM-dd"),
      startTime: selectedEvent ? format(selectedEvent.startTime, "HH:mm") : format(new Date(), "HH:mm"),
      endDate: selectedEvent ? format(selectedEvent.endTime, "yyyy-MM-dd") : format(new Date(), "yyyy-MM-dd"),
      endTime: selectedEvent ? format(selectedEvent.endTime, "HH:mm") : format(new Date(new Date().getTime() + 60 * 60 * 1000), "HH:mm"),
      recurrenceFrequency: selectedEvent?.recurrencePattern?.frequency || RecurrenceFrequency.None,
      recurrenceEndDate: selectedEvent?.recurrencePattern?.endDate 
        ? format(selectedEvent.recurrencePattern.endDate, "yyyy-MM-dd") 
        : '',
      recurrenceInterval: selectedEvent?.recurrencePattern?.interval || 1
    });
  }, [selectedEvent, form, calendars, defaultCalendarId]);

  // Handle form submission
  const handleFormSubmit = async (values: EventFormValues) => {
    try {
      console.log("Form values:", values);
      
      // Ensure we have valid strings before proceeding
      if (!values.startDate || !values.startTime || !values.endDate || !values.endTime) {
        console.error("Missing date/time values:", {
          startDate: values.startDate,
          startTime: values.startTime,
          endDate: values.endDate,
          endTime: values.endTime
        });
        return;
      }
      
      // Replace empty recurrenceEndDate with undefined to avoid parsing errors
      if (values.recurrenceFrequency === RecurrenceFrequency.None || !values.recurrenceEndDate) {
        values.recurrenceEndDate = undefined;
      }
      
      // Call the onSubmit callback with the validated form values
      await onSubmit(values);
    } catch (error) {
      console.error("Error submitting form:", error);
    }
  };

  // Helper function to adjust time
  const adjustTime = (timeStr: string, adjustMinutes: number): string => {
    if (!timeStr) return "";
    const date = parse(timeStr, 'HH:mm', new Date());
    if (!isValid(date)) return timeStr;
    
    const adjustedDate = addMinutes(date, adjustMinutes);
    return format(adjustedDate, 'HH:mm');
  };

  // Get relative time options for end time
  const getEndTimeOptions = (): QuickTimeOption[] => {
    const startTime = form.watch('startTime');
    
    if (!startTime) {
      return [
        { value: "09:00" },
        { value: "12:00" },
        { value: "15:00" },
        { value: "18:00" }
      ];
    }
    
    return [
      { value: adjustTime(startTime, 15), label: "15m" },
      { value: adjustTime(startTime, 30), label: "30m" },
      { value: adjustTime(startTime, 60), label: "1h" },
      { value: adjustTime(startTime, 180), label: "3h" }
    ];
  };

  // Create start time quick options
  const startTimeOptions: QuickTimeOption[] = [
    { value: "09:00" },
    { value: "12:00" },
    { value: "15:00" },
    { value: "18:00" }
  ];

  // Get the end time options
  const endTimeOptions = getEndTimeOptions();

  // Get visible calendars for selection
  const visibleCalendars = calendars.filter(calendar => calendar.isVisible);

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{selectedEvent ? 'Edit Event' : 'Add New Event'}</DialogTitle>
          {selectedEvent?.isRecurrenceInstance && (
            <div className="mt-2 text-sm text-amber-600 bg-amber-50 p-2 rounded-md">
              <p>This is a recurring event instance. Changes will affect the entire series.</p>
            </div>
          )}
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
            
            {/* Calendar Selection */}
            <FormField
              control={form.control}
              name="calendarId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Calendar</FormLabel>
                  <Select 
                    onValueChange={field.onChange} 
                    defaultValue={field.value}
                    value={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a calendar" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {calendars.map(calendar => (
                        <SelectItem key={calendar.id} value={calendar.id}>
                          <div className="flex items-center gap-2">
                            <div 
                              className="w-3 h-3 rounded-full" 
                              style={{ backgroundColor: calendar.color }}
                            ></div>
                            <span>{calendar.name}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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
                      <TimeInput 
                        {...field} 
                        quickTimeOptions={startTimeOptions} 
                        onChange={(value) => {
                          field.onChange(value);
                          // Force re-render of end time options when start time changes
                          form.trigger('endTime');
                        }}
                      />
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
                      <TimeInput 
                        {...field} 
                        quickTimeOptions={endTimeOptions}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>

            {/* Recurrence Settings */}
            <div>
              <FormField
                control={form.control}
                name="recurrenceFrequency"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Recurrence</FormLabel>
                    <FormControl>
                      <Select
                        {...field}
                        onValueChange={(value) => {
                          field.onChange(value);
                          // Reset recurrence end date if frequency is changed to none
                          if (value === RecurrenceFrequency.None) {
                            form.setValue('recurrenceEndDate', '');
                          }
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select recurrence" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={RecurrenceFrequency.None}>None</SelectItem>
                          <SelectItem value={RecurrenceFrequency.Daily}>Daily</SelectItem>
                          <SelectItem value={RecurrenceFrequency.Weekly}>Weekly</SelectItem>
                          <SelectItem value={RecurrenceFrequency.Monthly}>Monthly</SelectItem>
                        </SelectContent>
                      </Select>
                    </FormControl>
                  </FormItem>
                )}
              />
              
              {form.watch('recurrenceFrequency') !== RecurrenceFrequency.None && (
                <>
                  <FormField
                    control={form.control}
                    name="recurrenceInterval"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Interval</FormLabel>
                        <FormControl>
                          <Input type="number" min={1} {...field} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="recurrenceEndDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Recurrence End Date</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </>
              )}
            </div>
            
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              {selectedEvent && !selectedEvent.isRecurrenceInstance && (
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