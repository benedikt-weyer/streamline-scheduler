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

  return (
    <div className="flex flex-col h-full">
      {/* Day Navigation Header */}
      <div className="flex items-center justify-between mb-4 pb-3 border-b">
        <Button
          variant="outline"
          size="sm"
          onClick={goToPreviousDay}
          disabled={selectedDayIndex === 0}
          className="flex items-center gap-1"
        >
          <ChevronLeft className="h-4 w-4" />
          Prev
        </Button>
        
        <div className="text-center">
          <div className="text-lg font-semibold">
            {format(selectedDay, 'EEEE')}
          </div>
          <div className="text-sm text-muted-foreground">
            {format(selectedDay, 'MMM d, yyyy')}
          </div>
        </div>
        
        <Button
          variant="outline"
          size="sm"
          onClick={goToNextDay}
          disabled={selectedDayIndex === days.length - 1}
          className="flex items-center gap-1"
        >
          Next
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Week Overview Bar */}
      <div className="flex gap-1 mb-4 overflow-x-auto pb-2" ref={scrollRef}>
        {days.map((day, index) => {
          const dayHasEvents = events.some(event => 
            isSameDay(event.startTime, day) || isSameDay(event.endTime, day)
          );
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
              {dayHasEvents && (
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
            {dayEvents.map((event) => {
              const style = getEventStyle(event);
              const color = getEventColor(event);
              
              return (
                <div
                  key={event.id}
                  className="absolute left-1 right-1 bg-opacity-90 rounded-md p-2 text-xs cursor-pointer pointer-events-auto shadow-sm border-l-4"
                  style={{
                    top: style.top,
                    height: style.height,
                    backgroundColor: `${color}20`,
                    borderLeftColor: color,
                    minHeight: '2rem'
                  }}
                  onClick={() => handleEventClick(event)}
                >
                  <div className="font-medium text-foreground line-clamp-1">
                    {event.title}
                  </div>
                  <div className="text-muted-foreground text-xs">
                    {format(event.startTime, 'HH:mm')} - {format(event.endTime, 'HH:mm')}
                  </div>
                  {event.location && (
                    <div className="text-muted-foreground text-xs line-clamp-1 mt-1">
                      📍 {event.location}
                    </div>
                  )}
                  {event.description && (
                    <div className="text-muted-foreground text-xs line-clamp-1 mt-1">
                      {event.description}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Add Event FAB */}
      <div className="fixed bottom-6 right-6 md:hidden">
        <Button
          size="lg"
          className="rounded-full h-14 w-14 shadow-lg"
          onClick={() => openNewEventDialog(selectedDay)}
        >
          <span className="text-2xl">+</span>
        </Button>
      </div>
    </div>
  );
} 