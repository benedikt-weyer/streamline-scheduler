import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from '@/components/ui/button';
import { CalendarEvent } from '@/utils/types';

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
    <AlertDialog open={isOpen} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete Recurring Event</AlertDialogTitle>
          <AlertDialogDescription>
            Choose how you want to delete this recurring event:
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-col space-y-2 sm:flex-row sm:space-x-2 sm:space-y-0">
          <Button
            variant="outline"
            onClick={handleThisOccurrence}
          >
            Delete This Occurrence Only
          </Button>
          <Button
            variant="outline"
            onClick={handleThisAndFuture}
          >
            Delete This and Future Events
          </Button>
          <Button
            variant="destructive"
            onClick={handleAllInSeries}
          >
            Delete All Events in Series
          </Button>
          <AlertDialogCancel asChild>
            <Button variant="ghost">Cancel</Button>
          </AlertDialogCancel>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
} 