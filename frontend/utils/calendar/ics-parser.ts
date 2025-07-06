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
            case 'dtstart;value=date':
              currentEvent.dtstart = value;
              break;
            case 'dtend':
            case 'dtend;value=date':
              currentEvent.dtend = value;
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
              } else if (key.startsWith('dtend')) {
                currentEvent.dtend = value;
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
    const endTime = parseICSDateTime(icsEvent.dtend);
    
    if (!startTime || !endTime) {
      return null;
    }
    
    const event: CalendarEvent = {
      id: `ics-${calendarId}-${icsEvent.uid}`, // Prefix with 'ics-' and calendar ID
      title: icsEvent.summary || 'Untitled Event',
      description: icsEvent.description || undefined,
      location: icsEvent.location || undefined,
      startTime,
      endTime,
      calendarId,
      createdAt: icsEvent.created ? parseICSDateTime(icsEvent.created) || new Date() : new Date(),
      updatedAt: icsEvent['last-modified'] ? parseICSDateTime(icsEvent['last-modified']) || undefined : undefined
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
 * Fetch ICS calendar from URL
 */
export async function fetchICSCalendar(url: string): Promise<string> {
  try {
    // Use a CORS proxy or server-side endpoint to fetch the ICS file
    const response = await fetch(`/api/ics-proxy?url=${encodeURIComponent(url)}`);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch ICS calendar: ${response.status}`);
    }
    
    const icsData = await response.text();
    return icsData;
  } catch (error) {
    console.error('Error fetching ICS calendar:', error);
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