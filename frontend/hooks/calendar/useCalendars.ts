import { useState, useEffect } from 'react';
import { Calendar, CalendarType } from '@/utils/calendar/calendar-types';
import { getDecryptedBackend } from '@/utils/api/decrypted-backend';
import { CalendarDecrypted } from '@/utils/api/types';
import { useError } from '@/utils/context/ErrorContext';

export function useCalendars() {
  const [calendars, setCalendars] = useState<Calendar[]>([]);
  const { setError } = useError();

  // Load calendars and set state with the results
  const loadCalendarsAndSetState = async (): Promise<Calendar[]> => {
    try {
      const backend = getDecryptedBackend();
      
      // Fetch decrypted calendars from the backend
      const { data: calendars } = await backend.calendars.getAll();
      
      if (calendars.length === 0) {
        // If no calendars exist, create a default one
        console.log('No calendars found, creating default calendar');
        const defaultCalendar = await createDefaultCalendar();
        return [defaultCalendar];
      }
      
      // Convert to Calendar format and set state
      const calendarData = calendars.map(cal => ({
        id: cal.id,
        name: cal.name,
        color: cal.color || '#3b82f6', // Default blue color if not set
        isVisible: cal.is_visible ?? true,
        isDefault: cal.is_default,
        type: (cal.type as CalendarType) || CalendarType.Regular,
        icsUrl: cal.ics_url || undefined,
        lastSync: cal.last_sync ? new Date(cal.last_sync) : undefined,
        createdAt: new Date(cal.created_at),
        updatedAt: cal.updated_at ? new Date(cal.updated_at) : undefined
      } as Calendar));
      
      console.log(`Loaded ${calendarData.length} calendars`);
      
      // Update the state with the calendars
      setCalendars(calendarData);
      return calendarData;
    } catch (error) {
      console.error('Error loading calendars:', error);
      setError('Failed to load your calendars');
      throw error;
    }
  };

  // Create a default calendar
  const createDefaultCalendar = async (): Promise<Calendar> => {
    try {
      const backend = getDecryptedBackend();
      
      const { data: newCalendarRecord } = await backend.calendars.create({
        name: 'My Calendar',
        color: '#3b82f6', // Blue color
        is_visible: true,
        type: CalendarType.Regular
      });
      
      if (!newCalendarRecord) {
        throw new Error('Failed to create default calendar - no data returned');
      }
      
      const newCalendar: Calendar = {
        id: newCalendarRecord.id,
        name: newCalendarRecord.name,
        color: newCalendarRecord.color || '#3b82f6',
        isVisible: newCalendarRecord.is_visible ?? true,
        isDefault: newCalendarRecord.is_default ?? false,
        type: (newCalendarRecord.type as CalendarType) || CalendarType.Regular,
        user_id: newCalendarRecord.user_id,
        createdAt: new Date(newCalendarRecord.created_at),
        updatedAt: newCalendarRecord.updated_at ? new Date(newCalendarRecord.updated_at) : undefined
      };
      
      setCalendars([newCalendar]);
      return newCalendar;
    } catch (error) {
      console.error('Error creating default calendar:', error);
      setError('Failed to create default calendar');
      throw error;
    }
  };

  // Handle calendar toggle (show/hide)
  const handleCalendarToggle = async (calendarId: string, isVisible: boolean) => {
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
      
      const backend = getDecryptedBackend();
      
      console.log('Saving calendar visibility:', calendarId, isVisible); // Debug log
      
      // Update the calendar with the new visibility state
      await backend.calendars.update({
        id: calendarId,
        name: calendar.name,
        color: calendar.color,
        is_visible: isVisible,
        type: calendar.type,
        ...(calendar.type === CalendarType.ICS && {
          ics_url: calendar.icsUrl,
          last_sync: calendar.lastSync?.toISOString()
        })
      });
    } catch (error) {
      console.error('Error toggling calendar visibility:', error);
      // Revert the UI state if the database update failed
      setCalendars(prevCalendars => [...prevCalendars]); // Force a re-render with the original data
      setError('Failed to update calendar visibility');
    }
  };

  // Handle calendar creation
  const handleCalendarCreate = async (name: string, color: string) => {
    try {
      const backend = getDecryptedBackend();
      
      // Determine if this should be the default calendar
      const isDefault = calendars.length === 0;
      
      const { data: newCalendarRecord } = await backend.calendars.create({
        name,
        color,
        is_visible: true,
        type: CalendarType.Regular
      });
      
      if (!newCalendarRecord) {
        throw new Error('Failed to create calendar - no data returned');
      }
      
      const newCalendar: Calendar = {
        id: newCalendarRecord.id,
        name: newCalendarRecord.name,
        color: newCalendarRecord.color || color,
        isVisible: newCalendarRecord.is_visible ?? true,
        isDefault: newCalendarRecord.is_default ?? false,
        type: (newCalendarRecord.type as CalendarType) || CalendarType.Regular,
        user_id: newCalendarRecord.user_id,
        createdAt: new Date(newCalendarRecord.created_at),
        updatedAt: newCalendarRecord.updated_at ? new Date(newCalendarRecord.updated_at) : undefined
      };
      
      setCalendars(prevCalendars => [...prevCalendars, newCalendar]);
      return newCalendar;
    } catch (error) {
      console.error('Error creating calendar:', error);
      setError('Failed to create calendar');
      throw error;
    }
  };

  // Handle ICS calendar creation
  const handleICSCalendarCreate = async (name: string, color: string, icsUrl: string) => {
    try {
      const backend = getDecryptedBackend();
      
      // Determine if this should be the default calendar
      const isDefault = calendars.length === 0;
      
      const { data: newCalendarRecord } = await backend.calendars.create({
        name,
        color,
        is_visible: true,
        type: CalendarType.ICS,
        ics_url: icsUrl,
        last_sync: new Date().toISOString()
      });
      
      if (!newCalendarRecord) {
        throw new Error('Failed to create ICS calendar - no data returned');
      }
      
      const newCalendar: Calendar = {
        id: newCalendarRecord.id,
        name: newCalendarRecord.name,
        color: newCalendarRecord.color || color,
        isVisible: newCalendarRecord.is_visible ?? true,
        isDefault: newCalendarRecord.is_default ?? false,
        type: (newCalendarRecord.type as CalendarType) || CalendarType.ICS,
        icsUrl: newCalendarRecord.ics_url,
        lastSync: newCalendarRecord.last_sync ? new Date(newCalendarRecord.last_sync) : new Date(),
        user_id: newCalendarRecord.user_id,
        createdAt: new Date(newCalendarRecord.created_at),
        updatedAt: newCalendarRecord.updated_at ? new Date(newCalendarRecord.updated_at) : undefined
      };
      
      setCalendars(prevCalendars => [...prevCalendars, newCalendar]);
      return newCalendar;
    } catch (error) {
      console.error('Error creating ICS calendar:', error);
      setError('Failed to create ICS calendar');
      throw error;
    }
  };

  // Handle ICS calendar refresh
  const handleICSCalendarRefresh = async (calendarId: string) => {
    
    try {
      const calendar = calendars.find(cal => cal.id === calendarId);
      if (!calendar || calendar.type !== CalendarType.ICS) return;
      
      const backend = getDecryptedBackend();
      
      await backend.calendars.update({
        id: calendarId,
        name: calendar.name,
        color: calendar.color,
        is_visible: calendar.isVisible,
        type: CalendarType.ICS,
        ics_url: calendar.icsUrl,
        last_sync: new Date().toISOString()
      });
      
      // Update local state
      setCalendars(prevCalendars =>
        prevCalendars.map(cal =>
          cal.id === calendarId
            ? { ...cal, lastSync: new Date() }
            : cal
        )
      );
    } catch (error) {
      console.error('Error refreshing ICS calendar:', error);
      setError('Failed to refresh ICS calendar');
      throw error;
    }
  };

  // Handle calendar edit
  const handleCalendarEdit = async (calendarId: string, name: string, color: string) => {
    
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
                is_visible: calendar.isVisible, 
                updatedAt: new Date() 
              } 
            : calendar
        )
      );
      
      const backend = getDecryptedBackend();
      
      // Update the calendar in the database with the complete data
      await backend.calendars.update({
        id: calendarId,
        name: name,
        color: color,
        is_visible: currentCalendar.isVisible, // Preserve the current visibility
        type: currentCalendar.type, // Preserve the calendar type
        ...(currentCalendar.type === CalendarType.ICS && {
          icsUrl: currentCalendar.icsUrl,
          lastSync: currentCalendar.lastSync?.toISOString()
        })
      });
    } catch (error) {
      console.error('Error updating calendar:', error);
      setError('Failed to update calendar');
      throw error;
    }
  };

  // Handle calendar deletion
  const handleCalendarDelete = async (calendarId: string, moveEventsCallback: (eventId: string, targetCalendarId: string) => Promise<void>) => {
    
    try {
      // Find another calendar to move events to
      const remainingCalendars = calendars.filter(cal => cal.id !== calendarId);
      if (remainingCalendars.length === 0) {
        throw new Error('Cannot delete the only calendar');
      }
      
      // Prefer the default calendar as target, or use the first one
      const targetCalendarId = remainingCalendars.find(cal => cal.isDefault)?.id ?? remainingCalendars[0].id;
      
      // Delete the calendar from the database (event moving will be handled by the caller)
      const backend = getDecryptedBackend();
      await backend.calendars.delete(calendarId);
      
      // If the deleted calendar was the default, make another one the default
      if (calendars.find(cal => cal.id === calendarId)?.isDefault) {
        const newDefaultCalendar = remainingCalendars[0];
        await setCalendarAsDefault(newDefaultCalendar.id);
      }
      
      // Update local state
      setCalendars(prevCalendars => prevCalendars.filter(cal => cal.id !== calendarId));

      return targetCalendarId;
    } catch (error) {
      console.error('Error deleting calendar:', error);
      setError('Failed to delete calendar');
      throw error;
    }
  };

  // Helper function to update a calendar in the database
  const updateCalendarInDatabase = async (calendarId: string) => {
    
    try {
      const calendar = calendars.find(cal => cal.id === calendarId);
      if (!calendar) {
        throw new Error('Calendar not found');
      }
      
      const backend = getDecryptedBackend();
      
      // Update the calendar in the database with the current visibility state
      await backend.calendars.update({
        id: calendar.id,
        name: calendar.name,
        color: calendar.color,
        is_visible: calendar.isVisible,
        type: calendar.type, // Preserve the calendar type
        ...(calendar.type === CalendarType.ICS && {
          ics_url: calendar.icsUrl,
          last_sync: calendar.lastSync?.toISOString()
        })
      });
    } catch (error) {
      console.error('Error updating calendar in database:', error);
      throw error;
    }
  };

  // Helper function to set a calendar as default
  const setCalendarAsDefault = async (calendarId: string) => {
    
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
      
      const backend = getDecryptedBackend();
      
      // Update the target calendar with isDefault=true
      await backend.calendars.update({
        id: calendarId,
        name: targetCalendar.name,
        color: targetCalendar.color,
        is_visible: targetCalendar.isVisible,
        type: targetCalendar.type, // Preserve the calendar type
        ...(targetCalendar.type === CalendarType.ICS && {
          icsUrl: targetCalendar.icsUrl,
          lastSync: targetCalendar.lastSync?.toISOString()
        })
      });
      
      console.log(`Calendar ${calendarId} set as default successfully`);
    } catch (error) {
      console.error('Error setting calendar as default:', error);
      // Revert UI state on error
      setCalendars(prevState => [...prevState]);
      setError('Failed to set calendar as default');
      throw error;
    }
  };

  // Load calendars when component mounts
  useEffect(() => {
    loadCalendarsAndSetState().catch(err => {
      console.error('Failed to load calendars:', err);
      setError('Failed to load your calendars');
    });
  }, []);

  return {
    calendars,
    setCalendars,
    loadCalendarsAndSetState,
    handleCalendarToggle,
    handleCalendarCreate,
    handleICSCalendarCreate,
    handleICSCalendarRefresh,
    handleCalendarEdit,
    handleCalendarDelete,
    updateCalendarInDatabase,
    setCalendarAsDefault
  };
}
