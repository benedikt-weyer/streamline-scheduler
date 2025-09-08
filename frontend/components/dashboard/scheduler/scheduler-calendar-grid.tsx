'use client';

import { useEffect, useState, useRef } from 'react';
import { format, isSameDay, differenceInMinutes, addMinutes } from 'date-fns';
import { CalendarEvent } from '@/utils/calendar/calendar-types';
import { generateTimeSlots } from '@/utils/calendar/calendar';
import { calculateCalendarDimensions, calculateEventRendering, groupOverlappingEvents } from '@/utils/calendar/calendar-render';
import { useDroppable } from '@dnd-kit/core';
import { 
  DraggedEvent, 
  DragPosition, 
  calculateDraggingEventDateTime,
  DragMode 
} from '@/utils/calendar/calendar-drag';

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
  const [layoutKey, setLayoutKey] = useState(0); // Force re-render when layout changes

  // Add drag state for events
  const [activeEvent, setActiveEvent] = useState<DraggedEvent | null>(null);
  const [dragPosition, setDragPosition] = useState<DragPosition | null>(null);
  const isDraggingRef = useRef(false);
  const lastDragUpdateRef = useRef<number>(0);

  // Force layout recalculation when activeTask changes (taskbar collapse/expand)
  useEffect(() => {
    if (activeTask) {
      // Small delay to let the taskbar collapse animation complete
      const timer = setTimeout(() => {
        setLayoutKey(prev => prev + 1);
      }, 350); // Match the CSS transition duration
      return () => clearTimeout(timer);
    }
  }, [activeTask]);

  // Watch for container resize and force dropzone recalculation
  useEffect(() => {
    if (!containerRef.current) return;

    let resizeTimer: NodeJS.Timeout;

    const resizeObserver = new ResizeObserver(() => {
      // Clear the previous timer
      clearTimeout(resizeTimer);
      
      // Only update after resize has been stable for 400ms (after animation completes)
      resizeTimer = setTimeout(() => {
        setLayoutKey(prev => prev + 1);
      }, 400);
    });

    resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
      clearTimeout(resizeTimer);
    };
  }, []);

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

  // Helper function to find day column at mouse position
  const findDayColumnAtPosition = (clientX: number): Element | null => {
    if (!containerRef.current) return null;
    
    // Get all day columns
    const dayColumns = containerRef.current.querySelectorAll('.day-column');
    
    // Find the column that contains the mouse X position with a small tolerance
    for (const column of dayColumns) {
      const rect = column.getBoundingClientRect();
      // Add 2px tolerance on each side to prevent jittery behavior
      if (clientX >= (rect.left - 2) && clientX <= (rect.right + 2)) {
        return column;
      }
    }
    
    return null;
  };

  // Helper function to get date from column
  const getDateFromColumn = (column: Element): Date | null => {
    const dateString = column.getAttribute('data-date');
    if (!dateString) return null;
    return new Date(dateString);
  };

  // Add global mouse handlers for drag operations
  useEffect(() => {
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
      // Throttle updates to prevent excessive recalculation (max 60fps)
      const now = Date.now();
      if (now - lastDragUpdateRef.current < 16) return;
      lastDragUpdateRef.current = now;
      
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
    mode: DragMode = DragMode.Move
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
      mode
    });
  };

  // Handle click on a day cell
  const handleDayClick = (day: Date, e: React.MouseEvent) => {
    // Don't open dialog if we're in a drag operation
    if (isDraggingRef.current || activeEvent) return;
    
    if (containerRef.current) {
      const dayColumnElement = e.currentTarget as HTMLElement;
      const rect = dayColumnElement.getBoundingClientRect();
      const relativeY = e.clientY - rect.top;
      
      // Ensure the click is within bounds
      const clampedY = Math.max(0, Math.min(relativeY, rect.height));
      
      // Calculate total minutes from top of day
      const totalMinutes = (clampedY / slotHeight) * 60;
      
      // Round to nearest 15-minute interval for better usability
      const snappedMinutes = Math.round(totalMinutes / 15) * 15;
      
      // Calculate hours and minutes components (ensure within day bounds)
      const hours = Math.min(23, Math.floor(snappedMinutes / 60));
      const minutes = Math.min(59, snappedMinutes % 60);
      
      const clickedDateTime = new Date(day);
      clickedDateTime.setHours(hours, minutes, 0, 0);
      
      openNewEventDialog(clickedDateTime);
    } else {
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

  // Task-duration-sized drop zone component
  const TaskDurationDropZone = ({ day, startHour, quarterIndex }: { day: Date; startHour: number; quarterIndex: number }) => {
    // Only show drop zones when there's an active task being dragged AND no event is being dragged
    if (!activeTask || activeEvent) return null;
    
    const minutes = quarterIndex * 15; // 0, 15, 30, 45
    const slotTime = new Date(day);
    slotTime.setHours(startHour, minutes, 0, 0);
    
    // Get task duration for end time calculation and display
    const taskDuration = activeTask.estimatedDuration || 60; // Default 1 hour
    
    // Calculate drop zone height - limit to 15 minutes to prevent overlap
    const maxDropZoneMinutes = 15;
    const dropZoneHeightPixels = (maxDropZoneMinutes / 60) * slotHeight; // Always 15 minutes = 0.25 * slotHeight
    
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
        time: slotTime,
        dayString: format(day, 'yyyy-MM-dd'),
        hourMinute: `${startHour}:${minutes.toString().padStart(2, '0')}`
      }
    });

    return (
      <div
        ref={setNodeRef}
        className="absolute transition-colors duration-200 hover:bg-accent/5"
        style={{
          top: `${(startHour * slotHeight) + (quarterIndex * slotHeight / 4)}px`,
          height: `${dropZoneHeightPixels}px`, // Full height without gap
          left: '1px',
          right: '1px',
          zIndex: 5,
          pointerEvents: 'auto'
        }}
        data-day={format(day, 'yyyy-MM-dd')}
        data-hour={startHour}
        data-quarter={quarterIndex}
      >
        {/* Single drop indicator - only show when dragging over */}
        {isOver && (
          <div 
            className="absolute flex flex-col items-center justify-center text-primary font-medium text-xs bg-primary/20 rounded border-2 border-primary border-dashed"
            style={{
              top: '0',
              left: '0',
              right: '0',
              height: `${(taskDuration / 60) * slotHeight}px`, // Show full task duration height
              minHeight: `${dropZoneHeightPixels}px`, // But at least as tall as the drop zone
              zIndex: 10
            }}
          >
            <div>{format(slotTime, 'HH:mm')}</div>
            <div className="text-xs opacity-75">{taskDuration}min</div>
            <div className="text-xs opacity-50">{format(day, 'MMM d')}</div>
          </div>
        )}
      </div>
    );
  };

  // Render a single event
  const renderSingleEvent = (event: CalendarEvent, day: Date, dayIndex: number, zIndex = 10, opacity = 100) => {
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
        className="absolute rounded-md px-2 py-1 overflow-hidden text-sm text-white shadow-sm cursor-pointer hover:shadow-md transition-shadow group"
        style={{
          top: `${top}px`,
          height: `${height}px`,
          left: '4px',
          right: '4px',
          backgroundColor: bgColor,
          zIndex: zIndex,
          opacity: opacity / 100
        }}
        onClick={(e) => handleEventClick(e, event)}
        onMouseDown={(e) => handleEventMouseDown(e, event, dayIndex)}
      >
        <div className="font-medium truncate">{event.title}</div>
        {height > 25 && (
          <div className="text-xs truncate">
            {format(startTime, "HH:mm")} - {format(endTime, "HH:mm")}
          </div>
        )}
        
        {/* Resize handles - only show on hover if we can update */}
        {onEventUpdate && height > 40 && (
          <>
            {/* Top resize handle */}
            <div 
              className="absolute top-0 left-0 right-0 h-2 cursor-n-resize opacity-0 group-hover:opacity-100 transition-opacity"
              onMouseDown={(e) => handleEventMouseDown(e, event, dayIndex, DragMode.ResizeTop)}
            />
            {/* Bottom resize handle */}
            <div 
              className="absolute bottom-0 left-0 right-0 h-2 cursor-s-resize opacity-0 group-hover:opacity-100 transition-opacity"
              onMouseDown={(e) => handleEventMouseDown(e, event, dayIndex, DragMode.ResizeBottom)}
            />
          </>
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
    
    return dayEvents.map(event => {
      // Don't render the original event if it's being dragged
      if (activeEvent && activeEvent.event.id === event.id) {
        return null;
      }
      return renderSingleEvent(event, day, dayIndex);
    });
  };

  // Helper function to check if dates overlap
  const areDatesOverlapping = (start1: Date, end1: Date, start2: Date, end2: Date): boolean => {
    return start1 < end2 && end1 > start2;
  };

  // Helper function to get end of day
  const getEndOfDay = (day: Date): Date => {
    const endOfDay = new Date(day);
    endOfDay.setHours(23, 59, 59, 999);
    return endOfDay;
  };

  // Render drag helper for visual feedback during dragging
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
      <div key={`drag-helper-${activeEvent.event.id}`} style={{ pointerEvents: 'none' }}>
        {renderSingleEvent(draggedEvent, day, dayIndex, 1000, 80)}
      </div>
    );
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
                // Only generate drop zones when there's an active task being dragged
                if (!activeTask || activeEvent) return null;
                
                const taskDuration = activeTask.estimatedDuration || 60;
                
                // Use 15-minute spacing for more granular drop zones
                const spacingMinutes = 15;
                
                const dropZones: React.ReactNode[] = [];
                
                // Generate drop zones at 15-minute intervals throughout the day
                // Start from 0 minutes and increment by 15 minutes
                for (let totalMinutes = 0; totalMinutes < 24 * 60; totalMinutes += spacingMinutes) {
                  const hourIndex = Math.floor(totalMinutes / 60);
                  const minutesInHour = totalMinutes % 60;
                  const quarterIndex = minutesInHour / 15; // Will be 0, 1, 2, or 3 for :00, :15, :30, :45
                  
                  // Skip if we exceed the time slots length
                  if (hourIndex >= timeSlots.length) break;
                  
                  // Check if this drop zone would extend beyond the day's end
                  const dropZoneEndMinutes = totalMinutes + taskDuration;
                  if (dropZoneEndMinutes > 24 * 60) break;
                  
                  dropZones.push(
                    <TaskDurationDropZone 
                      key={`drop-${format(day, 'yyyy-MM-dd')}-${hourIndex}-${quarterIndex}-${layoutKey}`}
                      day={day} 
                      startHour={hourIndex}
                      quarterIndex={quarterIndex}
                    />
                  );
                }
                
                return dropZones;
              })()}
              
              {/* Current time indicator */}
              {renderCurrentTimeLine(day)}
              
              {/* Events for this day */}
              {renderEvents(day, dayIndex)}
              
              {/* Drag helper for visual feedback during dragging */}
              {renderDragHelper(dayIndex, day, dragPosition)}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
} 