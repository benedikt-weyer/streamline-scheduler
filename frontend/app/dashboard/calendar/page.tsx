'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Form, FormControl, FormField, FormItem, FormLabel } from '@/components/ui/form';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';

import { 
  decryptData, 
  encryptData, 
  generateIV, 
  generateSalt, 
  getHashedPassword, 
  deriveKeyFromPassword 
} from '@/utils/encryption';
import { createClient } from '@/utils/supabase/client';
import { CalendarEvent } from '@/utils/types';

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import Link from 'next/link';
import { format, parse, isValid } from 'date-fns';

import { fetchCalendarEvents, addCalendarEvent, updateCalendarEvent, deleteCalendarEvent } from './actions';

// Define schema for event validation
const eventFormSchema = z.object({
  title: z.string().min(1, { message: "Title is required" }),
  description: z.string().optional(),
  startTime: z.string().refine(value => {
    if (!value) return false;
    const date = parse(value, "yyyy-MM-dd'T'HH:mm", new Date());
    return isValid(date);
  }, { message: "Valid start time is required" }),
  endTime: z.string().refine(value => {
    if (!value) return false;
    const date = parse(value, "yyyy-MM-dd'T'HH:mm", new Date());
    return isValid(date);
  }, { message: "Valid end time is required" })
}).refine(data => {
  const start = parse(data.startTime, "yyyy-MM-dd'T'HH:mm", new Date());
  const end = parse(data.endTime, "yyyy-MM-dd'T'HH:mm", new Date());
  return end > start;
}, {
  message: "End time must be after start time",
  path: ["endTime"]
});

type EventFormValues = z.infer<typeof eventFormSchema>;

