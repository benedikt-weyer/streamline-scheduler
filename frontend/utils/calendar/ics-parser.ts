import { CalendarEvent } from './calendar-types';

interface ICSEvent {
  summary: string;
  description?: string;
  location?: string;
  dtstart: string;
  dtend: string;
  uid: string;
  created?: string;
  'last-modified'?: string;
  isAllDay?: boolean; // Track if this is an all-day event
}

/**
 * Parse ICS calendar data and convert to CalendarEvent objects
 */
export function parseICSData(icsData: string, calendarId: string): CalendarEvent[] {
  const events: CalendarEvent[] = [];
  
  try {
    // Split the ICS data into lines and clean them
    const lines = icsData.split('\n').map(line => line.trim()).filter(line => line);
    
    let currentEvent: Partial<ICSEvent> = {};
    let inEvent = false;
    
    for (const line of lines) {
      if (line === 'BEGIN:VEVENT') {
        inEvent = true;
        currentEvent = {};
      } else if (line === 'END:VEVENT') {
        inEvent = false;
        
        // Convert the ICS event to CalendarEvent
        if (currentEvent.summary && currentEvent.dtstart && currentEvent.dtend && currentEvent.uid) {
          const event = convertICSEventToCalendarEvent(currentEvent as ICSEvent, calendarId);
          if (event) {
            events.push(event);
          }
        }
        
        currentEvent = {};
      } else if (inEvent) {
        // Parse event properties
        const colonIndex = line.indexOf(':');
        if (colonIndex > 0) {
          const key = line.substring(0, colonIndex).toLowerCase();
          const value = line.substring(colonIndex + 1);
          
          switch (key) {
            case 'summary':
              currentEvent.summary = value;
              break;
            case 'description':
              currentEvent.description = value;
              break;
            case 'location':
              currentEvent.location = value;
              break;
            case 'dtstart':
              currentEvent.dtstart = value;
              break;
            case 'dtstart;value=date':
              currentEvent.dtstart = value;
              currentEvent.isAllDay = true;
              break;
            case 'dtend':
              currentEvent.dtend = value;
              break;
            case 'dtend;value=date':
              currentEvent.dtend = value;
              currentEvent.isAllDay = true;
              break;
            case 'uid':
              currentEvent.uid = value;
              break;
            case 'created':
              currentEvent.created = value;
              break;
            case 'last-modified':
              currentEvent['last-modified'] = value;
              break;
            default:
              // Handle DTSTART and DTEND with timezone info
              if (key.startsWith('dtstart')) {
                currentEvent.dtstart = value;
                // Check if it's a date-only format (VALUE=DATE)
                if (key.includes('value=date')) {
                  currentEvent.isAllDay = true;
                }
              } else if (key.startsWith('dtend')) {
                currentEvent.dtend = value;
                // Check if it's a date-only format (VALUE=DATE)
                if (key.includes('value=date')) {
                  currentEvent.isAllDay = true;
                }
              }
              break;
          }
        }
      }
    }
  } catch (error) {
    console.error('Error parsing ICS data:', error);
  }
  
  return events;
}

/**
 * Convert ICS event to CalendarEvent
 */
function convertICSEventToCalendarEvent(icsEvent: ICSEvent, calendarId: string): CalendarEvent | null {
  try {
    const startTime = parseICSDateTime(icsEvent.dtstart);
    let endTime = parseICSDateTime(icsEvent.dtend);
    
    if (!startTime || !endTime) {
      return null;
    }
    
    // Detect if this is an all-day event
    const isAllDay = icsEvent.isAllDay || isDateOnlyFormat(icsEvent.dtstart);
    
    // For all-day events, the end date in ICS is exclusive (e.g., an event on May 5th has DTEND on May 6th)
    // We need to subtract one day from the end time for all-day events to get the correct display
    if (isAllDay) {
      const adjustedEndTime = new Date(endTime);
      adjustedEndTime.setDate(adjustedEndTime.getDate() - 1);
      
      // Set the end time to the end of the day (23:59:59.999) for proper all-day event handling
      adjustedEndTime.setHours(23, 59, 59, 999);
      endTime = adjustedEndTime;
      
      // For all-day events, also ensure start time is at beginning of day
      startTime.setHours(0, 0, 0, 0);
    }
    
    const event: CalendarEvent = {
      id: `ics-${calendarId}-${icsEvent.uid}`, // Prefix with 'ics-' and calendar ID
      title: icsEvent.summary || 'Untitled Event',
      description: icsEvent.description || undefined,
      location: icsEvent.location || undefined,
      start_time: startTime.toISOString(),
      end_time: endTime.toISOString(),
      all_day: isAllDay,
      calendar_id: calendarId,
      created_at: icsEvent.created ? parseICSDateTime(icsEvent.created)?.toISOString() || new Date().toISOString() : new Date().toISOString(),
      updated_at: icsEvent['last-modified'] ? parseICSDateTime(icsEvent['last-modified'])?.toISOString() || new Date().toISOString() : new Date().toISOString(),
      user_id: '',
    };
    
    return event;
  } catch (error) {
    console.error('Error converting ICS event:', error);
    return null;
  }
}

