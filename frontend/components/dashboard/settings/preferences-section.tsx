'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useUserSettings } from '@/utils/context/UserSettingsContext';
import { LanguageSelector } from './language-selector';
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

  const handleToggleWeekStart = async (checked: boolean) => {
    try {
      // checked = true means Monday, false means Sunday
      await updateSettings({ weekStartsOn: checked ? 1 : 0 });
      toast.success('Week start day updated successfully');
    } catch (error) {
      toast.error('Failed to update setting');
      console.error('Failed to update week start day:', error);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Preferences</CardTitle>
        <CardDescription>Customize how the application behaves</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <LanguageSelector />
        
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
        
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="week-start-monday">Week starts on Monday</Label>
            <p className="text-sm text-muted-foreground">
              When enabled, weeks start on Monday. When disabled, weeks start on Sunday.
            </p>
          </div>
          <Switch
            id="week-start-monday"
            checked={(settings.weekStartsOn ?? 1) === 1}
            onCheckedChange={handleToggleWeekStart}
            disabled={loading}
          />
        </div>
      </CardContent>
    </Card>
  );
}