export default function CalendarPage() {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [encryptionKey, setEncryptionKey] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);

  // Initialize form with react-hook-form and zod validation
  const form = useForm<EventFormValues>({
    resolver: zodResolver(eventFormSchema),
    defaultValues: {
      title: '',
      description: '',
      startTime: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
      endTime: format(new Date(new Date().getTime() + 60 * 60 * 1000), "yyyy-MM-dd'T'HH:mm")
    }
  });

  // Load encryption key from cookie and fetch events on component mount
  useEffect(() => {
    const hashedPassword = getHashedPassword();
    
    if (!hashedPassword) {
      setError('Please log in again to access your encrypted Calendar');
      setIsLoading(false);
      return;
    }
    
    setEncryptionKey(hashedPassword);
    loadEvents(hashedPassword);
  }, []);

  // Set up real-time subscription to calendar_events changes
  useEffect(() => {
    if (!encryptionKey) return;
    
    // Initialize Supabase client
    const supabase = createClient();
    
    // Subscribe to changes on the calendar_events table
    const subscription = supabase
      .channel('calendar_events_changes')
      .on('postgres_changes', 
        { 
          event: '*', 
          schema: 'public', 
          table: 'calendar_events' 
        }, 
        async (payload) => {
          // Handle different events
          switch(payload.eventType) {
            case 'INSERT':
              // Skip if we already have this event (e.g. from our own insert)
              if (events.some(event => event.id === payload.new.id)) {
                return;
              }
              
              try {
                // Decrypt the new event
                const salt = payload.new.salt;
                const iv = payload.new.iv;
                const derivedKey = deriveKeyFromPassword(encryptionKey, salt);
                const decryptedData = decryptData(payload.new.encrypted_data, derivedKey, iv);
                
                if (!decryptedData) return;
                
                const newEvent: CalendarEvent = {
                  id: payload.new.id,
                  title: decryptedData.title,
                  description: decryptedData.description,
                  startTime: new Date(decryptedData.startTime),
                  endTime: new Date(decryptedData.endTime),
                  createdAt: new Date(payload.new.created_at),
                  updatedAt: payload.new.updated_at ? new Date(payload.new.updated_at) : undefined
                };
                
                setEvents(prevEvents => [...prevEvents, newEvent].sort((a, b) => 
                  a.startTime.getTime() - b.startTime.getTime()
                ));
              } catch (error) {
                console.error('Error processing real-time INSERT:', error);
              }
              break;
              
            case 'UPDATE':
              try {
                // Decrypt the updated event
                const salt = payload.new.salt;
                const iv = payload.new.iv;
                const derivedKey = deriveKeyFromPassword(encryptionKey, salt);
                const decryptedData = decryptData(payload.new.encrypted_data, derivedKey, iv);
                
                if (!decryptedData) return;
                
                setEvents(prevEvents =>
                  prevEvents.map(event =>
                    event.id === payload.new.id
                      ? {
                          ...event,
                          title: decryptedData.title,
                          description: decryptedData.description,
                          startTime: new Date(decryptedData.startTime),
                          endTime: new Date(decryptedData.endTime),
                          updatedAt: payload.new.updated_at ? new Date(payload.new.updated_at) : undefined
                        }
                      : event
                  ).sort((a, b) => a.startTime.getTime() - b.startTime.getTime())
                );
              } catch (error) {
                console.error('Error processing real-time UPDATE:', error);
              }
              break;
              
            case 'DELETE':
              // Remove the deleted event from state
              setEvents(prevEvents => 
                prevEvents.filter(event => event.id !== payload.old.id)
              );
              break;
          }
        }
      )
      .subscribe();
    
    // Clean up the subscription when component unmounts
    return () => {
      supabase.removeChannel(subscription);
    };
  }, [encryptionKey, events]);

  // Load and decrypt events
  const loadEvents = async (key: string) => {
    try {
      setIsLoading(true);
      const encryptedEvents = await fetchCalendarEvents();
      
      const decryptedEvents = encryptedEvents
        .map(event => {
          try {
            const decryptionKey = deriveKeyFromPassword(key, event.salt);
            const decryptedData = decryptData(event.encrypted_data, decryptionKey, event.iv);
            
            if (!decryptedData) return null;
            
            return {
              id: event.id,
              title: decryptedData.title,
              description: decryptedData.description,
              startTime: new Date(decryptedData.startTime),
              endTime: new Date(decryptedData.endTime),
              createdAt: new Date(event.created_at),
              updatedAt: event.updated_at ? new Date(event.updated_at) : undefined
            };
          } catch (error) {
            console.error('Failed to decrypt event:', error);
            return null;
          }
        })
        .filter((event): event is NonNullable<typeof event> => event !== null)
        .sort((a, b) => a.startTime.getTime() - b.startTime.getTime());
      
      setEvents(decryptedEvents);
    } catch (error) {
      console.error('Error loading events:', error);
      setError('Failed to load your Calendar events');
    } finally {
      setIsLoading(false);
    }
  };

  // Add a new event 
  const onSubmit = async (values: EventFormValues) => {
    if (!encryptionKey) return;
    
    try {
      const salt = generateSalt();
      const iv = generateIV();
      const derivedKey = deriveKeyFromPassword(encryptionKey, salt);
      
      const eventData = {
        title: values.title.trim(),
        description: values.description?.trim() || '',
        startTime: parse(values.startTime, "yyyy-MM-dd'T'HH:mm", new Date()).toISOString(),
        endTime: parse(values.endTime, "yyyy-MM-dd'T'HH:mm", new Date()).toISOString()
      };
      
      const encryptedData = encryptData(eventData, derivedKey, iv);
      
      if (selectedEvent) {
        // Update existing event
        const updatedEncryptedEvent = await updateCalendarEvent(selectedEvent.id, encryptedData, iv, salt);
        
        const updatedEvent: CalendarEvent = {
          id: updatedEncryptedEvent.id,
          title: eventData.title,
          description: eventData.description,
          startTime: new Date(eventData.startTime),
          endTime: new Date(eventData.endTime),
          createdAt: new Date(updatedEncryptedEvent.created_at),
          updatedAt: updatedEncryptedEvent.updated_at ? new Date(updatedEncryptedEvent.updated_at) : undefined
        };
        
        setEvents(prevEvents =>
          prevEvents.map(event =>
            event.id === updatedEvent.id ? updatedEvent : event
          ).sort((a, b) => a.startTime.getTime() - b.startTime.getTime())
        );
      } else {
        // Create new event
        const newEncryptedEvent = await addCalendarEvent(encryptedData, iv, salt);
        
        const newEvent: CalendarEvent = {
          id: newEncryptedEvent.id,
          title: eventData.title,
          description: eventData.description,
          startTime: new Date(eventData.startTime),
          endTime: new Date(eventData.endTime),
          createdAt: new Date(newEncryptedEvent.created_at),
          updatedAt: newEncryptedEvent.updated_at ? new Date(newEncryptedEvent.updated_at) : undefined
        };
        
        setEvents(prevEvents => 
          [...prevEvents, newEvent].sort((a, b) => a.startTime.getTime() - b.startTime.getTime())
        );
      }
      
      form.reset();
      setSelectedEvent(null);
      setIsDialogOpen(false);
    } catch (error) {
      console.error('Error saving event:', error);
      setError('Failed to save event');
    }
  };

  // Delete an event
  const handleDeleteEvent = async (id: string) => {
    try {
      await deleteCalendarEvent(id);
      setEvents(prevEvents => prevEvents.filter(event => event.id !== id));
      
      if (selectedEvent?.id === id) {
        setSelectedEvent(null);
        setIsDialogOpen(false);
      }
    } catch (error) {
      console.error('Error deleting event:', error);
      setError('Failed to delete event');
    }
  };

  // Open dialog for editing an event
  const openEditDialog = (event: CalendarEvent) => {
    setSelectedEvent(event);
    
    form.reset({
      title: event.title,
      description: event.description || '',
      startTime: format(event.startTime, "yyyy-MM-dd'T'HH:mm"),
      endTime: format(event.endTime, "yyyy-MM-dd'T'HH:mm")
    });
    
    setIsDialogOpen(true);
  };

  // Open dialog for creating a new event
  const openNewEventDialog = () => {
    setSelectedEvent(null);
    
    form.reset({
      title: '',
      description: '',
      startTime: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
      endTime: format(new Date(new Date().getTime() + 60 * 60 * 1000), "yyyy-MM-dd'T'HH:mm")
    });
    
    setIsDialogOpen(true);
  };

  if (!encryptionKey && !isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] p-4">
        <h1 className="text-2xl font-bold mb-4">Authentication Required</h1>
        <p className="text-center mb-4">
          You need to log in first to access your encrypted Calendar.
        </p>
        <Link href="/sign-in">
          <Button>Sign In</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-4">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Your Calendar</h1>
        <Button onClick={openNewEventDialog}>Add Event</Button>
      </div>
      
      <p className="text-sm text-muted-foreground mb-4">
        Your calendar is encrypted and can only be read with your password.
      </p>
      
      {error && (
        <div className="bg-destructive/10 text-destructive p-3 rounded-md mb-4">
          {error}
        </div>
      )}
      
      {/* Display loading, empty state, or events list */}
      {isLoading && (
        <div className="text-center py-8">Loading your encrypted calendar...</div>
      )}
      
      {!isLoading && events.length === 0 && (
        <div className="text-center py-8 text-muted-foreground">
          Your calendar is empty. Add your first event using the "Add Event" button.
        </div>
      )}
      
      {!isLoading && events.length > 0 && (
        <div className="space-y-4">
          {events.map(event => (
            <div 
              key={event.id} 
              className="p-4 rounded-md border cursor-pointer hover:bg-accent"
              onClick={() => openEditDialog(event)}
            >
              <div className="flex justify-between items-start">
                <h3 className="font-medium">{event.title}</h3>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteEvent(event.id);
                  }}
                  className="text-destructive hover:text-destructive/80"
                >
                  Delete
                </Button>
              </div>
              
              <div className="text-sm text-muted-foreground mt-1">
                {format(event.startTime, "MMM d, yyyy h:mm a")} - {format(event.endTime, "h:mm a")}
              </div>
              
              {event.description && (
                <p className="mt-2 text-sm">{event.description}</p>
              )}
            </div>
          ))}
        </div>
      )}
      
      {/* Event dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
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
                  onClick={() => setIsDialogOpen(false)}
                >
                  Cancel
                </Button>
                {selectedEvent && (
                  <Button
                    type="button"
                    variant="destructive"
                    onClick={() => handleDeleteEvent(selectedEvent.id)}
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
    </div>
  );
}