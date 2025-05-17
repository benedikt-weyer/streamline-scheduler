import { useEffect, useState, useRef } from 'react';

import { format, isSameDay, differenceInMinutes, addMinutes } from 'date-fns';

import { CalendarEvent } from '@/utils/types';
import { generateTimeSlots } from '@/utils/calendar';
import { calculateCalendarDimensions, calculateEventRendering } from '@/utils/calendar-render';
import { 
  DraggedEvent, 
  DragPosition, 
  calculateDraggingEventDateTime 
} from '@/utils/calendar-drag';


// -------- Prop Interfaces --------
interface CalendarGridProps {
  readonly days: Date[];
  readonly events: CalendarEvent[];
  readonly openEditDialog: (event: CalendarEvent) => void;
  readonly openNewEventDialog: (day: Date) => void;
  readonly onEventUpdate?: (updatedEvent: CalendarEvent) => void;
}


// -------- CalendarGrid Component --------
export function CalendarGrid({ 
  days, 
  events, 
  openEditDialog, 
  openNewEventDialog,
  onEventUpdate 
}: CalendarGridProps) {
  const timeSlots = generateTimeSlots();
  const [calendarHeight, setCalendarHeight] = useState<number | null>(null);
  const [slotHeight, setSlotHeight] = useState(35); // default slot height
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Track if we're currently dragging an event
  const [activeEvent, setActiveEvent] = useState<DraggedEvent | null>(null);
  
  // Visual position during drag (for visual feedback)
  const [dragPosition, setDragPosition] = useState<DragPosition | null>(null);
  
  // Flag to prevent click handlers during drag operations
  const isDraggingRef = useRef(false);

  // Calculate calendar height based on window size
  useEffect(() => {
    // Calculate on initial render
    calculateCalendarHeightAndSlotSize();
    
    // Recalculate on window resize
    window.addEventListener('resize', calculateCalendarHeightAndSlotSize);
    
    // Clean up event listener
    return () => window.removeEventListener('resize', calculateCalendarHeightAndSlotSize);
  }, [timeSlots.length]);

  // Extracted function to calculate calendar height and slot size
  const calculateCalendarHeightAndSlotSize = () => {
    const { calendarHeight: newHeight, slotHeight: newSlotHeight } = 
      calculateCalendarDimensions(timeSlots.length);
    
    setCalendarHeight(newHeight);
    setSlotHeight(newSlotHeight);
  };

  // Function to find which day column the mouse is over
  const findDayColumnAtPosition = (clientX: number): Element | null => {
    if (!containerRef.current || !activeEvent) return null;
    
    const dayColumns = containerRef.current.querySelectorAll('.day-column');
    if (!dayColumns.length) return null;

    for (const column of dayColumns) {
      const rect = column.getBoundingClientRect();
      if (clientX >= rect.left && clientX <= rect.right) {
        return column;
      }
    }
    return null;
  };

  // Function to get the date from the target column
  const getDateFromColumn = (column: Element): Date | null => {
    const dateString = column.getAttribute('data-date');
    if (!dateString) return null;
    return new Date(dateString);
  };

  // Add global mouse handlers for drag operations
  useEffect(() => {
    // Only attach if we have an event and the update handler
    if (!activeEvent || !onEventUpdate) return;    

    const handleMouseMove = (e: MouseEvent) => {
      // We're in a drag operation if the mouse moves significantly
      const dx = Math.abs(e.clientX - activeEvent.initialPosition.x);
      const dy = Math.abs(e.clientY - activeEvent.initialPosition.y);
      
      if (dx > 5 || dy > 5) {
        isDraggingRef.current = true;
      }
      
      // Update the visual position of the event being dragged
      if (isDraggingRef.current && containerRef.current) {
        updateDragPosition(e);
      }
    };
    
    // Extract position calculation logic to reduce complexity
    const updateDragPosition = (e: MouseEvent) => {
      
      // Find which day column we're over
      const columnMouseIsCurrentlyOver = findDayColumnAtPosition(e.clientX);
      if (!columnMouseIsCurrentlyOver) return;

      const targetDay = getDateFromColumn(columnMouseIsCurrentlyOver);
      if (!targetDay) return;

      // Calculate new position
      const columnMouseOverRect = columnMouseIsCurrentlyOver.getBoundingClientRect();
      
      // Calculate the new drag position using the utility function
      const result = calculateDraggingEventDateTime(
        e.clientY,
        columnMouseOverRect, 
        activeEvent, 
        slotHeight,
        targetDay
      );
      
      // Update the visual position state
      setDragPosition(result);

    };


    const handleMouseUp = (e: MouseEvent) => {
      // Only process the drag if we actually moved (isDragging)
      if (isDraggingRef.current && containerRef.current) {
        processDragEnd(e);
      }
      
      // Reset drag state after a short delay to prevent unwanted clicks
      setTimeout(() => {
        isDraggingRef.current = false;
      }, 50);
      
      cleanupDrag();
    };
    
    // Extract the drag end processing logic
    const processDragEnd = (e: MouseEvent) => {
      // Find which day column we're over
      const columnMouseIsCurrentlyOver = findDayColumnAtPosition(e.clientX);
      if (!columnMouseIsCurrentlyOver) return;

      const targetDay = getDateFromColumn(columnMouseIsCurrentlyOver);
      if (!targetDay) return;

      // Calculate new position
      const columnMouseOverRect = columnMouseIsCurrentlyOver.getBoundingClientRect();
      
      // Calculate the new drag position using the utility function
      const result = calculateDraggingEventDateTime(
        e.clientY,
        columnMouseOverRect, 
        activeEvent, 
        slotHeight,
        targetDay
      );
      
      // Create updated event
      const updatedEvent: CalendarEvent = {
        ...activeEvent.event,
        startTime: result.startTime,
        endTime: result.endTime,
        updatedAt: new Date()
      };
      
      // Update the event
      onEventUpdate(updatedEvent);
    };

    // Clean up function
    const cleanupDrag = () => {
      setActiveEvent(null);
      setDragPosition(null);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
    
    // Add event listeners
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    
    // Clean up on unmount or when activeEvent changes
    return cleanupDrag;
  }, [activeEvent, days, onEventUpdate, slotHeight]);

  // Handle the mouse down event on an event div
  const handleEventMouseDown = (
    e: React.MouseEvent, 
    event: CalendarEvent, 
    dayIndex: number
  ) => {
    // Only enable drag if we can update
    if (!onEventUpdate) return;
    
    e.preventDefault();
    e.stopPropagation();
    
    // Get the position of the click within the event element
    const eventRect = e.currentTarget.getBoundingClientRect();
    const offsetY = e.clientY - eventRect.top;
    
    // Set the active event with the offset position
    setActiveEvent({
      event,
      initialPosition: { x: e.clientX, y: e.clientY },
      offsetY
    });
  };

  // Handle click on a day cell - only if we're not dragging
  const handleDayClick = (day: Date, e: React.MouseEvent) => {
    // Don't open dialog if we're in a drag operation
    if (isDraggingRef.current || activeEvent) return;
    
    openNewEventDialog(day);
  };

  // Handle click on an event - only if we're not dragging
  const handleEventClick = (e: React.MouseEvent, event: CalendarEvent) => {
    e.stopPropagation();
    
    // Don't open the edit dialog if we're in a drag operation
    if (isDraggingRef.current) return;
    
    openEditDialog(event);
  };

  // Render a single event
  const renderSingleEvent = (event: CalendarEvent, day: Date, dayIndex: number) => {
    // Use the utility function to calculate rendering details
    const { eventStyles, startTime, endTime } = calculateEventRendering(event, day, slotHeight);
    
    return (
      <div
        key={event.id}
        className={`absolute rounded-md px-2 py-1 overflow-hidden text-sm text-white 
                   bg-blue-500 border border-blue-600 shadow-sm 
                   ${onEventUpdate ? 'cursor-move' : 'cursor-pointer'}`}
        style={eventStyles}
        onClick={(e) => handleEventClick(e, event)}
        onMouseDown={(e) => handleEventMouseDown(e, event, dayIndex)}
      >
        <div className="font-medium truncate">{event.title}</div>
        <div className="text-xs truncate">
          {format(startTime, "HH:mm")} - {format(endTime, "HH:mm")}
        </div>
      </div>
    );
  };

  // Render events in the calendar grid
  const renderEvents = (day: Date, dayIndex: number) => {
    const dayEvents = events.filter(event => 
      isSameDay(event.startTime, day) || isSameDay(event.endTime, day)
    );
    
    if (!dayEvents.length) return null;

    return dayEvents.map(event => renderSingleEvent(event, day, dayIndex));
  };

  // calculates if two date intervals are overlapping
  const areDatesOverlapping = (start1: Date, end1: Date, start2: Date, end2: Date): boolean => {
    return start1 < end2 && start2 < end1;
  };

  // gets the end of the day
  const getEndOfDay = (day: Date): Date => {
    const endOfDay = new Date(day);
    endOfDay.setHours(23, 59, 59, 999); // Set to the end of the day
    return endOfDay;
  };


  const renderDragHelper = (dayIndex: number, day: Date, dragPosition: DragPosition | null): React.ReactNode => {
    // Only render the drag helper for the day where dragging is active
    if (!activeEvent || !dragPosition) {
      return null;
    }

    // Only render drag helper if this day overlaps with the drag position date range   
    if (!areDatesOverlapping(
      dragPosition.startTime,
      dragPosition.endTime,
      day,
      getEndOfDay(day)
    )) {
      return null;
    }
    
    // Create a temporary event with the dragged position data
    const draggedEvent: CalendarEvent = {
      ...activeEvent.event,
      startTime: dragPosition.startTime,
      endTime: dragPosition.endTime
    };
    
    // Use a wrapper div to apply the opacity and prevent pointer events
    return (
      <div className="opacity-80 pointer-events-none" style={{ zIndex: 100 }}>
        {renderSingleEvent(draggedEvent, day, dayIndex)}
      </div>
    );
  }

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
        className="grid grid-cols-[60px_1fr] overflow-auto relative"
        style={{ height: calendarHeight ? `${calendarHeight}px` : 'auto' }}
      >
        {/* Time labels */}
        <div className="border-r relative">
          {timeSlots.map((slot, i) => (
            <div 
              key={`time-${slot}`}
              className="absolute text-xs text-right pr-2 bg-background flex items-center justify-end"
              style={{ 
                top: `${i * slotHeight - (slotHeight / 2)}px`,
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
              
              {/* Events for this day */}
              {renderEvents(day, dayIndex)}
              
              {/* Drag helper for this day */}
              {renderDragHelper(dayIndex, day, dragPosition)}
              
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}