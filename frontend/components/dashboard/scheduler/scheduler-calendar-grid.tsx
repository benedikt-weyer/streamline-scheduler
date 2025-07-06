'use client';

import { useEffect, useState, useRef } from 'react';
import { format, isSameDay, differenceInMinutes, addMinutes } from 'date-fns';
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
  readonly activeTask?: { id: string; content: string; estimatedDuration?: number } | null;
}

export function SchedulerCalendarGrid({ 
  days, 
  events, 
  calendars,
  openEditDialog, 
  openNewEventDialog,
  onEventUpdate,
  activeTask
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

  // Task-duration-sized drop zone component
  const TaskDurationDropZone = ({ day, startHour, quarterIndex }: { day: Date; startHour: number; quarterIndex: number }) => {
    // Only show drop zones when there's an active task being dragged
    if (!activeTask) return null;
    
    const minutes = quarterIndex * 15; // 0, 15, 30, 45
    const slotTime = new Date(day);
    slotTime.setHours(startHour, minutes, 0, 0);
    
    // Calculate drop zone height based on task duration
    const taskDuration = activeTask.estimatedDuration || 60; // Default 1 hour
    const dropZoneHeightPixels = (taskDuration / 60) * slotHeight; // Convert minutes to pixels
    
    // Calculate if this drop zone would extend beyond the day's end
    const dayEndTime = new Date(day);
    dayEndTime.setHours(23, 59, 59, 999);
    const dropZoneEndTime = addMinutes(slotTime, taskDuration);
    
    // Skip drop zones that would extend beyond the current day
    if (dropZoneEndTime > dayEndTime) {
      return null;
    }
    
    const { isOver, setNodeRef } = useDroppable({
      id: `quarter-${format(day, 'yyyy-MM-dd')}-${startHour}-${quarterIndex}`,
      data: {
        date: day,
        time: slotTime
      }
    });

    return (
      <div
        ref={setNodeRef}
        className={`absolute transition-colors duration-200 ${
          isOver ? 'bg-primary/20 border-2 border-primary border-dashed' : 'hover:bg-accent/5'
        }`}
        style={{
          top: `${(startHour * slotHeight) + (quarterIndex * slotHeight / 4)}px`,
          height: `${dropZoneHeightPixels}px`,
          left: '2px',
          right: '2px',
          zIndex: 5
        }}
      >
        {isOver && (
          <div className="flex flex-col items-center justify-center h-full text-primary font-medium text-xs bg-primary/10 rounded">
            <div>{format(slotTime, 'HH:mm')}</div>
            <div className="text-xs opacity-75">{taskDuration}min</div>
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
              
              {/* Task-duration-sized drop zones for 15-minute intervals */}
              {(() => {
                // Calculate optimal spacing based on task duration to avoid overlap
                const taskDuration = activeTask?.estimatedDuration || 60;
                const dropZoneHeightHours = taskDuration / 60;
                
                // Use quarter-hour spacing for short tasks, half-hour for medium, hourly for long
                const spacingMinutes = taskDuration <= 30 ? 15 : taskDuration <= 90 ? 30 : 60;
                const spacingQuarters = spacingMinutes / 15;
                
                const dropZones: React.ReactNode[] = [];
                
                for (let hourIndex = 0; hourIndex < timeSlots.length; hourIndex++) {
                  for (let quarterIndex = 0; quarterIndex < 4; quarterIndex += spacingQuarters) {
                    if (quarterIndex >= 4) break; // Don't exceed 4 quarters per hour
                    
                    dropZones.push(
                      <TaskDurationDropZone 
                        key={`drop-${day.toISOString()}-${hourIndex}-${quarterIndex}`}
                        day={day} 
                        startHour={hourIndex}
                        quarterIndex={quarterIndex}
                      />
                    );
                  }
                }
                
                return dropZones;
              })()}
              
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