'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { parse, startOfWeek, isValid } from 'date-fns';

import { CalendarHeader } from '@/components/dashboard/calendar-header';
import { CalendarGrid } from '@/components/dashboard/calendar-grid';
import { CalendarEventDialog, EventFormValues } from '@/components/dashboard/calendar-event-dialog';

import { getDaysOfWeek, filterEventsForWeek } from '@/utils/calendar';
import { 
  decryptData, 
  encryptData, 
  generateIV, 
  generateSalt, 
  getHashedPassword, 
  deriveKeyFromPassword 
} from '@/utils/encryption';
import { createClient } from '@/utils/supabase/client';
import { CalendarEvent, RecurrenceFrequency, RecurrencePattern } from '@/utils/types';
import { fetchCalendarEvents, addCalendarEvent, updateCalendarEvent, deleteCalendarEvent } from './actions';

export default function CalendarPage() {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [encryptionKey, setEncryptionKey] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [currentWeek, setCurrentWeek] = useState<Date>(startOfWeek(new Date(), { weekStartsOn: 1 })); // Start on Monday

  // Helper function to combine date and time into a single Date object
  const combineDateAndTime = (dateStr: string, timeStr: string): Date => {
    // Make sure we have valid strings before parsing
    if (!dateStr || !timeStr) {
      console.error("Invalid date or time string:", { dateStr, timeStr });
      return new Date(); // Return current date as fallback
    }
    
    try {
      const datePart = parse(dateStr, 'yyyy-MM-dd', new Date());
      const timePart = parse(timeStr, 'HH:mm', new Date());
      
      if (!isValid(datePart) || !isValid(timePart)) {
        console.error("Invalid parsed date or time:", { datePart, timePart });
        return new Date(); // Return current date as fallback
      }
      
      return new Date(
        datePart.getFullYear(),
        datePart.getMonth(),
        datePart.getDate(),
        timePart.getHours(),
        timePart.getMinutes()
      );
    } catch (error) {
      console.error("Error parsing date or time:", error);
      return new Date(); // Return current date as fallback
    }
  };

  // Get days of the current week
  const daysOfWeek = getDaysOfWeek(currentWeek);
  
  // Filter events for the current week
  const eventsInCurrentWeek = filterEventsForWeek(events, currentWeek);

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
                
                // Construct recurrence pattern if it exists
                let recurrencePattern: RecurrencePattern | undefined;
                if (decryptedData.recurrenceFrequency && 
                    decryptedData.recurrenceFrequency !== RecurrenceFrequency.None) {
                  recurrencePattern = {
                    frequency: decryptedData.recurrenceFrequency,
                    endDate: decryptedData.recurrenceEndDate ? new Date(decryptedData.recurrenceEndDate) : undefined,
                    interval: decryptedData.recurrenceInterval || 1,
                    daysOfWeek: decryptedData.daysOfWeek
                  };
                }
                
                const newEvent: CalendarEvent = {
                  id: payload.new.id,
                  title: decryptedData.title,
                  description: decryptedData.description,
                  startTime: new Date(decryptedData.startTime),
                  endTime: new Date(decryptedData.endTime),
                  createdAt: new Date(payload.new.created_at),
                  updatedAt: payload.new.updated_at ? new Date(payload.new.updated_at) : undefined,
                  recurrencePattern
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
                
                // Construct recurrence pattern if it exists
                let recurrencePattern: RecurrencePattern | undefined;
                if (decryptedData.recurrenceFrequency && 
                    decryptedData.recurrenceFrequency !== RecurrenceFrequency.None) {
                  recurrencePattern = {
                    frequency: decryptedData.recurrenceFrequency,
                    endDate: decryptedData.recurrenceEndDate ? new Date(decryptedData.recurrenceEndDate) : undefined,
                    interval: decryptedData.recurrenceInterval || 1,
                    daysOfWeek: decryptedData.daysOfWeek
                  };
                }
                
                setEvents(prevEvents =>
                  prevEvents.map(event =>
                    event.id === payload.new.id
                      ? {
                          ...event,
                          title: decryptedData.title,
                          description: decryptedData.description,
                          startTime: new Date(decryptedData.startTime),
                          endTime: new Date(decryptedData.endTime),
                          updatedAt: payload.new.updated_at ? new Date(payload.new.updated_at) : undefined,
                          recurrencePattern
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
            
            // Construct recurrence pattern if it exists
            let recurrencePattern: RecurrencePattern | undefined;
            if (decryptedData.recurrenceFrequency && 
                decryptedData.recurrenceFrequency !== RecurrenceFrequency.None) {
              recurrencePattern = {
                frequency: decryptedData.recurrenceFrequency,
                endDate: decryptedData.recurrenceEndDate ? new Date(decryptedData.recurrenceEndDate) : undefined,
                interval: decryptedData.recurrenceInterval || 1,
                daysOfWeek: decryptedData.daysOfWeek
              };
            }
            
            return {
              id: event.id,
              title: decryptedData.title,
              description: decryptedData.description,
              startTime: new Date(decryptedData.startTime),
              endTime: new Date(decryptedData.endTime),
              createdAt: new Date(event.created_at),
              updatedAt: event.updated_at ? new Date(event.updated_at) : undefined,
              recurrencePattern
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

  // Add a new event or update existing one
  const handleSubmitEvent = async (values: EventFormValues) => {
    if (!encryptionKey) return;
    
    try {
      const salt = generateSalt();
      const iv = generateIV();
      const derivedKey = deriveKeyFromPassword(encryptionKey, salt);
      
      // Convert the separate date and time fields into datetime objects
      const startDateTime = combineDateAndTime(values.startDate, values.startTime);
      const endDateTime = combineDateAndTime(values.endDate, values.endTime);
      
      // Create recurrence pattern if specified
      let recurrencePattern: RecurrencePattern | undefined;
      if (values.recurrenceFrequency && values.recurrenceFrequency !== RecurrenceFrequency.None) {
        recurrencePattern = {
          frequency: values.recurrenceFrequency,
          endDate: values.recurrenceEndDate ? new Date(values.recurrenceEndDate) : undefined,
          interval: values.recurrenceInterval || 1
        };
      }
      
      // The data to be encrypted and stored
      const eventData = {
        title: values.title.trim(),
        description: values.description?.trim() ?? '',
        startTime: startDateTime.toISOString(),
        endTime: endDateTime.toISOString(),
        recurrenceFrequency: values.recurrenceFrequency,
        recurrenceEndDate: values.recurrenceEndDate ? new Date(values.recurrenceEndDate).toISOString() : undefined,
        recurrenceInterval: values.recurrenceInterval
      };
      
      const encryptedData = encryptData(eventData, derivedKey, iv);
      
      if (selectedEvent && selectedEvent.id !== 'new') {
        // Update existing event
        const updatedEncryptedEvent = await updateCalendarEvent(selectedEvent.id, encryptedData, iv, salt);
        
        const updatedEvent: CalendarEvent = {
          id: updatedEncryptedEvent.id,
          title: eventData.title,
          description: eventData.description,
          startTime: startDateTime,
          endTime: endDateTime,
          createdAt: new Date(updatedEncryptedEvent.created_at),
          updatedAt: updatedEncryptedEvent.updated_at ? new Date(updatedEncryptedEvent.updated_at) : undefined,
          recurrencePattern
        };
        
        setEvents(prevEvents =>
          prevEvents.map(event =>
            event.id === updatedEvent.id ? updatedEvent : event
          ).sort((a, b) => a.startTime.getTime() - b.startTime.getTime())
        );
      } else {
        // Create new event (either no selected event or id is 'new')
        const newEncryptedEvent = await addCalendarEvent(encryptedData, iv, salt);
        
        const newEvent: CalendarEvent = {
          id: newEncryptedEvent.id,
          title: eventData.title,
          description: eventData.description,
          startTime: startDateTime,
          endTime: endDateTime,
          createdAt: new Date(newEncryptedEvent.created_at),
          updatedAt: newEncryptedEvent.updated_at ? new Date(newEncryptedEvent.updated_at) : undefined,
          recurrencePattern
        };
        
        setEvents(prevEvents => 
          [...prevEvents, newEvent].sort((a, b) => a.startTime.getTime() - b.startTime.getTime())
        );
      }
      
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

  // Handle event update when dragged
  const handleEventUpdate = async (updatedEvent: CalendarEvent) => {
    if (!encryptionKey) return;
    
    try {
      const salt = generateSalt();
      const iv = generateIV();
      const derivedKey = deriveKeyFromPassword(encryptionKey, salt);
      
      // Get the original event to preserve recurrence pattern
      const originalEvent = events.find(e => e.id === updatedEvent.id);
      
      // Preserve recurrence pattern from the original event if it exists
      const recurrencePattern = originalEvent?.recurrencePattern;
      
      const eventData = {
        title: updatedEvent.title,
        description: updatedEvent.description ?? '',
        startTime: updatedEvent.startTime.toISOString(),
        endTime: updatedEvent.endTime.toISOString(),
        recurrenceFrequency: recurrencePattern?.frequency,
        recurrenceEndDate: recurrencePattern?.endDate?.toISOString(),
        recurrenceInterval: recurrencePattern?.interval,
        daysOfWeek: recurrencePattern?.daysOfWeek
      };
      
      const encryptedData = encryptData(eventData, derivedKey, iv);
      
      // Update the event in the database
      await updateCalendarEvent(updatedEvent.id, encryptedData, iv, salt);
      
      // Local state update with preserved recurrence pattern
      setEvents(prevEvents =>
        prevEvents.map(event =>
          event.id === updatedEvent.id ? {
            ...updatedEvent,
            recurrencePattern
          } : event
        ).sort((a, b) => a.startTime.getTime() - b.startTime.getTime())
      );
    } catch (error) {
      console.error('Error updating dragged event:', error);
      setError('Failed to update event position');
    }
  };

  // Open dialog for editing an event
  const openEditDialog = (event: CalendarEvent) => {
    setSelectedEvent(event);
    setIsDialogOpen(true);
  };

  // Open dialog for creating a new event
  const openNewEventDialog = (day?: Date) => {
    setSelectedEvent(null);
    
    // If a day is provided, set the start time to the clicked time
    if (day) {
      const startTime = new Date(day);
      
      // Set end time to be 1 hour after start time
      const endTime = new Date(startTime);
      endTime.setHours(endTime.getHours() + 1);
      
      // Create a temporary "dummy" event to pass to the form
      const dummyEvent: CalendarEvent = {
        id: 'new', // This ID will never be used, it's just for the temporary object
        title: '',
        description: '',
        startTime: startTime,
        endTime: endTime,
        createdAt: new Date()
      };
      
      // Set as selected event to prefill the form with these times
      setSelectedEvent(dummyEvent);
    }
    
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
    <div className="w-full px-4">
      <CalendarHeader 
        currentWeek={currentWeek}
        setCurrentWeek={setCurrentWeek}
        openNewEventDialog={() => openNewEventDialog()}
      />
      
      {error && (
        <div className="bg-destructive/10 text-destructive p-3 rounded-md mb-4">
          {error}
        </div>
      )}
      
      {/* Display loading or calendar grid */}
      {isLoading ? (
        <div className="text-center py-8">Loading your encrypted calendar...</div>
      ) : (
        <div className="h-full">
          <CalendarGrid 
            days={daysOfWeek}
            events={eventsInCurrentWeek}
            openEditDialog={openEditDialog}
            openNewEventDialog={openNewEventDialog}
            onEventUpdate={handleEventUpdate}
          />
        </div>
      )}
      
      {/* Event dialog */}
      <CalendarEventDialog 
        isOpen={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        selectedEvent={selectedEvent}
        onSubmit={handleSubmitEvent}
        onDelete={handleDeleteEvent}
      />
    </div>
  );
}