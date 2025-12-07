'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { subWeeks, addWeeks, startOfWeek, format } from 'date-fns';
import { ChevronLeft, ChevronRight, Calendar, Plus, Settings } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Calendar as CalendarType } from '@/utils/calendar/calendar-types';

interface CalendarHeaderMobileProps {
  currentWeek: Date;
  setCurrentWeek: React.Dispatch<React.SetStateAction<Date>>;
  openNewEventDialog: () => void;
  calendars: CalendarType[];
  onCalendarToggle: (calendarId: string, isVisible: boolean) => void;
  onCalendarCreate: (name: string, color: string) => void;
  onICSCalendarCreate: (name: string, color: string, icsUrl: string) => void;
  onICSCalendarRefresh: (calendarId: string) => void;
  onCalendarEdit: (calendarId: string, name: string, color: string) => void;
  onCalendarDelete: (calendarId: string) => void;
  onSetDefaultCalendar: (calendarId: string) => void;
  onTodaySelected?: () => void;
  setSelectedDate?: React.Dispatch<React.SetStateAction<Date>>;
}

export function CalendarHeaderMobile({ 
  currentWeek, 
  setCurrentWeek, 
  openNewEventDialog,
  calendars,
  onCalendarToggle,
  onCalendarCreate,
  onICSCalendarCreate,
  onICSCalendarRefresh,
  onCalendarEdit,
  onCalendarDelete,
  onSetDefaultCalendar,
  onTodaySelected,
  setSelectedDate
}: CalendarHeaderMobileProps) {
  const [isCalendarMenuOpen, setIsCalendarMenuOpen] = useState(false);

  // Navigate to previous week
  const goToPreviousWeek = () => {
    setCurrentWeek(prevWeek => {
      const newWeek = subWeeks(prevWeek, 1);
      // Also update selected date to keep them in sync
      setSelectedDate?.(newWeek);
      return newWeek;
    });
  };

  // Navigate to next week
  const goToNextWeek = () => {
    setCurrentWeek(prevWeek => {
      const newWeek = addWeeks(prevWeek, 1);
      // Also update selected date to keep them in sync
      setSelectedDate?.(newWeek);
      return newWeek;
    });
  };

  // Go to current week
  const goToCurrentWeek = () => {
    const today = new Date();
    const weekStart = startOfWeek(today, { weekStartsOn: 1 });
    setCurrentWeek(weekStart);
    setSelectedDate?.(today);
    onTodaySelected?.();
  };

  const handleCalendarCreate = () => {
    // For mobile, we'll use a simple prompt for now
    const name = prompt('Calendar name:');
    if (name?.trim()) {
      onCalendarCreate(name.trim(), '#4f46e5');
    }
    setIsCalendarMenuOpen(false);
  };

  const handleCalendarToggle = (calendarId: string, currentVisibility: boolean) => {
    onCalendarToggle(calendarId, !currentVisibility);
  };

  const visibleCalendarsCount = calendars.filter(cal => cal.is_visible).length;

  return (
    <div className="space-y-3">
      {/* Week Navigation */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button onClick={goToCurrentWeek} size="sm" variant="outline" className="text-xs">
            Today
          </Button>
          <div className="flex items-center border rounded-md overflow-hidden">
            <Button onClick={goToPreviousWeek} size="sm" variant="outline" className="rounded-r-none border-0 px-2">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button onClick={goToNextWeek} size="sm" variant="outline" className="rounded-l-none border-0 px-2">
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
        
        <Button onClick={openNewEventDialog} size="sm">
          <Plus className="h-4 w-4 mr-1" />
          Event
        </Button>
      </div>

      {/* Month/Week Info and Calendar Settings */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-medium">
          {format(currentWeek, 'MMM yyyy')} - Week {format(currentWeek, 'w')}
        </h2>
        
        {/* Calendar Settings Dropdown */}
        <DropdownMenu open={isCalendarMenuOpen} onOpenChange={setIsCalendarMenuOpen}>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              <span className="text-xs">
                {visibleCalendarsCount} of {calendars.length}
              </span>
            </Button>
          </DropdownMenuTrigger>
          
          <DropdownMenuContent align="end" className="w-64">
            <div className="px-2 py-1.5 text-sm font-medium">Calendars</div>
            <DropdownMenuSeparator />
            
            {/* Calendar List */}
            {calendars.map((calendar) => (
              <DropdownMenuItem
                key={calendar.id}
                onClick={() => handleCalendarToggle(calendar.id, calendar.is_visible)}
                className="flex items-center justify-between"
              >
                <div className="flex items-center gap-2">
                  <div
                    className={`w-3 h-3 rounded-full border-2`}
                    style={{ 
                      borderColor: calendar.color,
                      backgroundColor: calendar.is_visible ? calendar.color : 'transparent'
                    }}
                  />
                  <span className={calendar.is_visible ? 'text-foreground' : 'text-muted-foreground'}>
                    {calendar.name}
                  </span>
                  {calendar.is_default && (
                    <span className="text-xs bg-amber-100 text-amber-800 px-1 rounded">
                      Default
                    </span>
                  )}
                </div>
              </DropdownMenuItem>
            ))}
            
            <DropdownMenuSeparator />
            
            {/* Add Calendar */}
            <DropdownMenuItem onClick={handleCalendarCreate}>
              <Plus className="h-4 w-4 mr-2" />
              Add Calendar
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
} 