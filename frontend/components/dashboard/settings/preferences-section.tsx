'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useUserSettings } from '@/utils/context/UserSettingsContext';
import { toast } from 'sonner';

export function PreferencesSection() {
  const { settings, updateSettings, loading } = useUserSettings();

  const handleToggleTaskClickBehavior = async (checked: boolean) => {
    try {
      // checked = true means "edit on click", false means "complete on click"
      await updateSettings({ taskClickBehavior: checked ? 'edit' : 'complete' });
      toast.success('Setting updated successfully');
    } catch (error) {
      toast.error('Failed to update setting');
      console.error('Failed to update task click behavior:', error);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Preferences</CardTitle>
        <CardDescription>Customize how the application behaves</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="task-click-edit">Click task to edit</Label>
            <p className="text-sm text-muted-foreground">
              When enabled, clicking a task opens the edit dialog. When disabled, clicking a task marks it as complete.
            </p>
          </div>
          <Switch
            id="task-click-edit"
            checked={(settings.taskClickBehavior ?? 'edit') === 'edit'}
            onCheckedChange={handleToggleTaskClickBehavior}
            disabled={loading}
          />
        </div>
      </CardContent>
    </Card>
  );
}

