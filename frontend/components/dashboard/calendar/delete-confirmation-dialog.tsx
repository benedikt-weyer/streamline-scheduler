import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from '@/components/ui/button';
import { CalendarEvent } from '@/utils/calendar/calendar-types';
import { Calendar, CalendarX, Trash2 } from 'lucide-react';

interface DeleteConfirmationDialogProps {
  readonly isOpen: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly selectedEvent: CalendarEvent; // Assuming selectedEvent will always be present when this dialog is open
  readonly onDeleteThisOccurrence: (event: CalendarEvent) => Promise<void>;
  readonly onDeleteThisAndFuture: (event: CalendarEvent) => Promise<void>;
  readonly onDeleteAllInSeries: (event: CalendarEvent) => Promise<void>;
  readonly onDeleteConfirmedAndMainDialogClose: () => void; // New prop to close the main dialog
}

export function DeleteConfirmationDialog({
  isOpen,
  onOpenChange,
  selectedEvent,
  onDeleteThisOccurrence,
  onDeleteThisAndFuture,
  onDeleteAllInSeries,
  onDeleteConfirmedAndMainDialogClose,
}: DeleteConfirmationDialogProps) {
  if (!selectedEvent) return null; // Should not happen if logic is correct, but good guard

  const handleThisOccurrence = async () => {
    await onDeleteThisOccurrence(selectedEvent);
    setTimeout(() => {
      onOpenChange(false); // Close this confirmation dialog
      onDeleteConfirmedAndMainDialogClose(); // Close the main dialog
    }, 0); // Defer to next tick
  };

  const handleThisAndFuture = async () => {
    await onDeleteThisAndFuture(selectedEvent);
    setTimeout(() => {
      onOpenChange(false);
      onDeleteConfirmedAndMainDialogClose();
    }, 0);
  };

  const handleAllInSeries = async () => {
    await onDeleteAllInSeries(selectedEvent);
    setTimeout(() => {
      onOpenChange(false);
      onDeleteConfirmedAndMainDialogClose();
    }, 0);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Delete Event</DialogTitle>
          <DialogDescription>
            "{selectedEvent.title}" is a recurring event. How would you like to delete it?
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col space-y-3 pt-4">
          <Button
            variant="outline"
            onClick={handleThisOccurrence}
            className="w-full justify-start h-auto py-3 px-4"
          >
            <Calendar className="w-5 h-5 mr-3 shrink-0" />
            <div className="text-left">
              <div className="font-medium">Just this event</div>
              <div className="text-sm text-muted-foreground">Only delete this occurrence</div>
            </div>
          </Button>
          <Button
            variant="outline"
            onClick={handleThisAndFuture}
            className="w-full justify-start h-auto py-3 px-4"
          >
            <CalendarX className="w-5 h-5 mr-3 shrink-0" />
            <div className="text-left">
              <div className="font-medium">This and future events</div>
              <div className="text-sm text-muted-foreground">Delete this and all upcoming occurrences</div>
            </div>
          </Button>
          <Button
            variant="destructive"
            onClick={handleAllInSeries}
            className="w-full justify-start h-auto py-3 px-4 bg-red-500/80 hover:bg-red-600/80 text-white"
          >
            <Trash2 className="w-5 h-5 mr-3 shrink-0 text-white" />
            <div className="text-left">
              <div className="font-medium text-white">All events in series</div>
              <div className="text-sm text-red-50">Delete the entire recurring event series</div>
            </div>
          </Button>
        </div>
        <DialogFooter className="pt-4">
          <Button variant="ghost" className="w-full" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
} 