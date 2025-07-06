'use client';

import { useState, useRef, useEffect } from 'react';
import { format, isSameDay, differenceInMinutes } from 'date-fns';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CalendarEvent } from '@/utils/calendar/calendar-types';

interface CalendarGridMobileProps {
  readonly days: Date[];
  readonly events: CalendarEvent[];
  readonly calendars?: { id: string; color: string; name: string; isVisible: boolean }[];
  readonly openEditDialog: (event: CalendarEvent) => void;
  readonly openNewEventDialog: (day: Date) => void;
  readonly onEventUpdate?: (updatedEvent: CalendarEvent) => void;
  readonly shouldSelectToday?: boolean;
}

export function CalendarGridMobile({
  days,
  events,
  calendars,
  openEditDialog,
  openNewEventDialog,
  onEventUpdate,
  shouldSelectToday = false
}: CalendarGridMobileProps) {
  const [selectedDayIndex, setSelectedDayIndex] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Effect to select today's date when shouldSelectToday changes
  useEffect(() => {
    if (shouldSelectToday) {
      const today = new Date();
      const todayIndex = days.findIndex(day => isSameDay(day, today));
      if (todayIndex !== -1) {
        setSelectedDayIndex(todayIndex);
      }
    }
  }, [shouldSelectToday, days]);

  // Generate time slots (simplified for mobile)
  const generateMobileTimeSlots = () => {
    const slots = [];
    for (let hour = 0; hour <= 23; hour++) {
      slots.push(`${hour.toString().padStart(2, '0')}:00`);
    }
    return slots;
  };

  const timeSlots = generateMobileTimeSlots();
  const selectedDay = days[selectedDayIndex];

  // Get events for the selected day
  const dayEvents = events.filter(event => 
    isSameDay(event.startTime, selectedDay) || isSameDay(event.endTime, selectedDay)
  );

  // Navigate to previous day
  const goToPreviousDay = () => {
    if (selectedDayIndex > 0) {
      setSelectedDayIndex(selectedDayIndex - 1);
    }
  };

  // Navigate to next day
  const goToNextDay = () => {
    if (selectedDayIndex < days.length - 1) {
      setSelectedDayIndex(selectedDayIndex + 1);
    }
  };

  // Handle event click
  const handleEventClick = (event: CalendarEvent) => {
    openEditDialog(event);
  };

  // Handle day time slot click
  const handleTimeSlotClick = (timeSlot: string) => {
    const [hour] = timeSlot.split(':').map(Number);
    const clickTime = new Date(selectedDay);
    clickTime.setHours(hour, 0, 0, 0);
    openNewEventDialog(clickTime);
  };

  // Calculate event position and height
  const getEventStyle = (event: CalendarEvent) => {
    const eventStart = new Date(event.startTime);
    const eventEnd = new Date(event.endTime);
    
    // Calculate start position (midnight = 0%)
    const dayStart = new Date(selectedDay);
    dayStart.setHours(0, 0, 0, 0);
    
    const startMinutesFromMidnight = differenceInMinutes(eventStart, dayStart);
    const topPercent = Math.max(0, (startMinutesFromMidnight / (24 * 60)) * 100); // 24 hours from midnight to midnight
    
    // Calculate height
    const durationMinutes = differenceInMinutes(eventEnd, eventStart);
    const heightPercent = (durationMinutes / (24 * 60)) * 100;
    
    return {
      top: `${topPercent}%`,
      height: `${Math.max(heightPercent, 2)}%`, // Minimum 2% height for 24-hour view
    };
  };

  // Get calendar color for event
  const getEventColor = (event: CalendarEvent) => {
    const calendar = calendars?.find(cal => cal.id === event.calendarId);
    return calendar?.color || '#4f46e5';
  };

  // Check if two events overlap
  const eventsOverlap = (event1: CalendarEvent, event2: CalendarEvent): boolean => {
    const start1 = new Date(event1.startTime);
    const end1 = new Date(event1.endTime);
    const start2 = new Date(event2.startTime);
    const end2 = new Date(event2.endTime);
    
    return start1 < end2 && start2 < end1;
  };

  // Group overlapping events
  const groupOverlappingEvents = (events: CalendarEvent[]): CalendarEvent[][] => {
    const groups: CalendarEvent[][] = [];
    const processed = new Set<string>();

    for (const event of events) {
      if (processed.has(event.id)) continue;

      const group = [event];
      processed.add(event.id);

      // Find all events that overlap with any event in the current group
      let hasNewOverlap = true;
      while (hasNewOverlap) {
        hasNewOverlap = false;
        for (const otherEvent of events) {
          if (processed.has(otherEvent.id)) continue;

          // Check if this event overlaps with any event in the group
          const overlapsWithGroup = group.some(groupEvent => eventsOverlap(groupEvent, otherEvent));
          if (overlapsWithGroup) {
            group.push(otherEvent);
            processed.add(otherEvent.id);
            hasNewOverlap = true;
          }
        }
      }

      groups.push(group);
    }

    return groups;
  };

  return (
    <div className="flex flex-col h-full">
      {/* Week Overview Bar */}
      <div className="flex gap-1 mb-4 overflow-x-auto pb-2" ref={scrollRef}>
        {days.map((day, index) => {
          const isSelected = index === selectedDayIndex;
          const isToday = isSameDay(day, new Date());
          
          return (
            <button
              key={day.toString()}
              onClick={() => setSelectedDayIndex(index)}
              className={`flex-shrink-0 w-12 h-16 rounded-lg border-2 flex flex-col items-center justify-center text-xs relative ${
                isSelected
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border bg-background hover:bg-muted'
              }`}
            >
              {/* Today indicator */}
              {isToday && (
                <div className={`absolute bottom-1 left-1/2 transform -translate-x-1/2 w-1.5 h-1.5 rounded-full ${
                  isSelected ? 'bg-primary-foreground' : 'bg-primary'
                }`} />
              )}
              
              <div className="font-medium">
                {format(day, 'EEE')}
              </div>
              <div className={`text-lg font-bold ${
                isSelected 
                  ? (isToday ? 'text-primary-foreground font-extrabold' : 'text-primary-foreground')
                  : (isToday ? 'text-primary' : '')
              }`}>
                {format(day, 'd')}
              </div>
              {isToday && (
                <div className="w-1 h-1 rounded-full bg-current mt-1" />
              )}
            </button>
          );
        })}
      </div>

      {/* Time Slots and Events */}
      <div className="flex-1 relative overflow-y-auto">
        <div className="relative">
          {/* Time slots */}
          {timeSlots.map((timeSlot, index) => (
            <div
              key={timeSlot}
              className="relative border-b border-border h-16 flex items-start"
              onClick={() => handleTimeSlotClick(timeSlot)}
            >
              <div className="w-16 text-xs text-muted-foreground pt-1 pr-2 text-right">
                {timeSlot}
              </div>
              <div className="flex-1 h-full cursor-pointer hover:bg-muted/30 transition-colors" />
            </div>
          ))}
          
          {/* Events overlay */}
          <div className="absolute inset-0 ml-16 pointer-events-none">
            {groupOverlappingEvents(dayEvents).flatMap(group => {
              // For non-overlapping events (group of 1), render normally
              if (group.length === 1) {
                const event = group[0];
                const style = getEventStyle(event);
                const color = getEventColor(event);
                
                return (
                  <div
                    key={event.id}
                    className="absolute left-1 right-1 rounded-md p-2 text-xs cursor-pointer pointer-events-auto shadow-sm border-l-4"
                    style={{
                      top: style.top,
                      height: style.height,
                      backgroundColor: color,
                      borderLeftColor: color,
                      minHeight: '2rem'
                    }}
                    onClick={() => handleEventClick(event)}
                  >
                    <div className="font-medium text-white line-clamp-1">
                      {event.title}
                    </div>
                    <div className="text-white text-xs opacity-90">
                      {format(event.startTime, 'HH:mm')} - {format(event.endTime, 'HH:mm')}
                    </div>
                    {event.location && (
                      <div className="text-white text-xs line-clamp-1 mt-1 opacity-90">
                        📍 {event.location}
                      </div>
                    )}
                    {event.description && (
                      <div className="text-white text-xs line-clamp-1 mt-1 opacity-90">
                        {event.description}
                      </div>
                    )}
                  </div>
                );
              }
              
              // For overlapping events, render each in its own column
              return group.map((event, columnIndex) => {
                const style = getEventStyle(event);
                const color = getEventColor(event);
                const totalColumns = group.length;
                const columnWidth = 100 / totalColumns;
                const leftPosition = columnWidth * columnIndex;
                
                return (
                  <div
                    key={event.id}
                    className="absolute rounded-md p-2 text-xs cursor-pointer pointer-events-auto shadow-sm border-l-4"
                    style={{
                      top: style.top,
                      height: style.height,
                      backgroundColor: color,
                      borderLeftColor: color,
                      minHeight: '2rem',
                      width: `calc(${columnWidth}% - 4px)`,
                      left: `calc(${leftPosition}% + 4px)`
                    }}
                    onClick={() => handleEventClick(event)}
                  >
                    <div className="font-medium text-white line-clamp-1">
                      {event.title}
                    </div>
                    <div className="text-white text-xs opacity-90">
                      {format(event.startTime, 'HH:mm')} - {format(event.endTime, 'HH:mm')}
                    </div>
                    {event.location && (
                      <div className="text-white text-xs line-clamp-1 mt-1 opacity-90">
                        📍 {event.location}
                      </div>
                    )}
                    {event.description && (
                      <div className="text-white text-xs line-clamp-1 mt-1 opacity-90">
                        {event.description}
                      </div>
                    )}
                  </div>
                );
              });
            })}
          </div>
        </div>
      </div>

      {/* Add Event FAB */}
      <div className="fixed bottom-6 right-6 md:hidden">
        <Button
          className="rounded-full h-14 w-14 shadow-lg flex items-center justify-center p-0 min-w-0"
          onClick={() => openNewEventDialog(selectedDay)}
        >
          <span className="text-2xl">+</span>
        </Button>
      </div>
    </div>
  );
} 