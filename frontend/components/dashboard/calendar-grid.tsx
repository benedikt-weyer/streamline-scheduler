import { format, isSameDay, differenceInMinutes, setHours, setMinutes } from 'date-fns';
import { CalendarEvent } from '@/utils/types';
import { generateTimeSlots } from '@/utils/calendar';
import { useEffect, useState, useRef } from 'react';

interface CalendarGridProps {
  days: Date[];
  events: CalendarEvent[];
  openEditDialog: (event: CalendarEvent) => void;
  openNewEventDialog: (day: Date) => void;
}

export function CalendarGrid({ days, events, openEditDialog, openNewEventDialog }: CalendarGridProps) {
  const timeSlots = generateTimeSlots();
  const [calendarHeight, setCalendarHeight] = useState<number | null>(null);
  const [slotHeight, setSlotHeight] = useState(35); // default slot height
  const containerRef = useRef<HTMLDivElement>(null);

  // Calculate calendar height based on window size
  useEffect(() => {
    const calculateHeight = () => {
      // Get viewport height
      const viewportHeight = window.innerHeight;
      // Approximate header heights (page header, calendar header, etc.)
      const headerOffset = 180; 
      // Provide some padding at the bottom
      const bottomPadding = 20;
      // Calculate available height
      const availableHeight = viewportHeight - headerOffset - bottomPadding;
      
      // Set height, with a minimum to ensure visibility
      const newHeight = Math.max(availableHeight, 500);
      setCalendarHeight(newHeight);
      
      // Calculate slot height based on available height and number of slots
      // Subtract a small amount for borders
      const totalSlots = timeSlots.length;
      const calculatedSlotHeight = Math.max(
        Math.floor((newHeight - 2) / totalSlots), 
        25 // Minimum slot height
      );
      
      setSlotHeight(calculatedSlotHeight);
    };

    // Calculate on initial render
    calculateHeight();
    
    // Recalculate on window resize
    window.addEventListener('resize', calculateHeight);
    
    // Clean up event listener
    return () => window.removeEventListener('resize', calculateHeight);
  }, [timeSlots.length]);

  // Position and size events on the grid
  const renderEvents = (day: Date) => {
    const dayEvents = events.filter(event => 
      isSameDay(event.startTime, day) || isSameDay(event.endTime, day)
    );
    
    if (!dayEvents.length) return null;

    return dayEvents.map(event => {
      // Adjust times for events that cross days
      const eventStart = isSameDay(event.startTime, day) ? event.startTime : setHours(setMinutes(day, 0), 0);
      const eventEnd = isSameDay(event.endTime, day) ? event.endTime : setHours(setMinutes(day, 0), 24);
      
      // Calculate position from top (based on start time)
      const dayStartTime = setHours(setMinutes(new Date(day), 0), 0); // 00:00
      const minutesFromDayStart = differenceInMinutes(eventStart, dayStartTime);
      const topPosition = (minutesFromDayStart / 60) * slotHeight; // each hour slot has dynamic height
      
      // Calculate height (based on duration)
      const durationInMinutes = differenceInMinutes(eventEnd, eventStart);
      const height = (durationInMinutes / 60) * slotHeight; // each hour slot has dynamic height
      
      return (
        <div
          key={event.id}
          className="absolute rounded-md px-2 py-1 overflow-hidden text-sm text-white bg-blue-500 border border-blue-600 shadow-sm"
          style={{
            top: `${topPosition}px`,
            height: `${height}px`,
            width: 'calc(100% - 8px)',
            zIndex: 10
          }}
          onClick={(e) => {
            e.stopPropagation();
            openEditDialog(event);
          }}
        >
          <div className="font-medium truncate">{event.title}</div>
          <div className="text-xs truncate">
            {format(event.startTime, "HH:mm")} - {format(event.endTime, "HH:mm")}
          </div>
        </div>
      );
    });
  };

  return (
    <div className="border rounded-lg shadow-sm bg-card">
      {/* Calendar header with days of the week */}
      <div className="grid grid-cols-[60px_1fr] border-b">
        {/* Empty cell in the top-left corner for alignment */}
        <div className="border-r"></div>
        
        {/* Days of the week */}
        <div className="grid grid-cols-7">
          {days.map(day => (
            <div 
              key={day.toString()} 
              className="px-2 py-3 text-center border-r last:border-r-0 font-medium flex gap-2 items-center justify-center"
            >
              <div>{format(day, "EEE.")}</div>
              <div className={`text-lg ${isSameDay(day, new Date()) ? 'bg-primary text-primary-foreground rounded-full w-8 h-8 flex items-center justify-center' : ''}`}>
                {format(day, "d")}
              </div>
            </div>
          ))}
        </div>
      </div>
      
      {/* Calendar grid with time slots - dynamic height based on viewport */}
      <div 
        ref={containerRef}
        className="grid grid-cols-[60px_1fr] overflow-auto"
        style={{ height: calendarHeight ? `${calendarHeight}px` : 'auto' }}
      >
        {/* Time labels */}
        <div className="border-r relative">
          {timeSlots.map((slot, index) => (
            // Skip rendering the 00:00 label, but keep its space
            <div 
              key={index} 
              className="absolute text-xs text-right pr-2 bg-background flex items-center justify-end"
              style={{ 
                top: `${index * slotHeight - (slotHeight / 2)}px`,
                left: 0,
                right: 0,
                height: `${slotHeight}px`,
                zIndex: 20
              }}
            >
              {slot !== "00:00" ? slot : ""}
            </div>
          ))}
        </div>
        
        {/* Days grid */}
        <div className="grid grid-cols-7">
          {days.map((day) => (
            <div 
              key={day.toString()} 
              className="relative border-r last:border-r-0"
              onClick={() => openNewEventDialog(day)}
              style={{ height: `${slotHeight * timeSlots.length}px` }}
            >
              {/* Time slot lines */}
              {timeSlots.map((_, index) => (
                <div 
                  key={index} 
                  className="absolute border-b w-full"
                  style={{ 
                    top: `${index * slotHeight}px`,
                    height: `${slotHeight}px` 
                  }}
                />
              ))}
              
              {/* Events for this day */}
              {renderEvents(day)}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}