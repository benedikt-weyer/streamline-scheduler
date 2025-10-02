import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { TimeInput, type QuickTimeOption } from '@/components/ui/time-input';
import { DatePicker } from '@/components/ui/date-picker';
import { Form, FormControl, FormField, FormItem, FormLabel } from '@/components/ui/form';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Calendar, CalendarEvent, RecurrenceFrequency } from '@/utils/calendar/calendar-types';
import { getRecurrencePattern } from '@/utils/calendar/eventDataProcessing';
import { format, parse, isValid, addMinutes } from 'date-fns';

import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, type SubmitHandler } from 'react-hook-form';
import { useEffect, useState } from 'react';
import { DeleteConfirmationDialog } from './delete-confirmation-dialog';
import { RecurringEventModificationDialog } from './recurring-event-modification-dialog';

// Define schema for event validation
export const eventFormSchema = z.object({
  id: z.string().optional(),
  title: z.string().min(1, { message: "Title is required" }),
  description: z.string().optional(),
  location: z.string().optional(),
  calendarId: z.string().min(1, { message: "Calendar is required" }),
  isAllDay: z.boolean().default(false),
  startDate: z.string().refine(value => {
    if (!value) return false;
    const parsed = parse(value, 'yyyy-MM-dd', new Date());
    return isValid(parsed);
  }, { message: "Valid start date is required" }),
  startTime: z.string(),
  endDate: z.string().refine(value => {
    if (!value) return false;
    const parsed = parse(value, 'yyyy-MM-dd', new Date());
    return isValid(parsed);
  }, { message: "Valid end date is required" }),
  endTime: z.string(),
  // Recurrence fields
  recurrenceFrequency: z.nativeEnum(RecurrenceFrequency).default(RecurrenceFrequency.None),
  recurrenceEndDate: z.string().optional(),
  recurrenceInterval: z.coerce.number().min(1).default(1)
}).refine(data => {
  // For all-day events, we don't need time validation
  if (data.isAllDay) {
    // For all-day events, just validate that end date is not before start date
    const startDate = parse(data.startDate, 'yyyy-MM-dd', new Date());
    const endDate = parse(data.endDate, 'yyyy-MM-dd', new Date());
    
    if (!isValid(startDate) || !isValid(endDate)) {
      return false;
    }
    
    return endDate >= startDate;
  }
  
  // For timed events, validate both date and time
  if (!data.startTime || !data.endTime) {
    return false;
  }
  
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
  readonly isOpen: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly selectedEvent: CalendarEvent | null;
  readonly calendars: Calendar[];
  readonly defaultCalendarId?: string;
  readonly onSubmit: (values: EventFormValues) => Promise<void>;
  readonly onDelete: (id: string) => Promise<void>;
  readonly onClone?: (event: CalendarEvent) => void;
  readonly onDeleteAllInSeries?: (event: CalendarEvent) => Promise<void>;
  readonly onDeleteThisAndFuture?: (event: CalendarEvent) => Promise<void>;
  readonly onDeleteThisOccurrence?: (event: CalendarEvent) => Promise<void>;
  readonly onModifyAllInSeries?: (event: CalendarEvent, modifiedData: any) => Promise<void>;
  readonly onModifyThisAndFuture?: (event: CalendarEvent, modifiedData: any) => Promise<void>;
  readonly onModifyThisOccurrence?: (event: CalendarEvent, modifiedData: any) => Promise<void>;
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
  onDelete, 
  onClone,
  onDeleteAllInSeries, 
  onDeleteThisAndFuture, 
  onDeleteThisOccurrence,
  onModifyAllInSeries,
  onModifyThisAndFuture,
  onModifyThisOccurrence
}: CalendarEventDialogProps) {
  // Determine which calendar ID to use
  const initialCalendarId = selectedEvent?.calendar_id ?? defaultCalendarId ?? 
    (calendars.length > 0 ? calendars.find(cal => cal.is_default)?.id ?? calendars[0].id : '');

  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [isModificationConfirmOpen, setIsModificationConfirmOpen] = useState(false);
  const [pendingModificationData, setPendingModificationData] = useState<EventFormValues | null>(null);
  
  // Check if this is an ICS event (read-only)
  const isICSEvent = selectedEvent?.id?.startsWith('ics-') ?? false;
  const selectedCalendar = calendars.find(cal => cal.id === selectedEvent?.calendar_id);
  const isReadOnly = isICSEvent;

  // Initialize form with react-hook-form and zod validation
  const form = useForm({
    resolver: zodResolver(eventFormSchema),
    defaultValues: {
      id: selectedEvent?.id,
      title: selectedEvent?.title ?? '',
      description: selectedEvent?.description ?? '',
      location: selectedEvent?.location ?? '',
      calendarId: initialCalendarId,
      isAllDay: selectedEvent?.all_day ?? false,
      startDate: selectedEvent ? format(new Date(selectedEvent.start_time), "yyyy-MM-dd") : format(new Date(), "yyyy-MM-dd"),
      startTime: selectedEvent ? format(new Date(selectedEvent.start_time), "HH:mm") : format(new Date(), "HH:mm"),
      endDate: selectedEvent ? format(new Date(selectedEvent.end_time), "yyyy-MM-dd") : format(new Date(), "yyyy-MM-dd"),
      endTime: selectedEvent ? format(new Date(selectedEvent.end_time), "HH:mm") : format(new Date(new Date().getTime() + 60 * 60 * 1000), "HH:mm"),
      recurrenceFrequency: selectedEvent ? (getRecurrencePattern(selectedEvent)?.frequency ?? RecurrenceFrequency.None) : RecurrenceFrequency.None,
      recurrenceEndDate: selectedEvent && getRecurrencePattern(selectedEvent)?.endDate 
        ? format(getRecurrencePattern(selectedEvent)!.endDate!, "yyyy-MM-dd") 
        : '',
      recurrenceInterval: selectedEvent ? (getRecurrencePattern(selectedEvent)?.interval ?? 1) : 1
    }
  });

  // Reset form when selected event changes
  useEffect(() => {
    const calendarId = selectedEvent?.calendar_id ?? defaultCalendarId ?? 
      (calendars.length > 0 ? calendars.find(cal => cal.is_default)?.id ?? calendars[0].id : '');
      
    form.reset({
      id: selectedEvent?.id,
      title: selectedEvent?.title ?? '',
      description: selectedEvent?.description ?? '',
      location: selectedEvent?.location ?? '',
      calendarId,
      isAllDay: selectedEvent?.all_day ?? false,
      startDate: selectedEvent ? format(new Date(selectedEvent.start_time), "yyyy-MM-dd") : format(new Date(), "yyyy-MM-dd"),
      startTime: selectedEvent ? format(new Date(selectedEvent.start_time), "HH:mm") : format(new Date(), "HH:mm"),
      endDate: selectedEvent ? format(new Date(selectedEvent.end_time), "yyyy-MM-dd") : format(new Date(), "yyyy-MM-dd"),
      endTime: selectedEvent ? format(new Date(selectedEvent.end_time), "HH:mm") : format(new Date(new Date().getTime() + 60 * 60 * 1000), "HH:mm"),
      recurrenceFrequency: selectedEvent ? (getRecurrencePattern(selectedEvent)?.frequency ?? RecurrenceFrequency.None) : RecurrenceFrequency.None,
      recurrenceEndDate: selectedEvent && getRecurrencePattern(selectedEvent)?.endDate 
        ? format(getRecurrencePattern(selectedEvent)!.endDate!, "yyyy-MM-dd") 
        : '',
      recurrenceInterval: selectedEvent ? (getRecurrencePattern(selectedEvent)?.interval ?? 1) : 1
    });
  }, [selectedEvent, form, calendars, defaultCalendarId]);

  // Handle form submission
  const handleFormSubmit: SubmitHandler<EventFormValues> = async (values) => {
    try {
      // console.log("Form values:", values); // Comment out or remove this log
      
      // Ensure we have valid strings before proceeding
      if (!values.startDate || !values.endDate) {
        console.error("Missing date values:", {
          startDate: values.startDate,
          endDate: values.endDate
        });
        return;
      }

      // For all-day events, ensure we have time values
      if (values.isAllDay) {
        if (!values.startTime) {
          values.startTime = '00:00';
        }
        if (!values.endTime) {
          values.endTime = '23:59';
        }
      } else {
        // For non all-day events, ensure we have time values
        if (!values.startTime || !values.endTime) {
          console.error("Missing time values for timed event:", {
            startTime: values.startTime,
            endTime: values.endTime
          });
          return;
        }
      }
      
      // Replace empty recurrenceEndDate with undefined to avoid parsing errors
      if (values.recurrenceFrequency === RecurrenceFrequency.None || !values.recurrenceEndDate) {
        values.recurrenceEndDate = undefined;
      }

      // Check if this is a modification of a recurring event
      const recurrencePattern = selectedEvent ? getRecurrencePattern(selectedEvent) : null;
      const isRecurringEvent = recurrencePattern && 
        recurrencePattern.frequency !== RecurrenceFrequency.None;
      const isEditingExistingEvent = selectedEvent && selectedEvent.id && selectedEvent.id !== 'new';

      if (isEditingExistingEvent && isRecurringEvent && 
          (onModifyAllInSeries || onModifyThisAndFuture || onModifyThisOccurrence)) {
        
        // Check if recurrence settings have been changed
        const originalFrequency = recurrencePattern?.frequency || RecurrenceFrequency.None;
        const originalInterval = recurrencePattern?.interval || 1;
        const originalEndDate = recurrencePattern?.endDate;
        
        // Normalize end dates for comparison
        const normalizedOriginalEndDate = originalEndDate ? format(new Date(originalEndDate), "yyyy-MM-dd") : '';
        const normalizedNewEndDate = values.recurrenceEndDate || '';
        
        const hasRecurrenceChanges = 
          values.recurrenceFrequency !== originalFrequency ||
          values.recurrenceInterval !== originalInterval ||
          normalizedNewEndDate !== normalizedOriginalEndDate;
        
        if (hasRecurrenceChanges) {
          // For recurrence setting changes, automatically modify all in series
          if (onModifyAllInSeries) {
            await onModifyAllInSeries(selectedEvent, values);
            return;
          }
        }
        
        // For other changes, show the modification choice modal
        setPendingModificationData(values);
        setIsModificationConfirmOpen(true);
        return;
      }
      
      // Call the onSubmit callback with the validated form values for non-recurring events
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

  // Handlers for recurring event modification
  const handleModifyThisOccurrenceConfirmed = async (event: CalendarEvent) => {
    if (pendingModificationData && onModifyThisOccurrence) {
      const modifiedData = {
        title: pendingModificationData.title,
        description: pendingModificationData.description,
        location: pendingModificationData.location,
        calendarId: pendingModificationData.calendarId,
        startTime: combineDateAndTime(pendingModificationData.startDate, pendingModificationData.startTime || '00:00'),
        endTime: combineDateAndTime(pendingModificationData.endDate, pendingModificationData.endTime || '23:59')
      };
      await onModifyThisOccurrence(event, modifiedData);
    }
  };

  const handleModifyThisAndFutureConfirmed = async (event: CalendarEvent) => {
    if (pendingModificationData && onModifyThisAndFuture) {
      const modifiedData = {
        title: pendingModificationData.title,
        description: pendingModificationData.description,
        location: pendingModificationData.location,
        calendarId: pendingModificationData.calendarId,
        startTime: combineDateAndTime(pendingModificationData.startDate, pendingModificationData.startTime || '00:00'),
        endTime: combineDateAndTime(pendingModificationData.endDate, pendingModificationData.endTime || '23:59')
      };
      await onModifyThisAndFuture(event, modifiedData);
    }
  };

  const handleModifyAllInSeriesConfirmed = async (event: CalendarEvent) => {
    if (pendingModificationData && onModifyAllInSeries) {
      const modifiedData = {
        title: pendingModificationData.title,
        description: pendingModificationData.description,
        location: pendingModificationData.location,
        calendarId: pendingModificationData.calendarId,
        startTime: combineDateAndTime(pendingModificationData.startDate, pendingModificationData.startTime || '00:00'),
        endTime: combineDateAndTime(pendingModificationData.endDate, pendingModificationData.endTime || '23:59')
      };
      await onModifyAllInSeries(event, modifiedData);
    }
  };

  const handleModificationConfirmed = () => {
    setPendingModificationData(null);
    onOpenChange(false);
  };

  const handleDeleteConfirmedAndCloseMainDialog = () => {
    onOpenChange(false);
  };

  const handleMainDialogInteractOutside = (event: Event) => {
    if (isDeleteConfirmOpen) {
      event.preventDefault();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent onInteractOutside={handleMainDialogInteractOutside}>
        <DialogHeader>
          <DialogTitle>
            {isReadOnly ? 'View Event' : (selectedEvent ? 'Edit Event' : 'Add New Event')}
          </DialogTitle>
          {isReadOnly && (
            <div className="mt-2 text-sm text-blue-600 bg-blue-50 p-2 rounded-md">
              <p>This event is from an ICS calendar and cannot be edited.</p>
            </div>
          )}
          {selectedEvent?.id?.includes('-recurrence-') && !isReadOnly && (
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
                    <Input placeholder="Event title" {...field} disabled={isReadOnly} />
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
                    <Textarea placeholder="Event description" {...field} disabled={isReadOnly} />
                  </FormControl>
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="location"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Location (optional)</FormLabel>
                  <FormControl>
                    <Input placeholder="Event location" {...field} disabled={isReadOnly} />
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
                    disabled={isReadOnly}
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
            
            {/* All-Day Toggle */}
            <FormField
              control={form.control}
              name="isAllDay"
              render={({ field }) => (
                <FormItem>
                  <div 
                    className="flex flex-row items-center justify-between w-full rounded-lg border bg-card p-3 shadow-sm cursor-pointer hover:bg-muted/50 transition-colors"
                    onClick={() => {
                      if (!isReadOnly) {
                        field.onChange(!field.value);
                      }
                    }}
                  >
                    <FormLabel 
                      className="text-sm font-medium cursor-pointer select-none"
                    >
                      All Day
                    </FormLabel>
                    <div onClick={(e) => e.stopPropagation()} className="flex items-center">
                      <Checkbox
                        onCheckedChange={field.onChange}
                        checked={field.value}
                        disabled={isReadOnly}
                      />
                    </div>
                  </div>
                </FormItem>
              )}
            />

            {/* Start Date and Time */}
            <div className={`grid ${form.watch('isAllDay') ? 'grid-cols-1' : 'grid-cols-2'} gap-4`}>
              <FormField
                control={form.control}
                name="startDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Start Date</FormLabel>
                    <FormControl>
                      <DatePicker 
                        value={field.value} 
                        onChange={field.onChange} 
                        disabled={isReadOnly}
                        placeholder="Select start date"
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
              
              {!form.watch('isAllDay') && (
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
                          disabled={isReadOnly}
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
              )}
            </div>
            
            {/* End Date and Time */}
            <div className={`grid ${form.watch('isAllDay') ? 'grid-cols-1' : 'grid-cols-2'} gap-4`}>
              <FormField
                control={form.control}
                name="endDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>End Date</FormLabel>
                    <FormControl>
                      <DatePicker 
                        value={field.value} 
                        onChange={field.onChange} 
                        disabled={isReadOnly}
                        placeholder="Select end date"
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
              
              {!form.watch('isAllDay') && (
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
                          disabled={isReadOnly}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
              )}
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
                        disabled={isReadOnly}
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
                          <SelectItem value={RecurrenceFrequency.Yearly}>Yearly</SelectItem>
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
                          <Input type="number" min={1} {...field} disabled={isReadOnly} />
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
                          <Input type="date" {...field} disabled={isReadOnly} />
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
                {isReadOnly ? 'Close' : 'Cancel'}
              </Button>
              {selectedEvent && onClone && (
                <Button
                  type="button"
                  variant="secondary"
                  onClick={(e) => {
                    e.stopPropagation();
                    onClone(selectedEvent);
                    onOpenChange(false);
                  }}
                >
                  Clone
                </Button>
              )}
              {selectedEvent && !isReadOnly && (
                <>
                  {getRecurrencePattern(selectedEvent)?.frequency !== RecurrenceFrequency.None ? (
                    // This event is part of a recurrence series (either master or an instance view of master)
                    <Button
                      type="button"
                      variant="destructive"
                      onClick={(e) => {
                        e.stopPropagation();
                        setIsDeleteConfirmOpen(true);
                      }}
                    >
                      Delete
                    </Button>
                  ) : (
                    // For non-recurring events (or events where recurrence is explicitly None)
                    <Button
                      type="button"
                      variant="destructive"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDelete(selectedEvent.id);
                      }}
                    >
                      Delete
                    </Button>
                  )}
                </>
              )}
              {!isReadOnly && (
                <Button type="submit">
                  {selectedEvent ? 'Update' : 'Add'} Event
                </Button>
              )}
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
      {selectedEvent && onDeleteAllInSeries && onDeleteThisAndFuture && onDeleteThisOccurrence && (
        <DeleteConfirmationDialog
          isOpen={isDeleteConfirmOpen}
          onOpenChange={setIsDeleteConfirmOpen}
          selectedEvent={selectedEvent}
          onDeleteThisOccurrence={onDeleteThisOccurrence}
          onDeleteThisAndFuture={onDeleteThisAndFuture}
          onDeleteAllInSeries={onDeleteAllInSeries}
          onDeleteConfirmedAndMainDialogClose={handleDeleteConfirmedAndCloseMainDialog}
        />
      )}
      {selectedEvent && onModifyAllInSeries && onModifyThisAndFuture && onModifyThisOccurrence && (
        <RecurringEventModificationDialog
          isOpen={isModificationConfirmOpen}
          onOpenChange={setIsModificationConfirmOpen}
          selectedEvent={selectedEvent}
          onModifyThisOccurrence={handleModifyThisOccurrenceConfirmed}
          onModifyThisAndFuture={handleModifyThisAndFutureConfirmed}
          onModifyAllInSeries={handleModifyAllInSeriesConfirmed}
          onModificationConfirmed={handleModificationConfirmed}
        />
      )}
    </Dialog>
  );
}