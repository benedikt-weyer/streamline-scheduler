'use client';

import { useEffect, useState, useRef } from 'react';
import { format, isSameDay, differenceInMinutes, addMinutes } from 'date-fns';
import { CalendarEvent } from '@/utils/calendar/calendar-types';
import { generateTimeSlots } from '@/utils/calendar/calendar';
import { calculateCalendarDimensions, calculateEventRendering, groupOverlappingEvents } from '@/utils/calendar/calendar-render';
import { getRecurrencePattern } from '@/utils/calendar/eventDataProcessing';
import { useDroppable } from '@dnd-kit/core';
import { 
  DraggedEvent, 
  DragPosition, 
  calculateDraggingEventDateTime,
  DragMode 
} from '@/utils/calendar/calendar-drag';
import { EventGroupModal } from '../calendar/event-group-modal';

interface SchedulerCalendarGridProps {
  readonly days: Date[];
  readonly events: CalendarEvent[];
  readonly calendars?: { id: string; color: string; name: string; is_visible: boolean }[];
  readonly openEditDialog: (event: CalendarEvent) => void;
  readonly openNewEventDialog: (day: Date, isAllDay?: boolean) => void;
  readonly onEventUpdate?: (updatedEvent: CalendarEvent) => Promise<boolean> | void;
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
  const [calendarHeight, setCalendarHeight] = useState<number | null>(null);
  const [slotHeight, setSlotHeight] = useState(35);
  const containerRef = useRef<HTMLDivElement>(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [layoutKey, setLayoutKey] = useState(0); // Force re-render when layout changes

  // Add drag state for events
  const [activeEvent, setActiveEvent] = useState<DraggedEvent | null>(null);
  const [dragPosition, setDragPosition] = useState<DragPosition | null>(null);
  const isDraggingRef = useRef(false);
  const lastDragUpdateRef = useRef<number>(0);
  
  // Event group modal state
  const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);
  const [selectedGroupEvent, setSelectedGroupEvent] = useState<CalendarEvent | null>(null);
  const [isDragHoverModalOpen, setIsDragHoverModalOpen] = useState(false);

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

  // Calculate calendar height based on available container space
  useEffect(() => {
    // Calculate on initial render
    calculateCalendarHeightAndSlotSize();
    
    // Recalculate on window resize
    window.addEventListener('resize', calculateCalendarHeightAndSlotSize);
    
    // Clean up event listener
    return () => window.removeEventListener('resize', calculateCalendarHeightAndSlotSize);
  }, [timeSlots.length]);

  // Recalculate when container size changes
  useEffect(() => {
    if (containerRef.current) {
      const resizeObserver = new ResizeObserver(() => {
        calculateCalendarHeightAndSlotSize();
      });
      
      resizeObserver.observe(containerRef.current.parentElement || containerRef.current);
      
      return () => resizeObserver.disconnect();
    }
  }, []);

  // Extracted function to calculate calendar height and slot size
  const calculateCalendarHeightAndSlotSize = () => {
    // Use viewport height minus navbar and buffer for external elements
    const viewportHeight = window.innerHeight;
    const navbarHeight = 64; // h-16 = 64px
    const externalBufferHeight = 80; // Buffer for calendar header, sidebar padding, etc.
    
    let availableHeight = viewportHeight - navbarHeight - externalBufferHeight;
    
    // Subtract the height of day headers and all-day sections that are part of our calendar grid
    const gridContainer = containerRef.current;
    if (gridContainer) {
      const dayHeadersElement = gridContainer.parentElement?.querySelector('.grid.border-b.flex-shrink-0');
      const allDayElement = gridContainer.parentElement?.querySelector('.grid.border-b.bg-muted\\/30');
      
      if (dayHeadersElement) {
        availableHeight -= dayHeadersElement.getBoundingClientRect().height;
      }
      if (allDayElement) {
        availableHeight -= allDayElement.getBoundingClientRect().height;
      }
    }
    
    // Calculate slot height to use the remaining available height
    const exactSlotHeight = availableHeight / timeSlots.length;
    
    // Ensure minimum slot height for readability
    const minSlotHeight = 25;
    const calculatedSlotHeight = Math.max(minSlotHeight, exactSlotHeight);
    
    // Use the calculated height for just the time grid portion
    const newHeight = calculatedSlotHeight * timeSlots.length;
    
    setCalendarHeight(newHeight);
    setSlotHeight(calculatedSlotHeight);
  };

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