/**
 * Parse ICS datetime string to Date object
 */
function parseICSDateTime(dateTimeString: string): Date | null {
  try {
    // Remove timezone info for now (basic implementation)
    const cleanDateTime = dateTimeString.replace(/TZID=.*?:/, '');
    
    // Handle different date formats
    if (cleanDateTime.includes('T')) {
      // Full datetime: YYYYMMDDTHHMMSS or YYYYMMDDTHHMMSSZ
      const match = cleanDateTime.match(/(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})/);
      if (match) {
        const [, year, month, day, hour, minute, second] = match;
        return new Date(parseInt(year), parseInt(month) - 1, parseInt(day), parseInt(hour), parseInt(minute), parseInt(second));
      }
    } else {
      // Date only: YYYYMMDD
      const match = cleanDateTime.match(/(\d{4})(\d{2})(\d{2})/);
      if (match) {
        const [, year, month, day] = match;
        return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
      }
    }
    
    return null;
  } catch (error) {
    console.error('Error parsing ICS datetime:', dateTimeString, error);
    return null;
  }
}

/**
 * Check if a date string is in a date-only format (YYYYMMDD without time)
 */
function isDateOnlyFormat(dateTimeString: string): boolean {
  // Check if it's exactly 8 digits (YYYYMMDD) without time component
  return /^\d{8}$/.test(dateTimeString);
}

/**
 * Fetch ICS calendar from URL (client-side)
 * Note: This requires CORS-enabled URLs. The calendar provider must allow cross-origin requests.
 */
export async function fetchICSCalendar(url: string): Promise<string> {
  try {
    // Fetch directly from the ICS URL (requires CORS support)
    const response = await fetch(url, {
      method: 'GET',
      // Add a reasonable timeout
      signal: AbortSignal.timeout(30000) // 30 second timeout
    });
    
    if (!response.ok) {
      if (response.status === 0 || response.type === 'opaque') {
        throw new Error('CORS_ERROR: The calendar URL does not allow cross-origin requests. Please use a CORS-enabled calendar URL or contact your calendar provider.');
      }
      throw new Error(`Failed to fetch ICS calendar: ${response.status} ${response.statusText}`);
    }
    
    const icsData = await response.text();
    
    // Basic validation to ensure it's actually ICS data
    if (!icsData.includes('BEGIN:VCALENDAR')) {
      throw new Error('Invalid ICS file format - the URL does not point to a valid calendar file');
    }
    
    return icsData;
  } catch (error) {
    console.error('Error fetching ICS calendar:', error);
    
    // Handle network errors that might be CORS-related
    if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
      throw new Error('CORS_ERROR: Unable to fetch calendar - this is likely due to CORS restrictions. Please ensure your calendar URL supports cross-origin requests.');
    }
    
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('Request timeout - calendar URL took too long to respond');
    }
    
    throw error;
  }
}

/**
 * Fetch and parse ICS calendar
 */
export async function fetchAndParseICSCalendar(url: string, calendarId: string): Promise<CalendarEvent[]> {
  try {
    const icsData = await fetchICSCalendar(url);
    return parseICSData(icsData, calendarId);
  } catch (error) {
    console.error('Error fetching and parsing ICS calendar:', error);
    throw error;
  }
} 