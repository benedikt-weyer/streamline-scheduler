'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { parse, startOfWeek, isValid } from 'date-fns';

import { CalendarHeader } from '@/components/dashboard/calendar-header';
import { CalendarGrid } from '@/components/dashboard/calendar-grid';
import { CalendarEventDialog, EventFormValues } from '@/components/dashboard/calendar-event-dialog';
import { CalendarSidebar } from '@/components/dashboard/calendar/calendar-sidebar';

import { getDaysOfWeek, filterEventsForWeek, ensureCalendarPropertiesOnEvents } from '@/utils/calendar';
import { 
  decryptData, 
  encryptData, 
  generateIV, 
  generateSalt, 
  getHashedPassword, 
  deriveKeyFromPassword 
} from '@/utils/encryption';
import { createClient } from '@/utils/supabase/client';
import { CalendarEvent, Calendar, RecurrenceFrequency, RecurrencePattern } from '@/utils/types';
import { 
  fetchCalendarEvents, 
  addCalendarEvent, 
  updateCalendarEvent, 
  deleteCalendarEvent,
  fetchCalendars,
  addCalendar,
  updateCalendar,
  deleteCalendar,
  updateEventCalendar
} from './actions';

export default function CalendarPage() {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [calendars, setCalendars] = useState<Calendar[]>([]);
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
  
  // Filter events for the current week and visible calendars
  const eventsInCurrentWeek = filterEventsForWeek(
    ensureCalendarPropertiesOnEvents(
      events.filter(event => {
        const calendar = calendars.find(cal => cal.id === event.calendarId);
        return calendar?.isVisible ?? true; // Show events by default if calendar not found
      }),
      calendars
    ), 
    currentWeek
  );
  
  // Debugging line to check current week's events
  console.log(`Events in current week: ${eventsInCurrentWeek.length}`);

  // Load encryption key from cookie and fetch data on component mount
  useEffect(() => {
    const loadDataSequentially = async () => {
      const hashedPassword = getHashedPassword();
      
      if (!hashedPassword) {
        setError('Please log in again to access your encrypted Calendar');
        setIsLoading(false);
        return;
      }
      
      setEncryptionKey(hashedPassword);
      
      try {
        setIsLoading(true);
        // First, load calendars and get the array directly
        const loadedCalendars = await loadCalendarsAndSetState(hashedPassword);
        
        // Then, load events with the calendars we just loaded
        await loadEventsWithCalendars(hashedPassword);
        
        // After both are loaded, verify all events have calendar info
        console.log("Loading complete, verifying calendar connections");
        updateEventCalendarConnections(loadedCalendars);
      } catch (error) {
        console.error('Error loading data:', error);
        setError('Error loading calendar data');
      } finally {
        setIsLoading(false);
      }
    };
    
    loadDataSequentially();
  }, []);
  
  // Ensure all events have their calendar references
  const updateEventCalendarConnections = (availableCalendars: Calendar[]) => {
    if (events.length === 0 || availableCalendars.length === 0) return;
    
    console.log(`Ensuring ${events.length} events have proper calendar references to ${availableCalendars.length} calendars`);
    
    // Update all events with their proper calendar references
    setEvents(prevEvents => 
      prevEvents.map(event => {
        // Find the matching calendar 
        const calendar = availableCalendars.find(cal => cal.id === event.calendarId);
        
        if (calendar) {
          // Only create a new object if the calendar reference is missing or different
          if (!event.calendar || event.calendar.id !== calendar.id) {
            console.log(`Fixing calendar reference for event: ${event.id} (${event.title})`);
            return {
              ...event,
              calendar // Attach the full calendar object
            };
          }
        } else {
          console.warn(`No calendar found for event ${event.id} with calendarId ${event.calendarId}`);
        }
        
        return event;
      })
    );
  };

  // Update event calendar references whenever calendars change
  useEffect(() => {
    if (calendars.length > 0 && events.length > 0) {
      // Update all events with their proper calendar references
      setEvents(prevEvents => 
        prevEvents.map(event => {
          const calendar = calendars.find(cal => cal.id === event.calendarId);
          return {
            ...event,
            calendar
          };
        })
      );
    }
  }, [calendars]);

  // Set up real-time subscription to calendar_events changes
  useEffect(() => {
    if (!encryptionKey) return;
    
    // Initialize Supabase client
    const supabase = createClient();
    
    // Subscribe to changes on the calendar_events table
    const eventsSubscription = supabase
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
                
                // Find the calendar for this event
                const calendarId = decryptedData.calendarId || 
                  (calendars.length > 0 ? calendars.find(cal => cal.isDefault)?.id || calendars[0].id : '');
                const calendar = calendars.find(cal => cal.id === calendarId);
                
                const newEvent: CalendarEvent = {
                  id: payload.new.id,
                  title: decryptedData.title,
                  description: decryptedData.description,
                  startTime: new Date(decryptedData.startTime),
                  endTime: new Date(decryptedData.endTime),
                  calendarId,
                  calendar,
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
                
                // Find the calendar for this event
                const calendarId = decryptedData.calendarId || 
                  (calendars.length > 0 ? calendars.find(cal => cal.isDefault)?.id || calendars[0].id : '');
                const calendar = calendars.find(cal => cal.id === calendarId);
                
                setEvents(prevEvents =>
                  prevEvents.map(event =>
                    event.id === payload.new.id
                      ? {
                          ...event,
                          title: decryptedData.title,
                          description: decryptedData.description,
                          startTime: new Date(decryptedData.startTime),
                          endTime: new Date(decryptedData.endTime),
                          calendarId,
                          calendar,
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
      
    // Subscribe to changes on the calendars table
    const calendarsSubscription = supabase
      .channel('calendars_changes')
      .on('postgres_changes', 
        { 
          event: '*', 
          schema: 'public', 
          table: 'calendars' 
        }, 
        async (payload) => {
          // Handle different events
          switch(payload.eventType) {
            case 'INSERT':
              // Skip if we already have this calendar (e.g. from our own insert)
              if (calendars.some(calendar => calendar.id === payload.new.id)) {
                return;
              }
              
              try {
                // Decrypt the new calendar
                const salt = payload.new.salt;
                const iv = payload.new.iv;
                const derivedKey = deriveKeyFromPassword(encryptionKey, salt);
                const decryptedData = decryptData(payload.new.encrypted_data, derivedKey, iv);
                
                if (!decryptedData) return;
                
                const newCalendar: Calendar = {
                  id: payload.new.id,
                  name: decryptedData.name,
                  color: decryptedData.color,
                  isVisible: decryptedData.isVisible !== false, // Default to true
                  isDefault: payload.new.is_default,
                  createdAt: new Date(payload.new.created_at),
                  updatedAt: payload.new.updated_at ? new Date(payload.new.updated_at) : undefined
                };
                
                setCalendars(prevCalendars => [...prevCalendars, newCalendar]);
              } catch (error) {
                console.error('Error processing real-time calendar INSERT:', error);
              }
              break;
              
            case 'UPDATE':
              try {
                // Decrypt the updated calendar
                const salt = payload.new.salt;
                const iv = payload.new.iv;
                const derivedKey = deriveKeyFromPassword(encryptionKey, salt);
                const decryptedData = decryptData(payload.new.encrypted_data, derivedKey, iv);
                
                if (!decryptedData) return;
                
                setCalendars(prevCalendars =>
                  prevCalendars.map(calendar =>
                    calendar.id === payload.new.id
                      ? {
                          ...calendar,
                          name: decryptedData.name,
                          color: decryptedData.color,
                          isVisible: decryptedData.isVisible === true, // Only true if explicitly true
                          isDefault: payload.new.is_default,
                          updatedAt: payload.new.updated_at ? new Date(payload.new.updated_at) : undefined
                        }
                      : calendar
                  )
                );
              } catch (error) {
                console.error('Error processing real-time calendar UPDATE:', error);
              }
              break;
              
            case 'DELETE':
              // Remove the deleted calendar from state
              setCalendars(prevCalendars => 
                prevCalendars.filter(calendar => calendar.id !== payload.old.id)
              );
              break;
          }
        }
      )
      .subscribe();
    
    // Clean up the subscriptions when component unmounts
    return () => {
      supabase.removeChannel(eventsSubscription);
      supabase.removeChannel(calendarsSubscription);
    };
  }, [encryptionKey, events, calendars]);

  // Load and decrypt calendars
  const loadCalendars = async (key: string) => {
    try {
      const encryptedCalendars = await fetchCalendars();
      
      const decryptedCalendars = encryptedCalendars
        .map(calendar => {
          try {
            const decryptionKey = deriveKeyFromPassword(key, calendar.salt);
            const decryptedData = decryptData(calendar.encrypted_data, decryptionKey, calendar.iv);
            
            if (!decryptedData) return null;
            
            // Explicitly handle isVisible property - use the exact value from the decrypted data
            // instead of defaulting to true if it's not explicitly false
            return {
              id: calendar.id,
              name: decryptedData.name,
              color: decryptedData.color,
              isVisible: decryptedData.isVisible === true, // Only true if explicitly true
              isDefault: calendar.is_default,
              createdAt: new Date(calendar.created_at),
              updatedAt: calendar.updated_at ? new Date(calendar.updated_at) : undefined
            };
          } catch (error) {
            console.error('Failed to decrypt calendar:', error);
            return null;
          }
        })
        .filter((calendar): calendar is NonNullable<typeof calendar> => calendar !== null);
      
      // If no calendars exist, create a default one
      if (decryptedCalendars.length === 0) {
        await createDefaultCalendar(key);
        return;
      }
      
      setCalendars(decryptedCalendars);
    } catch (error) {
      console.error('Error loading calendars:', error);
      setError('Failed to load your calendars');
    }
  };

  // Create a default calendar if none exist
  const createDefaultCalendar = async (key: string) => {
    try {
      const salt = generateSalt();
      const iv = generateIV();
      const derivedKey = deriveKeyFromPassword(key, salt);
      
      // Explicitly include isVisible in the calendar data
      const calendarData = {
        name: 'My Calendar',
        color: '#4f46e5', // Indigo
        isVisible: true
      };
      
      const encryptedData = encryptData(calendarData, derivedKey, iv);
      const newEncryptedCalendar = await addCalendar(encryptedData, iv, salt, true); // Set as default
      
      const newCalendar: Calendar = {
        id: newEncryptedCalendar.id,
        name: calendarData.name,
        color: calendarData.color,
        isVisible: true, // Always set to true for new calendars
        isDefault: true,
        createdAt: new Date(newEncryptedCalendar.created_at),
        updatedAt: newEncryptedCalendar.updated_at ? new Date(newEncryptedCalendar.updated_at) : undefined
      };
      
      setCalendars([newCalendar]);
    } catch (error) {
      console.error('Error creating default calendar:', error);
      setError('Failed to create default calendar');
    }
  };

  // Load and decrypt events
  const loadEvents = async (key: string) => {
    try {
      setIsLoading(true);
      const encryptedEvents = await fetchCalendarEvents();
      
      // Ensure we have calendars available before processing events
      if (calendars.length === 0) {
        console.warn('No calendars available when loading events');
      }
      
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
            
            // Get calendar ID from event data or fallback to default
            const calendarId = decryptedData.calendarId || 
              (calendars.length > 0 ? calendars.find(cal => cal.isDefault)?.id || calendars[0].id : '');
              
            // Find the calendar for this event
            const calendar = calendars.find(cal => cal.id === calendarId);
            
            if (!calendar && calendarId) {
              console.warn(`Calendar with ID ${calendarId} not found for event ${event.id}`);
            }
            
            return {
              id: event.id,
              title: decryptedData.title,
              description: decryptedData.description,
              startTime: new Date(decryptedData.startTime),
              endTime: new Date(decryptedData.endTime),
              calendarId,
              calendar, // This links the event to its calendar (for color info)
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
      
      // Log info about events and calendars for debugging
      console.log(`Loaded ${decryptedEvents.length} events`);
      console.log(`Current calendars: ${calendars.length}`);
      
      // Update calendar references in events
      if (calendars.length > 0) {
        setEvents(prevEvents => 
          prevEvents.map(event => {
            const calendar = calendars.find(cal => cal.id === event.calendarId);
            return {
              ...event,
              calendar
            };
          })
        );
      }
    } catch (error) {
      console.error('Error loading events:', error);
      setError('Failed to load your Calendar events');
    } finally {
      setIsLoading(false);
    }
  };

  // Load calendars and set state with the results - new helper function
  const loadCalendarsAndSetState = async (key: string): Promise<Calendar[]> => {
    try {
      console.log('Starting calendar load...');
      const encryptedCalendars = await fetchCalendars();
      console.log(`Fetched ${encryptedCalendars.length} encrypted calendars`);
      
      const decryptedCalendars = encryptedCalendars
        .map(calendar => {
          try {
            const decryptionKey = deriveKeyFromPassword(key, calendar.salt);
            const decryptedData = decryptData(calendar.encrypted_data, decryptionKey, calendar.iv);
            
            if (!decryptedData) return null;
            
            // Parse isVisible value explicitly
            const isVisible = decryptedData.isVisible === true;
            console.log(`Calendar ${calendar.id}: name=${decryptedData.name}, color=${decryptedData.color}, isVisible=${isVisible}`);
            
            return {
              id: calendar.id,
              name: decryptedData.name,
              color: decryptedData.color,
              isVisible: isVisible, // Only true if explicitly true
              isDefault: calendar.is_default,
              createdAt: new Date(calendar.created_at),
              updatedAt: calendar.updated_at ? new Date(calendar.updated_at) : undefined
            };
          } catch (error) {
            console.error('Failed to decrypt calendar:', error);
            return null;
          }
        })
        .filter((calendar): calendar is NonNullable<typeof calendar> => calendar !== null);
      
      // If no calendars exist, create a default one
      if (decryptedCalendars.length === 0) {
        console.log('No calendars found, creating default calendar');
        await createDefaultCalendar(key);
        return [];
      }
      
      console.log(`Setting ${decryptedCalendars.length} calendars in state`);
      setCalendars(decryptedCalendars);
      
      // Return the calendars array for use in loadEventsWithCalendars
      return decryptedCalendars;
    } catch (error) {
      console.error('Error in loadCalendarsAndSetState:', error);
      setError('Failed to load your calendars');
      throw error;
    }
  };

  // Load events with the calendars available in state - new helper function
  const loadEventsWithCalendars = async (key: string): Promise<void> => {
    try {
      console.log('Starting events load with calendars:', calendars.length);
      const encryptedEvents = await fetchCalendarEvents();
      console.log(`Fetched ${encryptedEvents.length} encrypted events`);
      
      // Get a fresh copy of calendars from state to ensure we have the latest
      const currentCalendars = [...calendars];
      console.log(`Current calendars for reference:`, 
        currentCalendars.map(c => ({ id: c.id, name: c.name, color: c.color })));
      
      const decryptedEvents = encryptedEvents
        .map(event => {
          try {
            const decryptionKey = deriveKeyFromPassword(key, event.salt);
            const decryptedData = decryptData(event.encrypted_data, decryptionKey, event.iv);
            
            if (!decryptedData) return null;
            
            // Create proper Date objects for start and end times
            const startTime = new Date(decryptedData.startTime);
            const endTime = new Date(decryptedData.endTime);
            
            // Verify dates are valid
            if (isNaN(startTime.getTime()) || isNaN(endTime.getTime())) {
              console.error(`Invalid date for event ${event.id}: start=${decryptedData.startTime}, end=${decryptedData.endTime}`);
              return null;
            }
            
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
            
            // Find the calendar ID, falling back to default if needed
            const calendarId = decryptedData.calendarId || 
              (currentCalendars.length > 0 ? currentCalendars.find(cal => cal.isDefault)?.id || currentCalendars[0].id : '');
            
            // Find the calendar for this event
            const calendar = currentCalendars.find(cal => cal.id === calendarId);
            
            if (calendar) {
              console.log(`Event ${event.id} using calendar: ${calendar.name} (${calendar.color}, visible: ${calendar.isVisible})`);
            } else {
              console.warn(`Calendar ID ${calendarId} not found for event ${event.id}`);
            }
            
            // Create the event object with proper Date objects and fully attached calendar
            return {
              id: event.id,
              title: decryptedData.title,
              description: decryptedData.description,
              startTime,
              endTime,
              calendarId,
              // Important: Create a new calendar object here instead of using reference
              calendar: calendar ? {
                id: calendar.id,
                name: calendar.name,
                color: calendar.color,
                isVisible: calendar.isVisible,
                isDefault: calendar.isDefault,
                createdAt: calendar.createdAt,
                updatedAt: calendar.updatedAt
              } : undefined,
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
      
      console.log(`Setting ${decryptedEvents.length} events in state with calendar references`);
      
      // Count events with calendar
      const eventsWithCalendar = decryptedEvents.filter(e => e.calendar && e.calendar.color);
      console.log(`${eventsWithCalendar.length} events have calendar with color`);
      
      // Set the events directly without using JSON.parse/stringify
      setEvents(decryptedEvents);
    } catch (error) {
      console.error('Error in loadEventsWithCalendars:', error);
      setError('Failed to load your Calendar events');
      throw error;
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
      
      // Find the calendar for this event
      const calendar = calendars.find(cal => cal.id === values.calendarId);
      
      // The data to be encrypted and stored
      const eventData = {
        title: values.title.trim(),
        description: values.description?.trim() ?? '',
        calendarId: values.calendarId,
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
          calendarId: values.calendarId,
          calendar,
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
          calendarId: values.calendarId,
          calendar,
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
      
      // Get the original event to preserve recurrence pattern and calendar
      const originalEvent = events.find(e => e.id === updatedEvent.id);
      
      if (!originalEvent) {
        throw new Error('Original event not found');
      }
      
      // Preserve recurrence pattern from the original event if it exists
      const recurrencePattern = originalEvent.recurrencePattern;
      
      const eventData = {
        title: updatedEvent.title,
        description: updatedEvent.description ?? '',
        calendarId: originalEvent.calendarId,
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
      
      // Local state update with preserved recurrence pattern and calendar
      setEvents(prevEvents =>
        prevEvents.map(event =>
          event.id === updatedEvent.id ? {
            ...updatedEvent,
            calendarId: originalEvent.calendarId,
            calendar: originalEvent.calendar,
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
  const openNewEventDialog = (day?: Date, calendarId?: string) => {
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
        calendarId: calendarId || (calendars.find(c => c.isDefault)?.id || (calendars.length > 0 ? calendars[0].id : '')),
        startTime: startTime,
        endTime: endTime,
        createdAt: new Date()
      };
      
      // Set as selected event to prefill the form with these times
      setSelectedEvent(dummyEvent);
    }
    
    setIsDialogOpen(true);
  };

  // Handle calendar toggle (show/hide)
  const handleCalendarToggle = async (calendarId: string, isVisible: boolean) => {
    if (!encryptionKey) return;
    
    try {
      // First update the UI state immediately for responsiveness
      setCalendars(prevCalendars => 
        prevCalendars.map(calendar => 
          calendar.id === calendarId ? { ...calendar, isVisible } : calendar
        )
      );
      
      // Find the calendar that's being toggled
      const calendar = calendars.find(cal => cal.id === calendarId);
      if (!calendar) {
        throw new Error('Calendar not found');
      }
      
      // Create new encryption components for the update
      const salt = generateSalt();
      const iv = generateIV();
      const derivedKey = deriveKeyFromPassword(encryptionKey, salt);
      
      // Prepare the data to encrypt - making sure to include the NEW visibility state
      const calendarData = {
        name: calendar.name,
        color: calendar.color,
        isVisible: isVisible // Use the new visibility value that was passed in
      };
      
      console.log('Saving calendar visibility:', calendarId, isVisible); // Debug log
      
      // Encrypt the data with the updated visibility state
      const encryptedData = encryptData(calendarData, derivedKey, iv);
      
      // Update directly in the database
      await updateCalendar(calendarId, encryptedData, iv, salt, calendar.isDefault);
    } catch (error) {
      console.error('Error toggling calendar visibility:', error);
      // Revert the UI state if the database update failed
      setCalendars(prevCalendars => [...prevCalendars]); // Force a re-render with the original data
      setError('Failed to update calendar visibility');
    }
  };

  // Handle calendar creation
  const handleCalendarCreate = async (name: string, color: string) => {
    if (!encryptionKey) return;
    
    try {
      const salt = generateSalt();
      const iv = generateIV();
      const derivedKey = deriveKeyFromPassword(encryptionKey, salt);
      
      const calendarData = {
        name,
        color,
        isVisible: true
      };
      
      const encryptedData = encryptData(calendarData, derivedKey, iv);
      
      // Determine if this should be the default calendar
      const isDefault = calendars.length === 0;
      
      const newEncryptedCalendar = await addCalendar(encryptedData, iv, salt, isDefault);
      
      const newCalendar: Calendar = {
        id: newEncryptedCalendar.id,
        name,
        color,
        isVisible: true,
        isDefault,
        createdAt: new Date(newEncryptedCalendar.created_at),
        updatedAt: newEncryptedCalendar.updated_at ? new Date(newEncryptedCalendar.updated_at) : undefined
      };
      
      setCalendars(prevCalendars => [...prevCalendars, newCalendar]);
    } catch (error) {
      console.error('Error creating calendar:', error);
      setError('Failed to create calendar');
    }
  };

  // Handle calendar edit
  const handleCalendarEdit = async (calendarId: string, name: string, color: string) => {
    if (!encryptionKey) return;
    
    try {
      // Find the current calendar to preserve its visibility state
      const currentCalendar = calendars.find(cal => cal.id === calendarId);
      if (!currentCalendar) {
        throw new Error('Calendar not found');
      }
      
      // Update local state while preserving visibility setting
      setCalendars(prevCalendars => 
        prevCalendars.map(calendar => 
          calendar.id === calendarId 
            ? { 
                ...calendar, 
                name, 
                color, 
                // Explicitly keep the current visibility state
                isVisible: calendar.isVisible, 
                updatedAt: new Date() 
              } 
            : calendar
        )
      );
      
      // Generate encryption components
      const salt = generateSalt();
      const iv = generateIV();
      const derivedKey = deriveKeyFromPassword(encryptionKey, salt);
      
      // Include the current visibility state when encrypting calendar data
      const calendarData = {
        name: name,
        color: color,
        isVisible: currentCalendar.isVisible // Preserve the current visibility
      };
      
      const encryptedData = encryptData(calendarData, derivedKey, iv);
      
      // Update the calendar in the database with the complete data
      await updateCalendar(calendarId, encryptedData, iv, salt, currentCalendar.isDefault);
    } catch (error) {
      console.error('Error updating calendar:', error);
      setError('Failed to update calendar');
    }
  };

  // Handle calendar deletion
  const handleCalendarDelete = async (calendarId: string) => {
    if (!encryptionKey) return;
    
    try {
      // Find another calendar to move events to
      const remainingCalendars = calendars.filter(cal => cal.id !== calendarId);
      if (remainingCalendars.length === 0) {
        throw new Error('Cannot delete the only calendar');
      }
      
      // Prefer the default calendar as target, or use the first one
      const targetCalendarId = remainingCalendars.find(cal => cal.isDefault)?.id || remainingCalendars[0].id;
      
      // Update all events from this calendar to the target calendar
      const eventsToMove = events.filter(event => event.calendarId === calendarId);
      for (const event of eventsToMove) {
        await moveEventToCalendar(event.id, targetCalendarId);
      }
      
      // Delete the calendar from the database
      await deleteCalendar(calendarId);
      
      // If the deleted calendar was the default, make another one the default
      if (calendars.find(cal => cal.id === calendarId)?.isDefault) {
        const newDefaultCalendar = remainingCalendars[0];
        await setCalendarAsDefault(newDefaultCalendar.id);
      }
      
      // Update local state
      setCalendars(prevCalendars => prevCalendars.filter(cal => cal.id !== calendarId));
    } catch (error) {
      console.error('Error deleting calendar:', error);
      setError('Failed to delete calendar');
    }
  };

  // Helper function to update a calendar in the database
  const updateCalendarInDatabase = async (calendarId: string) => {
    if (!encryptionKey) return;
    
    try {
      const calendar = calendars.find(cal => cal.id === calendarId);
      if (!calendar) {
        throw new Error('Calendar not found');
      }
      
      const salt = generateSalt();
      const iv = generateIV();
      const derivedKey = deriveKeyFromPassword(encryptionKey, salt);
      
      // Include the current visibility state when encrypting calendar data
      const calendarData = {
        name: calendar.name,
        color: calendar.color,
        isVisible: calendar.isVisible
      };
      
      const encryptedData = encryptData(calendarData, derivedKey, iv);
      
      // Update the calendar in the database with the current visibility state
      await updateCalendar(calendar.id, encryptedData, iv, salt, calendar.isDefault);
    } catch (error) {
      console.error('Error updating calendar in database:', error);
      throw error;
    }
  };

  // Helper function to move an event to another calendar
  const moveEventToCalendar = async (eventId: string, targetCalendarId: string) => {
    if (!encryptionKey) return;
    
    try {
      const event = events.find(e => e.id === eventId);
      if (!event) {
        throw new Error('Event not found');
      }
      
      const salt = generateSalt();
      const iv = generateIV();
      const derivedKey = deriveKeyFromPassword(encryptionKey, salt);
      
      // Get the target calendar
      const targetCalendar = calendars.find(cal => cal.id === targetCalendarId);
      if (!targetCalendar) {
        throw new Error('Target calendar not found');
      }
      
      const eventData = {
        title: event.title,
        description: event.description ?? '',
        calendarId: targetCalendarId,
        startTime: event.startTime.toISOString(),
        endTime: event.endTime.toISOString(),
        recurrenceFrequency: event.recurrencePattern?.frequency,
        recurrenceEndDate: event.recurrencePattern?.endDate?.toISOString(),
        recurrenceInterval: event.recurrencePattern?.interval,
        daysOfWeek: event.recurrencePattern?.daysOfWeek
      };
      
      const encryptedData = encryptData(eventData, derivedKey, iv);
      
      // Update the event in the database
      await updateEventCalendar(eventId, encryptedData, iv, salt);
      
      // Update local state
      setEvents(prevEvents =>
        prevEvents.map(e =>
          e.id === eventId ? {
            ...e,
            calendarId: targetCalendarId,
            calendar: targetCalendar
          } : e
        )
      );
    } catch (error) {
      console.error('Error moving event to calendar:', error);
      throw error;
    }
  };

  // Helper function to set a calendar as default
  const setCalendarAsDefault = async (calendarId: string) => {
    if (!encryptionKey) return;
    
    try {
      // Find the calendar we want to make default
      const targetCalendar = calendars.find(cal => cal.id === calendarId);
      if (!targetCalendar) {
        throw new Error('Target calendar not found');
      }
      
      // Update local state immediately for responsive UI
      setCalendars(prevCalendars => 
        prevCalendars.map(cal => ({
          ...cal,
          isDefault: cal.id === calendarId
        }))
      );
      
      // Generate encryption components for the target calendar
      const salt = generateSalt();
      const iv = generateIV();
      const derivedKey = deriveKeyFromPassword(encryptionKey, salt);
      
      // Update the target calendar with isDefault=true
      const calendarData = {
        name: targetCalendar.name,
        color: targetCalendar.color,
        isVisible: targetCalendar.isVisible
      };
      
      const encryptedData = encryptData(calendarData, derivedKey, iv);
      
      // Important: Pass isDefault=true to ensure the database updates the flag correctly
      await updateCalendar(calendarId, encryptedData, iv, salt, true);
      
      console.log(`Calendar ${calendarId} set as default successfully`);
    } catch (error) {
      console.error('Error setting calendar as default:', error);
      // Revert UI state on error
      setCalendars(prevState => [...prevState]);
      setError('Failed to set calendar as default');
      throw error;
    }
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
    <div className="flex w-full h-full">
      {/* Calendar Sidebar */}
      <CalendarSidebar
        calendars={calendars}
        onCalendarToggle={handleCalendarToggle}
        onCalendarCreate={handleCalendarCreate}
        onCalendarEdit={handleCalendarEdit}
        onCalendarDelete={handleCalendarDelete}
        onSetDefaultCalendar={setCalendarAsDefault}
      />
      
      {/* Main Calendar Content */}
      <div className="flex-1 px-4">
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
              calendars={calendars}
              openEditDialog={openEditDialog}
              openNewEventDialog={(day) => openNewEventDialog(day)}
              onEventUpdate={handleEventUpdate}
            />
          </div>
        )}
        
        {/* Event dialog */}
        <CalendarEventDialog 
          isOpen={isDialogOpen}
          onOpenChange={setIsDialogOpen}
          selectedEvent={selectedEvent}
          calendars={calendars.filter(cal => cal.isVisible)}
          defaultCalendarId={calendars.find(cal => cal.isDefault)?.id}
          onSubmit={handleSubmitEvent}
          onDelete={handleDeleteEvent}
        />
      </div>
    </div>
  );
}