  // Helper function to find if mouse is hovering over a group event
  const findGroupEventAtPosition = (mouseX: number, mouseY: number): CalendarEvent | null => {
    if (!containerRef.current) return null;
    
    // Use elementFromPoint which respects pointer-events: none
    const element = document.elementFromPoint(mouseX, mouseY);
    if (!element) return null;
    
    // Walk up the DOM tree to find an element with data-event-id
    let currentElement: Element | null = element;
    while (currentElement && currentElement !== containerRef.current) {
      const eventId = currentElement.getAttribute('data-event-id');
      if (eventId) {
        // Find the event in our events array
        const event = events.find(e => e.id === eventId);
        
        // Return only if it's a group event and not the currently dragged event
        if (event && event.is_group_event && event.id !== activeEvent?.event.id) {
          return event;
        }
        // If we found an event but it's not a group, break
        break;
      }
      currentElement = currentElement.parentElement;
    }
    
    return null;
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
    
    // Handle escape key to exit group modal
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isDragHoverModalOpen) {
        setIsDragHoverModalOpen(false);
        setSelectedGroupEvent(null);
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
        targetDay,
        0, // zoomStartHour - scheduler doesn't use zoom
        60 // zoomIntervalMinutes - standard hourly intervals
      );
      
      // Check if hovering over a group event
      const groupEvent = findGroupEventAtPosition(e.clientX, e.clientY);
      
      // Prevent nesting: Don't allow a group event to be dropped into another group
      if (groupEvent && !activeEvent.event.is_group_event) {
        // Open modal to show group contents during drag
        if (groupEvent.id !== selectedGroupEvent?.id || !isDragHoverModalOpen) {
          console.log('Hovering over group event:', groupEvent.id, groupEvent.title);
          setSelectedGroupEvent(groupEvent);
          setIsDragHoverModalOpen(true);
        }
      } else {
        // Not hovering over a valid group, close modal
        if (isDragHoverModalOpen) {
          console.log('Left group event area');
          setIsDragHoverModalOpen(false);
          setSelectedGroupEvent(null);
        }
      }
      
