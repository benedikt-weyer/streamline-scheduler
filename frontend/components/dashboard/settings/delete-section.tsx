'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useError } from '@/utils/context/ErrorContext';
import { deleteAllUserData } from '@/app/dashboard/settings/actions';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Trash2, AlertTriangle } from 'lucide-react';

export function DeleteSection() {
  const [isDeleting, setIsDeleting] = useState(false);
  const [confirmationText, setConfirmationText] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const { setError } = useError();

  const REQUIRED_CONFIRMATION = 'DELETE ALL MY DATA';

  const handleDeleteAll = async () => {
    if (confirmationText !== REQUIRED_CONFIRMATION) {
      setError('Please type the exact confirmation text');
      return;
    }

    setIsDeleting(true);
    try {
      await deleteAllUserData();
      setError(''); // Clear any previous errors
      
      // Success feedback
      alert('All your data has been deleted successfully. You will be redirected to the dashboard.');
      
      // Redirect to dashboard after successful deletion
      window.location.href = '/dashboard';
    } catch (error) {
      console.error('Delete failed:', error);
      setError('Failed to delete data');
    } finally {
      setIsDeleting(false);
      setIsDialogOpen(false);
      setConfirmationText('');
    }
  };

  const isConfirmationValid = confirmationText === REQUIRED_CONFIRMATION;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold mb-2 text-red-600">Danger Zone</h2>
        <p className="text-sm text-muted-foreground">
          Permanently delete all your data. This action cannot be undone.
        </p>
      </div>

      <div className="border border-red-200 rounded-lg p-6 space-y-4 bg-red-50">
        <div className="flex items-start gap-3">
          <AlertTriangle className="h-6 w-6 text-red-600 flex-shrink-0 mt-0.5" />
          <div className="space-y-2">
            <h3 className="font-medium text-red-900">Delete All Data</h3>
            <p className="text-sm text-red-700">
              This will permanently delete:
            </p>
            <ul className="text-sm text-red-700 space-y-1 ml-4">
              <li>• All your tasks and to-do items</li>
              <li>• All your projects and project organization</li>
              <li>• All your calendars and calendar events</li>
              <li>• Your user profile data</li>
              <li>• All associated settings and preferences</li>
            </ul>
            <p className="text-sm text-red-700 font-medium">
              This action is irreversible. Consider exporting your data first.
            </p>
          </div>
        </div>

        <AlertDialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <AlertDialogTrigger asChild>
            <Button variant="destructive" className="w-full">
              <Trash2 className="h-4 w-4 mr-2" />
              Delete All My Data
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-red-600" />
                Confirm Data Deletion
              </AlertDialogTitle>
              <AlertDialogDescription className="space-y-4">
                <p>
                  You are about to permanently delete all your data from Streamline Scheduler. 
                  This includes all tasks, projects, calendars, events, and profile information.
                </p>
                <p className="font-medium text-red-600">
                  This action cannot be undone!
                </p>
                <div className="space-y-2">
                  <Label htmlFor="delete-confirmation" className="text-sm font-medium">
                    Type <code className="bg-gray-100 px-1 rounded text-red-600 font-mono">{REQUIRED_CONFIRMATION}</code> to confirm:
                  </Label>
                  <Input
                    id="delete-confirmation"
                    value={confirmationText}
                    onChange={(e) => setConfirmationText(e.target.value)}
                    placeholder={REQUIRED_CONFIRMATION}
                    className="font-mono"
                  />
                </div>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setConfirmationText('')}>
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDeleteAll}
                disabled={!isConfirmationValid || isDeleting}
                className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
              >
                {isDeleting ? 'Deleting...' : 'Delete All Data'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      {/* Additional warnings */}
      <div className="space-y-3 text-sm text-muted-foreground">
        <div className="flex items-start gap-2">
          <span className="text-blue-600">💡</span>
          <p>
            <strong>Tip:</strong> Before deleting, consider using the Export feature to backup your data.
          </p>
        </div>
        <div className="flex items-start gap-2">
          <span className="text-amber-600">⚠️</span>
          <p>
            <strong>Note:</strong> Your user account will remain active, but all application data will be removed.
          </p>
        </div>
      </div>
    </div>
  );
} 