import { format, isSameDay, differenceInMinutes, addMinutes } from 'date-fns';
import { CalendarEvent } from '@/utils/types';
import { generateTimeSlots } from '@/utils/calendar';
import { useEffect, useState, useRef } from 'react';
import { 
  DraggedEvent, 
  DragPosition, 
  getTimeFromPosition, 
  calculateSnappedYPosition, 
  calculateDragPosition 
} from '@/utils/calendar-drag';
import { calculateCalendarDimensions, calculateEventRendering } from '@/utils/calendar-render';

interface CalendarGridProps {
  readonly days: Date[];
  readonly events: CalendarEvent[];
  readonly openEditDialog: (event: CalendarEvent) => void;
  readonly openNewEventDialog: (day: Date) => void;
  readonly onEventUpdate?: (updatedEvent: CalendarEvent) => void;
}

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
      if (!containerRef.current || !activeEvent) return;
      
      const dayColumns = containerRef.current.querySelectorAll('.day-column');
      if (!dayColumns.length) return;
      
      // Find which day column we're over
      let targetDayIndex = activeEvent.dayIndex;
      let targetElement: Element | null = null;
      
      for (let i = 0; i < dayColumns.length; i++) {
        const column = dayColumns[i];
        const rect = column.getBoundingClientRect();
        
        if (e.clientX >= rect.left && e.clientX <= rect.right) {
          targetDayIndex = i;
          targetElement = column;
          break;
        }
      }
      
      if (targetElement) {
        updateDragPositionForDay(e, targetElement, targetDayIndex);
      }
    };

    // Further reduce complexity by extracting day-specific logic
    const updateDragPositionForDay = (e: MouseEvent, targetElement: Element, targetDayIndex: number) => {
      if (!activeEvent) return;
      
      // Calculate new position
      const rect = targetElement.getBoundingClientRect();
      
      // Account for the offset where the user initially clicked on the event
      const relativeY = e.clientY - rect.top - activeEvent.offsetY;
      
      // Get the day from the columns
      const targetDay = days[targetDayIndex];
      
      // Calculate the new drag position using the utility function
      const result = calculateDragPosition(
        relativeY, 
        rect, 
        targetDay, 
        activeEvent, 
        targetDayIndex,
        slotHeight
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
      // Get the day columns
      const dayColumns = containerRef.current!.querySelectorAll('.day-column');
      if (!dayColumns.length) return;
      
      // Find which day column we're over
      let targetDayIndex = activeEvent!.dayIndex;
      let targetElement: Element | null = null;
      
      for (let i = 0; i < dayColumns.length; i++) {
        const column = dayColumns[i];
        const rect = column.getBoundingClientRect();
        
        if (e.clientX >= rect.left && e.clientX <= rect.right) {
          targetDayIndex = i;
          targetElement = column;
          break;
        }
      }
      
      if (targetElement) {
        processEventPositionUpdate(e, targetElement, targetDayIndex);
      }
    };
    
    // Extract the position update logic
    const processEventPositionUpdate = (e: MouseEvent, targetElement: Element, targetDayIndex: number) => {
      // Calculate new position
      const rect = targetElement.getBoundingClientRect();
      // Use the same offset that we applied during drag for consistency
      const relativeY = e.clientY - rect.top - activeEvent!.offsetY;
      
      // Get the day from the columns
      const targetDay = days[targetDayIndex];
      
      // Calculate snapped position with constraints using the utility function
      const snappedY = calculateSnappedYPosition(relativeY, rect, activeEvent!, slotHeight);
      
      // Calculate new times using the snapped position
      const newStartTime = getTimeFromPosition(snappedY, targetDay, slotHeight);
      const duration = differenceInMinutes(
        activeEvent!.event.endTime, 
        activeEvent!.event.startTime
      );
      const newEndTime = addMinutes(newStartTime, duration);
      
      // Create updated event
      const updatedEvent: CalendarEvent = {
        ...activeEvent!.event,
        startTime: newStartTime,
        endTime: newEndTime,
        updatedAt: new Date()
      };
      
      // Update the event
      onEventUpdate!(updatedEvent);
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
      dayIndex,
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

  // Render events in the calendar grid
  const renderEvents = (day: Date, dayIndex: number) => {
    const dayEvents = events.filter(event => 
      isSameDay(event.startTime, day) || isSameDay(event.endTime, day)
    );
    
    if (!dayEvents.length) return null;

    return dayEvents.map(event => {
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
              {dragPosition && dragPosition.dayIndex === dayIndex && activeEvent && (
                <div
                  className="absolute rounded-md px-2 py-1 overflow-hidden text-sm text-white 
                             bg-blue-400 border border-blue-500 shadow-md opacity-80 pointer-events-none"
                  style={{
                    top: `${dragPosition.top}px`,
                    height: `${dragPosition.height}px`,
                    width: 'calc(100% - 8px)',
                    zIndex: 100
                  }}
                >
                  <div className="font-medium truncate">{activeEvent.event.title}</div>
                  <div className="text-xs truncate">
                    {format(dragPosition.startTime!, "HH:mm")} - {format(dragPosition.endTime!, "HH:mm")}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}