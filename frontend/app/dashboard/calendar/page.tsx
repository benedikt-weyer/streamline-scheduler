'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { parse, startOfWeek } from 'date-fns';

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
import { CalendarEvent } from '@/utils/types';
import { fetchCalendarEvents, addCalendarEvent, updateCalendarEvent, deleteCalendarEvent } from './actions';

export default function CalendarPage() {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [encryptionKey, setEncryptionKey] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [currentWeek, setCurrentWeek] = useState<Date>(startOfWeek(new Date(), { weekStartsOn: 1 })); // Start on Monday

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

  // Add a new event or update existing one
  const handleSubmitEvent = async (values: EventFormValues) => {
    if (!encryptionKey) return;
    
    try {
      const salt = generateSalt();
      const iv = generateIV();
      const derivedKey = deriveKeyFromPassword(encryptionKey, salt);
      
      const eventData = {
        title: values.title.trim(),
        description: values.description?.trim() ?? '',
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
      
      const eventData = {
        title: updatedEvent.title,
        description: updatedEvent.description ?? '',
        startTime: updatedEvent.startTime.toISOString(),
        endTime: updatedEvent.endTime.toISOString()
      };
      
      const encryptedData = encryptData(eventData, derivedKey, iv);
      
      // Update the event in the database
      await updateCalendarEvent(updatedEvent.id, encryptedData, iv, salt);
      
      // Local state update
      setEvents(prevEvents =>
        prevEvents.map(event =>
          event.id === updatedEvent.id ? updatedEvent : event
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
    
    // If a day is provided, set the default start time to the current time on that day
    if (day) {
      const now = new Date();
      const startTime = new Date(day);
      startTime.setHours(now.getHours());
      startTime.setMinutes(now.getMinutes());
      
      const endTime = new Date(startTime);
      endTime.setHours(endTime.getHours() + 1);
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