      // Update the visual position state
      setDragPosition(result);
    };

    const handleMouseUp = (e: MouseEvent) => {
      const wasDragging = isDraggingRef.current;
      
      // Only process the drag if we actually moved (isDragging)
      if (wasDragging && containerRef.current) {
        processDragEnd(e);
        
        // Reset drag state after a short delay to prevent unwanted clicks
        setTimeout(() => {
          isDraggingRef.current = false;
        }, 50);
      } else {
        // If we didn't drag, reset immediately so clicks work
        isDraggingRef.current = false;
      }
      
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
        targetDay,
        0, // zoomStartHour - scheduler doesn't use zoom
        60 // zoomIntervalMinutes - standard hourly intervals
      );
      
      // Check if dropped on a group event
      // If drag hover modal is open, use the selected group event (modal covers the actual group)
      const groupEvent = isDragHoverModalOpen && selectedGroupEvent 
        ? selectedGroupEvent 
        : findGroupEventAtPosition(e.clientX, e.clientY);
      
      // Create updated event - explicitly preserve is_group_event
      const updatedEvent: CalendarEvent = {
        ...activeEvent.event,
        start_time: result.startTime.toISOString(),
        end_time: result.endTime.toISOString(),
        updated_at: new Date().toISOString(),
        // Explicitly preserve is_group_event flag
        is_group_event: activeEvent.event.is_group_event,
        // Set parent group if dropped on a group (and not a group itself)
        parent_group_event_id: (groupEvent && !activeEvent.event.is_group_event) ? groupEvent.id : activeEvent.event.parent_group_event_id
      };
      
      // Update the event
      if (onEventUpdate) {
        console.log('Updating event:', updatedEvent);
        const result = onEventUpdate(updatedEvent);
        // Handle both sync and async onEventUpdate functions
        if (result && typeof result.then === 'function') {
          result
            .then((success) => {
              console.log('Event update result:', success);
              if (!success) {
                console.error('Event update returned false - update failed');
              }
            })
            .catch((error) => {
              console.error('Failed to update event:', error);
              // Optionally show error to user
            });
        }
      }
    };

    // Clean up function
    const cleanupDrag = () => {
      setActiveEvent(null);
      setDragPosition(null);
      setIsDragHoverModalOpen(false);
      // Don't clear selectedGroupEvent here - it might be used for the regular modal
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('keydown', handleKeyDown);
    };
    
    // Add event listeners
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    document.addEventListener('keydown', handleKeyDown);
    
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
      
      openNewEventDialog(clickedDateTime, false);
    } else {
      openNewEventDialog(day, false);
    }
  };

  // Handle click on an event - only if we're not dragging
  const handleEventClick = (e: React.MouseEvent, event: CalendarEvent) => {
    e.stopPropagation();
    
    // Don't open the edit dialog if we're in a drag operation
    if (isDraggingRef.current) return;
    
    // If this is a group event, open the group modal instead
    if (event.is_group_event) {
      setSelectedGroupEvent(event);
      setIsGroupModalOpen(true);
      return;
    }
    
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
  const renderSingleEvent = (event: CalendarEvent, day: Date, dayIndex: number, zIndex = 10, opacity = 100, columnIndex = 0, totalColumns = 1) => {
    // Use the utility function to calculate rendering details for multi-day events
    const { eventStyles, startTime, endTime } = calculateEventRendering(
      event,
      day,
      slotHeight,
      zIndex,
      opacity,
      columnIndex,
      totalColumns
    );
    
    const calendar = calendars?.find(cal => cal.id === event.calendar_id);
    const bgColor = calendar?.color || '#3b82f6';
    
    // Check if this is a recurring event or recurrence instance
    const recurrencePattern = getRecurrencePattern(event);
    const isRecurring = !!recurrencePattern;
    const isRecurrenceInstance = event.id.includes('-recurrence-');
    
    // For group events, use transparent background with solid border
    const groupEventStyles = event.is_group_event ? {
      backgroundColor: `${bgColor}20`, // Very transparent background
      borderWidth: '2px',
      borderStyle: 'solid',
      borderColor: bgColor, // Solid, non-transparent border
    } : {};
    
    // Get child events if this is a group event
    const childEvents = event.is_group_event 
      ? events.filter(e => e.parent_group_event_id === event.id && isSameDay(new Date(e.start_time), day))
      : [];
    
    // Calculate group time range for positioning child events
    const groupStart = new Date(event.start_time);
    const groupEnd = new Date(event.end_time);
    const groupDuration = differenceInMinutes(groupEnd, groupStart);
    
    return (
      <div
        key={event.id}
        data-event-id={event.id}
        className={`absolute rounded-md px-2 py-1 overflow-hidden text-sm text-white shadow-sm cursor-pointer hover:shadow-md transition-all duration-200 group
          ${event.is_group_event ? 'backdrop-blur-sm' : ''}`}
        style={{
          ...eventStyles,
          backgroundColor: bgColor,
          ...groupEventStyles,
        }}
        onClick={(e) => handleEventClick(e, event)}
        onMouseDown={(e) => handleEventMouseDown(e, event, dayIndex)}
      >
        <div className={`font-medium truncate flex items-center gap-1 ${event.is_group_event ? 'text-gray-900 dark:text-gray-100' : ''}`}>
          {event.is_group_event ? (
            <span className="inline-flex items-center flex-shrink-0" style={{ color: bgColor }}>
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="7" height="7"></rect>
                <rect x="14" y="3" width="7" height="7"></rect>
                <rect x="14" y="14" width="7" height="7"></rect>
                <rect x="3" y="14" width="7" height="7"></rect>
              </svg>
            </span>
          ) : (isRecurring || isRecurrenceInstance) ? (
            <span className="inline-flex items-center flex-shrink-0">
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 12a9 9 0 1 0 18 0 9 9 0 0 0-18 0z"></path>
                <path d="M12 7v5l2.5 2.5"></path>
              </svg>
            </span>
          ) : null}
          <span className="truncate">{event.title}</span>
        </div>
        {parseInt(eventStyles.height) > 25 && (
          <div className={`text-xs truncate ${event.is_group_event ? 'text-gray-700 dark:text-gray-300' : ''}`}>
            {format(startTime, "HH:mm")} - {format(endTime, "HH:mm")}
          </div>
        )}
        
        {/* Render child events inside the group */}
        {event.is_group_event && childEvents.length > 0 && (
          <div className="absolute inset-0 pointer-events-none mt-12">
            {childEvents.map(childEvent => {
              const childStart = new Date(childEvent.start_time);
              const childEnd = new Date(childEvent.end_time);
              const childDuration = differenceInMinutes(childEnd, childStart);
              
              // Calculate position relative to group
              const minutesFromGroupStart = differenceInMinutes(childStart, groupStart);
              const topPercent = Math.max(0, (minutesFromGroupStart / groupDuration) * 100);
              const heightPercent = Math.min(100 - topPercent, (childDuration / groupDuration) * 100);
              
              // Get child event color
              const childCalendar = calendars?.find(cal => cal.id === childEvent.calendar_id);
              const childColor = childCalendar?.color || '#3b82f6';
              
              return (
                <div
                  key={childEvent.id}
                  className="absolute left-1 right-1 rounded-sm px-1 text-xs overflow-hidden shadow-sm"
                  style={{
                    top: `${topPercent}%`,
                    height: `${heightPercent}%`,
                    minHeight: '16px',
                    backgroundColor: childColor,
                    color: 'white',
                  }}
                  title={`${childEvent.title} (${format(childStart, 'HH:mm')} - ${format(childEnd, 'HH:mm')})`}
                >
                  <div className="font-medium truncate text-[10px]">
                    {childEvent.title}
                  </div>
                  {heightPercent > 15 && (
                    <div className="truncate text-[9px] opacity-80">
                      {format(childStart, 'HH:mm')}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
        
        {/* Resize handles - only show on hover if we can update */}
        {onEventUpdate && parseInt(eventStyles.height) > 40 && (
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

  // Render all-day events for a specific day
  const renderAllDayEvents = (day: Date) => {
    const allDayEvents = events.filter(event => {
      if (!event.all_day) return false;
      
      // Check if this day falls within the event's date range
      const eventStart = new Date(event.start_time);
      eventStart.setHours(0, 0, 0, 0);
      const eventEnd = new Date(event.end_time);
      eventEnd.setHours(23, 59, 59, 999);
      const dayStart = new Date(day);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(day);
      dayEnd.setHours(23, 59, 59, 999);
      
      return dayStart <= eventEnd && dayEnd >= eventStart;
    });

    if (!allDayEvents.length) return null;

    return allDayEvents.map(event => {
      const calendar = calendars?.find(cal => cal.id === event.calendar_id);
      const eventColor = calendar?.color || '#3B82F6';
      
      // Check if this is a recurring event or recurrence instance
      const recurrencePattern = getRecurrencePattern(event);
      const isRecurring = !!recurrencePattern;
      const isRecurrenceInstance = event.id.includes('-recurrence-');
      
      return (
        <div
          key={event.id}
          data-event-id={event.id}
          className="px-2 py-1 mb-1 rounded text-xs text-white cursor-pointer hover:opacity-90 transition-opacity group relative overflow-hidden"
          style={{ backgroundColor: eventColor }}
          onClick={(e) => {
            e.stopPropagation(); // Prevent triggering the all-day section click
            handleEventClick(e, event);
          }}
        >
          <div className="font-medium truncate flex items-center gap-1">
            {(isRecurring || isRecurrenceInstance) ? (
              <span className="inline-flex items-center">
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 12a9 9 0 1 0 18 0 9 9 0 0 0-18 0z"></path>
                  <path d="M12 7v5l2.5 2.5"></path>
                </svg>
              </span>
            ) : null}
            {event.title}
          </div>
          {event.location && (
            <div className="text-xs opacity-90 truncate">
              📍 {event.location}
            </div>
          )}
        </div>
      );
    });
  };

  // Render timed events for a day
  const renderEvents = (day: Date, dayIndex: number) => {
    const dayEvents = events.filter(event => {
      // Only include timed events (not all-day)
      if (event.all_day) return false;
      // Exclude child events - they will be rendered inside their parent groups
      if (event.parent_group_event_id) return false;
      return isSameDay(new Date(event.start_time), day) || isSameDay(new Date(event.end_time), day);
    });
    
    if (!dayEvents.length) return null;

    // Group overlapping events
    const eventGroups = groupOverlappingEvents(dayEvents);
    
    const renderedEvents = eventGroups.flatMap(group => {
      // For non-overlapping events (group of 1), render normally
      if (group.length === 1) {
        const event = group[0];
        // Don't render the original event if it's being dragged
        if (activeEvent && activeEvent.event.id === event.id) {
          return null;
        }
        return renderSingleEvent(event, day, dayIndex);
      }
      
      // For overlapping events, render each in its own column
      return group.map((event, columnIndex) => {
        // Don't render the original event if it's being dragged
        if (activeEvent && activeEvent.event.id === event.id) {
          return null;
        }
        return renderSingleEvent(event, day, dayIndex, 10, 100, columnIndex, group.length);
      });
    });
    
    return renderedEvents;
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
      start_time: dragPosition.startTime.toISOString(),
      end_time: dragPosition.endTime.toISOString()
    };
    
    // Use a wrapper div to apply the opacity and prevent pointer events
    // Use z-index higher than modal overlay (Dialog uses z-50, we use 99999 to be above everything)
    return (
      <div key={`drag-helper-${activeEvent.event.id}`} style={{ pointerEvents: 'none', position: 'relative', zIndex: 99999 }}>
        {renderSingleEvent(draggedEvent, day, dayIndex, 99999, 80)}
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
    <div className="border rounded-lg shadow-sm bg-card h-full flex flex-col overflow-hidden">
      {/* Calendar header with days of the week */}
      <div className="grid grid-cols-[60px_1fr] border-b flex-shrink-0">
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

      {/* All-day events section */}
      <div className="grid grid-cols-[60px_1fr] border-b bg-muted/30 flex-shrink-0">
        {/* Label for all-day section */}
        <div className="border-r px-2 py-2 text-xs text-muted-foreground text-right">
          All Day
        </div>
        
        {/* All-day events for each day */}
        <div className="grid grid-cols-7">
          {days.map(day => (
            <div 
              key={`allday-${day.toString()}`}
              className="px-2 py-2 border-r last:border-r-0 min-h-[40px] cursor-pointer hover:bg-muted/50 transition-colors"
              onClick={(e) => {
                // Check if click was on an existing event
                const target = e.target as HTMLElement;
                if (target.closest('[data-event-id]')) {
                  return; // Don't create new event if clicking on existing one
                }
                openNewEventDialog(day, true);
              }}
            >
              {renderAllDayEvents(day)}
            </div>
          ))}
        </div>
      </div>
      
      {/* Calendar grid with time slots - fits available space */}
      <div 
        ref={containerRef}
        className="grid grid-cols-[60px_1fr] overflow-hidden relative"
        style={{ 
          height: calendarHeight ? `${calendarHeight}px` : '100%',
          minHeight: calendarHeight ? `${calendarHeight}px` : '100%',
          maxHeight: calendarHeight ? `${calendarHeight}px` : '100%',
          flex: 'none'
        }}
      >
        {/* Time labels */}
        <div 
          className="border-r relative"
          style={{ height: calendarHeight ? `${calendarHeight}px` : `${slotHeight * timeSlots.length}px` }}
        >
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
              style={{ height: calendarHeight ? `${calendarHeight}px` : `${slotHeight * timeSlots.length}px` }}
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
      
      {/* Event Group Modal */}
      {/* Click-to-open modal */}
      <EventGroupModal
        isOpen={isGroupModalOpen}
        onOpenChange={setIsGroupModalOpen}
        groupEvent={selectedGroupEvent}
        childEvents={events.filter(e => e.parent_group_event_id === selectedGroupEvent?.id)}
        calendars={calendars?.map(cal => ({
          id: cal.id,
          name: cal.name,
          color: cal.color,
          is_visible: cal.is_visible,
          is_default: false,
          created_at: '',
          updated_at: '',
          user_id: '',
        })) || []}
        onEditGroup={(event) => {
          openEditDialog(event);
        }}
        onEventClick={(event) => {
          openEditDialog(event);
        }}
        onEventUpdate={onEventUpdate}
      />
      
      {/* Drag hover modal */}
      <EventGroupModal
        isOpen={isDragHoverModalOpen}
        onOpenChange={setIsDragHoverModalOpen}
        groupEvent={selectedGroupEvent}
        childEvents={events.filter(e => e.parent_group_event_id === selectedGroupEvent?.id)}
        calendars={calendars?.map(cal => ({
          id: cal.id,
          name: cal.name,
          color: cal.color,
          is_visible: cal.is_visible,
          is_default: false,
          created_at: '',
          updated_at: '',
          user_id: '',
        })) || []}
        onEditGroup={(event) => {
          openEditDialog(event);
        }}
        onEventClick={(event) => {
          openEditDialog(event);
        }}
        onEventUpdate={onEventUpdate}
        externalDragEvent={activeEvent?.event || null}
        onExternalDrop={(event, newStartTime, newEndTime) => {
          if (!onEventUpdate || !selectedGroupEvent) return;
          
          // Update the event with new times and assign to group
          const updatedEvent: CalendarEvent = {
            ...event,
            start_time: newStartTime.toISOString(),
            end_time: newEndTime.toISOString(),
            parent_group_event_id: selectedGroupEvent.id,
            updated_at: new Date().toISOString(),
          };
          
          onEventUpdate(updatedEvent);
          
          // Clean up drag state
          setActiveEvent(null);
          setDragPosition(null);
          setIsDragHoverModalOpen(false);
          isDraggingRef.current = false;
        }}
      />
    </div>
  );
} 