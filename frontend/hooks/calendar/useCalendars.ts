import { useState, useEffect } from 'react';
import { 
  fetchCalendars, 
  addCalendar, 
  updateCalendar, 
  deleteCalendar,
} from '../../app/dashboard/calendar/actions';
import { Calendar, CalendarType } from '@/utils/calendar/calendar-types';
import { 
  generateSalt, 
  generateIV, 
  deriveKeyFromPassword, 
  encryptData,
  decryptData
} from '@/utils/cryptography/encryption';
import { useError } from '@/utils/context/ErrorContext';

export function useCalendars(encryptionKey: string | null) {
  const [calendars, setCalendars] = useState<Calendar[]>([]);
  const { setError } = useError();

  // Load calendars and set state with the results
  const loadCalendarsAndSetState = async (key: string): Promise<Calendar[]> => {
    try {
      // Fetch encrypted calendars from the database
      const encryptedCalendars = await fetchCalendars();
      
      // Check for corrupted calendars but do not delete them
      const corruptedCalendars = encryptedCalendars.filter(cal => !cal.encrypted_data);
      if (corruptedCalendars.length > 0) {
        console.warn(`Found ${corruptedCalendars.length} corrupted calendars. These will be skipped but not deleted.`);
        corruptedCalendars.forEach(cal => {
          console.warn(`Skipping corrupted calendar with ID: ${cal.id}`);
        });
      }
      // Filter out calendars with undefined encrypted_data
      const validCalendars = encryptedCalendars.filter(cal => !!cal.encrypted_data);
      
      if (validCalendars.length === 0) {
        // If no valid calendars exist, create a default one
        console.log('No valid calendars found, creating default calendar');
        const defaultCalendar = await createDefaultCalendar(key);
        return [defaultCalendar];
      }
      
      // Decrypt each calendar
      const decryptedCalendars = validCalendars
        .map(cal => {
          try {
            // Get the salt and IV for this calendar
            const salt = cal.salt;
            const iv = cal.iv;
            
            // Derive the key for this calendar using the provided encryption key and salt
            const derivedKey = deriveKeyFromPassword(key, salt);
            
            // Make sure cal.encrypted_data is defined before decrypting
            if (!cal.encrypted_data) {
              console.error('Calendar data is undefined for calendar:', cal.id);
              return null;
            }
            
            // Decrypt the calendar data
            const decryptedData = decryptData(cal.encrypted_data, derivedKey, iv);
            
            if (!decryptedData) {
              console.error('Failed to decrypt calendar data for calendar:', cal.id);
              return null;
            }
            
            // Return a calendar object with decrypted data and metadata
            return {
              id: cal.id,
              name: decryptedData.name,
              color: decryptedData.color,
              isVisible: decryptedData.isVisible ?? true, // Default to visible if not specified
              isDefault: cal.is_default,
              type: (decryptedData.type as CalendarType) || CalendarType.Regular,
              icsUrl: decryptedData.icsUrl || undefined,
              lastSync: decryptedData.lastSync ? new Date(decryptedData.lastSync) : undefined,
              createdAt: new Date(cal.created_at),
              updatedAt: cal.updated_at ? new Date(cal.updated_at) : undefined
            } as Calendar;
          } catch (error) {
            console.error('Error decrypting calendar:', error);
            return null;
          }
        })
        .filter((cal): cal is Calendar => cal !== null);
      
      console.log(`Loaded ${decryptedCalendars.length} calendars`);
      
      // Update the state with the decrypted calendars
      setCalendars(decryptedCalendars);
      return decryptedCalendars;
    } catch (error) {
      console.error('Error loading calendars:', error);
      setError('Failed to load your calendars');
      throw error;
    }
  };

  // Create a default calendar
  const createDefaultCalendar = async (key: string): Promise<Calendar> => {
    try {
      const salt = generateSalt();
      const iv = generateIV();
      const derivedKey = deriveKeyFromPassword(key, salt);
      
      const calendarData = {
        name: 'My Calendar',
        color: '#3b82f6', // Blue color
        isVisible: true,
        type: CalendarType.Regular
      };
      
      const encryptedData = encryptData(calendarData, derivedKey, iv);
      const newCalendarRecord = await addCalendar(encryptedData, iv, salt, true);
      
      const newCalendar: Calendar = {
        id: newCalendarRecord.id,
        name: 'My Calendar',
        color: '#3b82f6',
        isVisible: true,
        isDefault: true,
        type: CalendarType.Regular,
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
      
      // Prepare the data to encrypt - making sure to include the NEW visibility state and preserve all fields
      const calendarData = {
        name: calendar.name,
        color: calendar.color,
        isVisible: isVisible, // Use the new visibility value that was passed in
        type: calendar.type, // Preserve the calendar type
        ...(calendar.type === CalendarType.ICS && {
          icsUrl: calendar.icsUrl,
          lastSync: calendar.lastSync?.toISOString()
        })
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
        isVisible: true,
        type: CalendarType.Regular
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
        type: CalendarType.Regular,
        createdAt: new Date(newEncryptedCalendar.created_at),
        updatedAt: newEncryptedCalendar.updated_at ? new Date(newEncryptedCalendar.updated_at) : undefined
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
    if (!encryptionKey) return;
    
    try {
      const salt = generateSalt();
      const iv = generateIV();
      const derivedKey = deriveKeyFromPassword(encryptionKey, salt);
      
      const calendarData = {
        name,
        color,
        isVisible: true,
        type: CalendarType.ICS,
        icsUrl,
        lastSync: new Date().toISOString()
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
        type: CalendarType.ICS,
        icsUrl,
        lastSync: new Date(),
        createdAt: new Date(newEncryptedCalendar.created_at),
        updatedAt: newEncryptedCalendar.updated_at ? new Date(newEncryptedCalendar.updated_at) : undefined
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
    if (!encryptionKey) return;
    
    try {
      const calendar = calendars.find(cal => cal.id === calendarId);
      if (!calendar || calendar.type !== CalendarType.ICS) return;
      
      const salt = generateSalt();
      const iv = generateIV();
      const derivedKey = deriveKeyFromPassword(encryptionKey, salt);
      
      const calendarData = {
        name: calendar.name,
        color: calendar.color,
        isVisible: calendar.isVisible,
        type: CalendarType.ICS,
        icsUrl: calendar.icsUrl,
        lastSync: new Date().toISOString()
      };
      
      const encryptedData = encryptData(calendarData, derivedKey, iv);
      
      await updateCalendar(calendarId, encryptedData, iv, salt, calendar.isDefault);
      
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
        isVisible: currentCalendar.isVisible, // Preserve the current visibility
        type: currentCalendar.type, // Preserve the calendar type
        ...(currentCalendar.type === CalendarType.ICS && {
          icsUrl: currentCalendar.icsUrl,
          lastSync: currentCalendar.lastSync?.toISOString()
        })
      };
      
      const encryptedData = encryptData(calendarData, derivedKey, iv);
      
      // Update the calendar in the database with the complete data
      await updateCalendar(calendarId, encryptedData, iv, salt, currentCalendar.isDefault);
    } catch (error) {
      console.error('Error updating calendar:', error);
      setError('Failed to update calendar');
      throw error;
    }
  };

  // Handle calendar deletion
  const handleCalendarDelete = async (calendarId: string, moveEventsCallback: (eventId: string, targetCalendarId: string) => Promise<void>) => {
    if (!encryptionKey) return;
    
    try {
      // Find another calendar to move events to
      const remainingCalendars = calendars.filter(cal => cal.id !== calendarId);
      if (remainingCalendars.length === 0) {
        throw new Error('Cannot delete the only calendar');
      }
      
      // Prefer the default calendar as target, or use the first one
      const targetCalendarId = remainingCalendars.find(cal => cal.isDefault)?.id ?? remainingCalendars[0].id;
      
      // Delete the calendar from the database (event moving will be handled by the caller)
      await deleteCalendar(calendarId);
      
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
        isVisible: calendar.isVisible,
        type: calendar.type, // Preserve the calendar type
        ...(calendar.type === CalendarType.ICS && {
          icsUrl: calendar.icsUrl,
          lastSync: calendar.lastSync?.toISOString()
        })
      };
      
      const encryptedData = encryptData(calendarData, derivedKey, iv);
      
      // Update the calendar in the database with the current visibility state
      await updateCalendar(calendar.id, encryptedData, iv, salt, calendar.isDefault);
    } catch (error) {
      console.error('Error updating calendar in database:', error);
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
        isVisible: targetCalendar.isVisible,
        type: targetCalendar.type, // Preserve the calendar type
        ...(targetCalendar.type === CalendarType.ICS && {
          icsUrl: targetCalendar.icsUrl,
          lastSync: targetCalendar.lastSync?.toISOString()
        })
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

  // Load calendars when encryption key is available
  useEffect(() => {
    if (encryptionKey) {
      loadCalendarsAndSetState(encryptionKey).catch(err => {
        console.error('Failed to load calendars:', err);
        setError('Failed to load your calendars');
      });
    }
  }, [encryptionKey]);

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
