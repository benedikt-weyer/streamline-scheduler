import { Button } from '@/components/ui/button';
import { subWeeks, addWeeks, startOfWeek, format } from 'date-fns';
import { ChevronLeft, ChevronRight, Calendar } from 'lucide-react';
import { useTranslation, useDateLocale } from '@/utils/context/LanguageContext';

interface CalendarHeaderProps {
  currentWeek: Date;
  setCurrentWeek: React.Dispatch<React.SetStateAction<Date>>;
  openNewEventDialog: () => void;
  onTodaySelected?: () => void;
}

export function CalendarHeader({ currentWeek, setCurrentWeek, openNewEventDialog, onTodaySelected }: CalendarHeaderProps) {
  const { t } = useTranslation();
  const dateLocale = useDateLocale();
  
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
    onTodaySelected?.();
  };

  return (
    <div className="flex justify-between items-center my-2">
      <div className="flex items-center space-x-2">
        <div className="flex items-center border rounded-md overflow-hidden mr-4">
          <Button onClick={goToCurrentWeek} size="sm" variant="outline" className="flex items-center gap-1 rounded-r-none border-0">
            <Calendar className="h-4 w-4" />
            <span>{t('common.today')}</span>
          </Button>
          <div className="h-6 w-px bg-border my-auto"></div>
          <Button onClick={goToPreviousWeek} size="sm" variant="outline" className="rounded-none border-0 px-2">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button onClick={goToNextWeek} size="sm" variant="outline" className="rounded-l-none border-0 px-2">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <h2 className="text-lg font-medium">
          {format(currentWeek, 'MMMM yyyy', { locale: dateLocale })} - Week {format(currentWeek, 'w', { locale: dateLocale })}
        </h2>
      </div>
      <div>
        <Button onClick={openNewEventDialog} size="sm">
          {t('calendar.addEvent')}
        </Button>
      </div>
    </div>
  );
}