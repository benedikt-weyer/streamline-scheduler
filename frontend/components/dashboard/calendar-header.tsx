import { Button } from '@/components/ui/button';
import { subWeeks, addWeeks, startOfWeek } from 'date-fns';

interface CalendarHeaderProps {
  currentWeek: Date;
  setCurrentWeek: React.Dispatch<React.SetStateAction<Date>>;
  openNewEventDialog: () => void;
}

export function CalendarHeader({ currentWeek, setCurrentWeek, openNewEventDialog }: CalendarHeaderProps) {
  // Navigate to previous week
  const goToPreviousWeek = () => {
    setCurrentWeek(prevWeek => subWeeks(prevWeek, 1));
  };

  // Navigate to next week
  const goToNextWeek = () => {
    setCurrentWeek(prevWeek => addWeeks(prevWeek, 1));
  };

  // Go to current week
  const goToCurrentWeek = () => {
    setCurrentWeek(startOfWeek(new Date(), { weekStartsOn: 1 }));
  };

  return (
    <div className="flex justify-between items-center mb-6">
      <h1 className="text-2xl font-bold">Your Calendar</h1>
      <div className="flex items-center space-x-2">
        <Button onClick={goToPreviousWeek} size="sm" variant="outline">
          Previous Week
        </Button>
        <Button onClick={goToCurrentWeek} size="sm">
          Current Week
        </Button>
        <Button onClick={goToNextWeek} size="sm" variant="outline">
          Next Week
        </Button>
        <Button onClick={openNewEventDialog} className="ml-4">Add Event</Button>
      </div>
    </div>
  );
}