import { useEffect, useState, useRef } from 'react';

import { format, isSameDay, differenceInMinutes } from 'date-fns';

import { CalendarEvent } from '@/utils/types';
import { generateTimeSlots } from '@/utils/calendar';
import { calculateCalendarDimensions, calculateEventRendering } from '@/utils/calendar-render';
import { 
  DraggedEvent, 
  DragPosition, 
  calculateDraggingEventDateTime,
  DragMode // Import the DragMode enum
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
  
  // Current time tracker for showing time indicator line
  const [currentTime, setCurrentTime] = useState(new Date());
  
  // Flag to prevent click handlers during drag operations
  const isDraggingRef = useRef(false);

  // Update current time every minute
  useEffect(() => {
    // Set current time on first render
    setCurrentTime(new Date());
    
    // Update current time every minute
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000); // 60000ms = 1 minute
    
    return () => clearInterval(interval);
  }, []);

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
    dayIndex: number,
    mode: DragMode = DragMode.Move // Default to move if not specified
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
      offsetY,
      mode // Use the specified drag mode
    });
  };

  // Handle click on a day cell - only if we're not dragging
  const handleDayClick = (day: Date, e: React.MouseEvent) => {
    // Don't open dialog if we're in a drag operation
    if (isDraggingRef.current || activeEvent) return;
    
    // Calculate the time based on mouse click position
    if (containerRef.current) {
      const dayColumnElement = e.currentTarget as HTMLElement;
      const rect = dayColumnElement.getBoundingClientRect();
      const relativeY = e.clientY - rect.top;
      
      // Calculate minutes from top position
      const totalMinutes = (relativeY / slotHeight) * 60;
      
      // Round minutes to nearest 15-minute interval for better usability
      const snappedMinutes = Math.round(totalMinutes / 15) * 15;
      
      // Calculate hours and minutes components
      const hours = Math.floor(snappedMinutes / 60);
      const minutes = snappedMinutes % 60;
      
      // Create new date with calculated time
      const clickedDateTime = new Date(day);
      clickedDateTime.setHours(hours, minutes, 0, 0);
      
      // Open dialog with the clicked time
      openNewEventDialog(clickedDateTime);
    } else {
      // Fallback to just the day if container ref isn't available
      openNewEventDialog(day);
    }
  };

  // Handle click on an event - only if we're not dragging
  const handleEventClick = (e: React.MouseEvent, event: CalendarEvent) => {
    e.stopPropagation();
    
    // Don't open the edit dialog if we're in a drag operation
    if (isDraggingRef.current) return;
    
    openEditDialog(event);
  };

  // Render a single event
  const renderSingleEvent = (event: CalendarEvent, day: Date, dayIndex: number, zIndex: number = 10, opacity: number = 100) => {
    // Use the utility function to calculate rendering details
    const { eventStyles, startTime, endTime } = calculateEventRendering(event, day, slotHeight, zIndex, opacity);
    
    return (
      <div
        key={event.id}
        className={`absolute rounded-md px-2 py-1 overflow-hidden text-sm text-white 
           bg-indigo-500 border border-indigo-600 shadow-sm group
           ${onEventUpdate ? 'cursor-move' : 'cursor-pointer'}`}
        style={eventStyles}
        onClick={(e) => handleEventClick(e, event)}
        onMouseDown={(e) => handleEventMouseDown(e, event, dayIndex, DragMode.Move)}
      >
        {/* Top resize handle - only visible on hover */}
        {onEventUpdate && (
          <div 
            className="absolute top-0 left-0 right-0 h-2 bg-transparent cursor-ns-resize opacity-0 group-hover:opacity-100 hover:bg-indigo-300/50"
            onMouseDown={(e) => handleEventMouseDown(e, event, dayIndex, DragMode.ResizeTop)}
          />
        )}
        
        <div className="font-medium truncate">{event.title}</div>
        <div className="text-xs truncate">
          {format(startTime, "HH:mm")} - {format(endTime, "HH:mm")}
        </div>
        
        {/* Bottom resize handle - only visible on hover */}
        {onEventUpdate && (
          <div 
            className="absolute bottom-0 left-0 right-0 h-2 bg-transparent cursor-ns-resize opacity-0 group-hover:opacity-100 hover:bg-indigo-300/50"
            onMouseDown={(e) => handleEventMouseDown(e, event, dayIndex, DragMode.ResizeBottom)}
          />
        )}
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

  // Calculate the position for the current time indicator
  const calculateCurrentTimePosition = (day: Date): number | null => {
    // Only show for current day
    if (!isSameDay(currentTime, day)) return null;
    
    // Calculate minutes since start of day (midnight)
    const dayStart = new Date(day);
    dayStart.setHours(0, 0, 0, 0);
    
    const minutesSinceMidnight = differenceInMinutes(currentTime, dayStart);
    
    // Convert to position
    return (minutesSinceMidnight / 60) * slotHeight;
  };

  // Render current time indicator for a day
  const renderCurrentTimeLine = (day: Date): React.ReactNode => {
    const position = calculateCurrentTimePosition(day);
    
    // Don't render if not current day
    if (position === null) return null;
    
    return (
      <div 
        className="absolute w-full bg-purple-900 z-30 pointer-events-none h-[2px] -translate-y-1/2"
        style={{ 
          top: `${position}px`,
        }}
      >
        {/* Time label */}
        <div 
          className="absolute bg-purple-900 text-white text-xs px-1 py-[1px] top-[1px] rounded-full w-2 h-2 -translate-y-1/2 -translate-x-full"
        >
        </div>

      </div>
    );
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
      <>
        {renderSingleEvent(draggedEvent, day, dayIndex, 1000, 80)}
      </>
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
              
              {/* Current time indicator line */}
              {renderCurrentTimeLine(day)}
              
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