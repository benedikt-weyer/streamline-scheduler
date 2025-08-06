'use client';

import { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { 
  format, 
  startOfMonth, 
  endOfMonth, 
  startOfWeek, 
  endOfWeek, 
  eachDayOfInterval, 
  isSameMonth, 
  isSameDay, 
  addMonths, 
  subMonths,
  isToday,
  isWithinInterval
} from 'date-fns';

interface MonthOverviewProps {
  readonly selectedDate?: Date;
  readonly currentWeek?: Date;
  readonly onDateSelect?: (date: Date) => void;
  readonly onMonthChange?: (date: Date) => void;
}

export function MonthOverview({ 
  selectedDate = new Date(), 
  currentWeek,
  onDateSelect,
  onMonthChange 
}: MonthOverviewProps) {
  const [currentMonth, setCurrentMonth] = useState<Date>(selectedDate);

  // Update current month when selected date changes
  useEffect(() => {
    if (selectedDate) {
      setCurrentMonth(selectedDate);
    }
  }, [selectedDate]);

  // Generate calendar days for the current month view
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(monthStart);
  const startDate = startOfWeek(monthStart, { weekStartsOn: 1 });
  const endDate = endOfWeek(monthEnd, { weekStartsOn: 1 });

  const days = eachDayOfInterval({ start: startDate, end: endDate });

  const handlePreviousMonth = () => {
    const newMonth = subMonths(currentMonth, 1);
    setCurrentMonth(newMonth);
    onMonthChange?.(newMonth);
  };

  const handleNextMonth = () => {
    const newMonth = addMonths(currentMonth, 1);
    setCurrentMonth(newMonth);
    onMonthChange?.(newMonth);
  };

  const handleDateClick = (date: Date) => {
    onDateSelect?.(date);
  };

  // Week day labels (Monday first)
  const weekDays = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];

  return (
    <div className="w-full border rounded-lg p-3 bg-card">
      {/* Month Header with Navigation */}
      <div className="flex items-center justify-between mb-3">
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 p-0 hover:bg-accent"
          onClick={handlePreviousMonth}
        >
          <ChevronLeft className="h-3 w-3" />
        </Button>
        
        <div className="text-sm font-semibold">
          {format(currentMonth, 'MMMM yyyy')}
        </div>
        
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 p-0 hover:bg-accent"
          onClick={handleNextMonth}
        >
          <ChevronRight className="h-3 w-3" />
        </Button>
      </div>

      {/* Week Day Headers */}
      <div className="grid grid-cols-7 gap-1 mb-1">
        {weekDays.map((day) => (
          <div
            key={day}
            className="text-xs text-muted-foreground font-medium text-center py-1"
          >
            {day}
          </div>
        ))}
      </div>

      {/* Calendar Days Grid */}
      <div className="grid grid-cols-7 gap-1">
        {days.map((day) => {
          const isCurrentMonth = isSameMonth(day, currentMonth);
          const isSelected = selectedDate && isSameDay(day, selectedDate);
          const isDayToday = isToday(day);
          
          // Check if this day is in the current selected week
          const isInSelectedWeek = currentWeek && isWithinInterval(day, {
            start: startOfWeek(currentWeek, { weekStartsOn: 1 }),
            end: endOfWeek(currentWeek, { weekStartsOn: 1 })
          });

          return (
            <button
              key={day.toString()}
              onClick={() => handleDateClick(day)}
              className={`
                text-xs h-6 w-6 rounded hover:bg-accent hover:text-accent-foreground
                transition-colors duration-150 ease-in-out
                ${isCurrentMonth 
                  ? 'text-foreground' 
                  : 'text-muted-foreground/50'
                }
                ${isSelected 
                  ? 'bg-primary text-primary-foreground hover:bg-primary/90' 
                  : ''
                }
                ${isDayToday && !isSelected 
                  ? 'bg-accent text-accent-foreground font-medium' 
                  : ''
                }
                ${isInSelectedWeek && !isSelected && !isDayToday
                  ? 'bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300'
                  : ''
                }
              `}
            >
              {format(day, 'd')}
            </button>
          );
        })}
      </div>
    </div>
  );
} 