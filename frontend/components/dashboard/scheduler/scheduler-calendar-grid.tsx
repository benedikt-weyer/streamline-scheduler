'use client';

import { useEffect, useState, useRef } from 'react';
import { format, isSameDay, differenceInMinutes } from 'date-fns';
import { CalendarEvent } from '@/utils/calendar/calendar-types';
import { generateTimeSlots } from '@/utils/calendar/calendar';
import { calculateCalendarDimensions, calculateEventRendering, groupOverlappingEvents } from '@/utils/calendar/calendar-render';
import { useDroppable } from '@dnd-kit/core';

interface SchedulerCalendarGridProps {
  readonly days: Date[];
  readonly events: CalendarEvent[];
  readonly calendars?: { id: string; color: string; name: string; isVisible: boolean }[];
  readonly openEditDialog: (event: CalendarEvent) => void;
  readonly openNewEventDialog: (day: Date) => void;
  readonly onEventUpdate?: (updatedEvent: CalendarEvent) => void;
}

export function SchedulerCalendarGrid({ 
  days, 
  events, 
  calendars,
  openEditDialog, 
  openNewEventDialog,
  onEventUpdate 
}: SchedulerCalendarGridProps) {
  const timeSlots = generateTimeSlots();
  const [slotHeight, setSlotHeight] = useState(35);
  const containerRef = useRef<HTMLDivElement>(null);
  const [currentTime, setCurrentTime] = useState(new Date());

  // Update current time every minute
  useEffect(() => {
    setCurrentTime(new Date());
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  // Calculate calendar height based on window size
  useEffect(() => {
    const calculateCalendarHeightAndSlotSize = () => {
      const { slotHeight: newSlotHeight } = calculateCalendarDimensions(timeSlots.length);
      setSlotHeight(newSlotHeight);
    };
    
    calculateCalendarHeightAndSlotSize();
    window.addEventListener('resize', calculateCalendarHeightAndSlotSize);
    return () => window.removeEventListener('resize', calculateCalendarHeightAndSlotSize);
  }, [timeSlots.length]);

  // Handle click on a day cell
  const handleDayClick = (day: Date, e: React.MouseEvent) => {
    if (containerRef.current) {
      const dayColumnElement = e.currentTarget as HTMLElement;
      const rect = dayColumnElement.getBoundingClientRect();
      const relativeY = e.clientY - rect.top;
      
      const totalMinutes = (relativeY / slotHeight) * 60;
      const snappedMinutes = Math.round(totalMinutes / 15) * 15;
      const hours = Math.floor(snappedMinutes / 60);
      const minutes = snappedMinutes % 60;
      
      const clickedDateTime = new Date(day);
      clickedDateTime.setHours(hours, minutes, 0, 0);
      
      openNewEventDialog(clickedDateTime);
    } else {
      openNewEventDialog(day);
    }
  };

  // Handle click on an event
  const handleEventClick = (e: React.MouseEvent, event: CalendarEvent) => {
    e.stopPropagation();
    openEditDialog(event);
  };

  // Time slot drop zone component
  const TimeSlotDropZone = ({ day, slotIndex }: { day: Date; slotIndex: number }) => {
    const slotTime = new Date(day);
    slotTime.setHours(slotIndex, 0, 0, 0);
    
    const { isOver, setNodeRef } = useDroppable({
      id: `time-slot-${format(day, 'yyyy-MM-dd')}-${slotIndex}`,
      data: {
        date: day,
        time: slotTime,
        slotIndex
      }
    });

    return (
      <div
        ref={setNodeRef}
        className={`absolute w-full transition-colors duration-200 ${
          isOver ? 'bg-primary/20 border-2 border-primary border-dashed' : 'hover:bg-accent/30'
        }`}
        style={{
          top: `${slotIndex * slotHeight}px`,
          height: `${slotHeight}px`,
          zIndex: 5
        }}
      >
        {isOver && (
          <div className="flex items-center justify-center h-full text-primary font-medium text-sm">
            Drop task here
          </div>
        )}
      </div>
    );
  };

  // Render a single event
  const renderSingleEvent = (event: CalendarEvent, day: Date, dayIndex: number) => {
    const startTime = new Date(event.startTime);
    const endTime = new Date(event.endTime);
    
    const dayStart = new Date(day);
    dayStart.setHours(0, 0, 0, 0);
    
    const startMinutes = differenceInMinutes(startTime, dayStart);
    const duration = differenceInMinutes(endTime, startTime);
    
    const top = (startMinutes / 60) * slotHeight;
    const height = Math.max((duration / 60) * slotHeight, 20);
    
    const calendar = calendars?.find(cal => cal.id === event.calendarId);
    const bgColor = calendar?.color || '#3b82f6';
    
    return (
      <div
        key={event.id}
        className="absolute rounded-md px-2 py-1 overflow-hidden text-sm text-white shadow-sm cursor-pointer hover:shadow-md transition-shadow"
        style={{
          top: `${top}px`,
          height: `${height}px`,
          left: '4px',
          right: '4px',
          backgroundColor: bgColor,
          zIndex: 10
        }}
        onClick={(e) => handleEventClick(e, event)}
      >
        <div className="font-medium truncate">{event.title}</div>
        {height > 25 && (
          <div className="text-xs truncate">
            {format(startTime, "HH:mm")} - {format(endTime, "HH:mm")}
          </div>
        )}
      </div>
    );
  };

  // Render events for a day
  const renderEvents = (day: Date, dayIndex: number) => {
    const dayEvents = events.filter(event => 
      isSameDay(event.startTime, day) || isSameDay(event.endTime, day)
    );
    
    if (!dayEvents.length) return null;
    
    return dayEvents.map(event => renderSingleEvent(event, day, dayIndex));
  };

  // Calculate current time indicator position
  const calculateCurrentTimePosition = (day: Date): number | null => {
    if (!isSameDay(currentTime, day)) return null;
    
    const dayStart = new Date(day);
    dayStart.setHours(0, 0, 0, 0);
    
    const minutesSinceMidnight = differenceInMinutes(currentTime, dayStart);
    return (minutesSinceMidnight / 60) * slotHeight;
  };

  // Render current time line
  const renderCurrentTimeLine = (day: Date): React.ReactNode => {
    const position = calculateCurrentTimePosition(day);
    if (position === null) return null;
    
    return (
      <div 
        className="absolute w-full bg-red-500 z-20 pointer-events-none h-[2px] -translate-y-1/2"
        style={{ top: `${position}px` }}
      >
        <div className="absolute bg-red-500 text-white text-xs px-1 py-[1px] rounded-sm -translate-x-full">
          {format(currentTime, "HH:mm")}
        </div>
      </div>
    );
  };

  return (
    <div className="border rounded-lg shadow-sm bg-card">
      {/* Calendar header */}
      <div className="grid grid-cols-[60px_1fr] border-b">
        <div className="border-r"></div>
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
      
      {/* Calendar grid */}
      <div 
        ref={containerRef}
        className="grid grid-cols-[60px_1fr] overflow-y-auto relative"
        style={{ height: `${slotHeight * timeSlots.length}px` }}
      >
        {/* Time labels */}
        <div className="border-r relative">
          {timeSlots.map((slot, i) => (
            <div 
              key={`time-${slot}`}
              className="absolute text-xs text-right pr-2 bg-background flex items-center justify-end"
              style={{ 
                top: `${i * slotHeight}px`,
                left: 0,
                right: 0,
                height: `${slotHeight}px`,
                zIndex: 15
              }}
            >
              {slot !== "00:00" ? slot : ""}
            </div>
          ))}
        </div>
        
        {/* Days grid */}
        <div className="grid grid-cols-7">
          {days.map((day, dayIndex) => (
            <div 
              key={day.toString()} 
              className="relative border-r last:border-r-0 day-column"
              onClick={(e) => handleDayClick(day, e)}
              style={{ height: `${slotHeight * timeSlots.length}px` }}
              data-date={format(day, "yyyy-MM-dd")}
            >
              {/* Time slot lines */}
              {timeSlots.map((slot, i) => (
                <div 
                  key={`slot-${day.toISOString()}-${i}`}
                  className="absolute border-b w-full"
                  style={{ 
                    top: `${i * slotHeight}px`,
                    height: `${slotHeight}px` 
                  }}
                />
              ))}
              
              {/* Drop zones for each hour slot */}
              {timeSlots.map((slot, i) => (
                <TimeSlotDropZone 
                  key={`drop-${day.toISOString()}-${i}`}
                  day={day} 
                  slotIndex={i} 
                />
              ))}
              
              {/* Current time indicator */}
              {renderCurrentTimeLine(day)}
              
              {/* Events for this day */}
              {renderEvents(day, dayIndex)}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
} 