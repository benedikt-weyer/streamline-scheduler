'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { useError } from '@/utils/context/ErrorContext';
import { exportUserData, type ExportedData, type DecryptedExportData, type DecryptedTask, type DecryptedProject, type DecryptedCalendar, type DecryptedCalendarEvent } from '@/app/dashboard/settings/actions';
import { encryptData, generateIV, generateSalt, deriveKeyFromPassword, decryptData } from '@/utils/cryptography/encryption';
import { Download, Lock, Unlock, Copy, FileText } from 'lucide-react';

interface ExportSectionProps {
  encryptionKey: string;
}

export function ExportSection({ encryptionKey }: ExportSectionProps) {
  const [isExporting, setIsExporting] = useState(false);
  const [password, setPassword] = useState('');
  const [usePasswordProtection, setUsePasswordProtection] = useState(false);
  const [exportFormat, setExportFormat] = useState<'encrypted' | 'decrypted'>('encrypted');
  const [exportedData, setExportedData] = useState<ExportedData | null>(null);
  const [decryptedExportedData, setDecryptedExportedData] = useState<DecryptedExportData | null>(null);
  const [encryptedExport, setEncryptedExport] = useState<string>('');
  const { setError } = useError();

  const decryptExportData = (rawData: ExportedData, key: string): DecryptedExportData => {
    const decryptTasks = (tasks: any[]): DecryptedTask[] => {
      return tasks
        .map(task => {
          try {
            const decryptionKey = deriveKeyFromPassword(key, task.salt);
            const decryptedData = decryptData(task.encrypted_data, decryptionKey, task.iv);
            
            if (!decryptedData) return null;
            
            return {
              id: task.id,
              content: decryptedData.content,
              completed: decryptedData.completed,
              estimatedDuration: decryptedData.estimatedDuration,
              impact: decryptedData.impact,
              urgency: decryptedData.urgency,
              dueDate: decryptedData.dueDate,
              blockedBy: decryptedData.blockedBy,
              projectId: task.project_id,
              displayOrder: task.display_order ?? 0,
              createdAt: task.created_at,
              updatedAt: task.updated_at
            };
          } catch (error) {
            console.error('Failed to decrypt task:', error);
            return null;
          }
        })
        .filter((task): task is NonNullable<typeof task> => task !== null);
    };

    const decryptProjects = (projects: any[]): DecryptedProject[] => {
      return projects
        .map(project => {
          try {
            const decryptionKey = deriveKeyFromPassword(key, project.salt);
            const decryptedData = decryptData(project.encrypted_data, decryptionKey, project.iv);
            
            if (!decryptedData) return null;
            
            return {
              id: project.id,
              name: decryptedData.name,
              color: decryptedData.color,
              parentId: project.parent_id,
              displayOrder: project.display_order ?? 0,
              isCollapsed: project.is_collapsed ?? false,
              createdAt: project.created_at,
              updatedAt: project.updated_at
            };
          } catch (error) {
            console.error('Failed to decrypt project:', error);
            return null;
          }
        })
        .filter((project): project is NonNullable<typeof project> => project !== null);
    };

    const decryptCalendars = (calendars: any[]): DecryptedCalendar[] => {
      return calendars
        .map(calendar => {
          try {
            const decryptionKey = deriveKeyFromPassword(key, calendar.salt);
            const decryptedData = decryptData(calendar.encrypted_data, decryptionKey, calendar.iv);
            
            if (!decryptedData) return null;
            
            return {
              id: calendar.id,
              name: decryptedData.name,
              color: decryptedData.color,
              isVisible: decryptedData.isVisible ?? true,
              isDefault: calendar.is_default,
              type: decryptedData.type || 'Regular',
              icsUrl: decryptedData.icsUrl,
              lastSync: decryptedData.lastSync,
              createdAt: calendar.created_at,
              updatedAt: calendar.updated_at
            };
          } catch (error) {
            console.error('Failed to decrypt calendar:', error);
            return null;
          }
        })
        .filter((calendar): calendar is NonNullable<typeof calendar> => calendar !== null);
    };

    const decryptCalendarEvents = (events: any[]): DecryptedCalendarEvent[] => {
      return events
        .map(event => {
          try {
            const decryptionKey = deriveKeyFromPassword(key, event.salt);
            const decryptedData = decryptData(event.encrypted_data, decryptionKey, event.iv);
            
            if (!decryptedData) return null;
            
            // Construct recurrence pattern from decrypted data
            let recurrencePattern = undefined;
            if (decryptedData.recurrenceFrequency && decryptedData.recurrenceFrequency !== 'none') {
              recurrencePattern = {
                frequency: decryptedData.recurrenceFrequency,
                interval: decryptedData.recurrenceInterval || 1,
                endDate: decryptedData.recurrenceEndDate,
                daysOfWeek: decryptedData.daysOfWeek
              };
            }
            
            return {
              id: event.id,
              title: decryptedData.title,
              description: decryptedData.description,
              location: decryptedData.location,
              startTime: decryptedData.startTime,
              endTime: decryptedData.endTime,
              isAllDay: decryptedData.isAllDay,
              recurrenceRule: decryptedData.recurrenceRule,
              recurrencePattern: recurrencePattern,
              recurrenceException: decryptedData.recurrenceException,
              calendarId: decryptedData.calendarId,
              createdAt: event.created_at,
              updatedAt: event.updated_at
            };
          } catch (error) {
            console.error('Failed to decrypt calendar event:', error);
            return null;
          }
        })
        .filter((event): event is NonNullable<typeof event> => event !== null);
    };

    return {
      version: rawData.version,
      timestamp: rawData.timestamp,
      userId: rawData.userId,
      data: {
        tasks: decryptTasks(rawData.data.can_do_list),
        projects: decryptProjects(rawData.data.projects),
        calendars: decryptCalendars(rawData.data.calendars),
        calendarEvents: decryptCalendarEvents(rawData.data.calendar_events),
        profile: undefined
      }
    };
  };

  const handleExport = async () => {
    if (usePasswordProtection && !password.trim()) {
      setError('Please enter a password for encryption');
      return;
    }

    setIsExporting(true);
    try {
      const rawData = await exportUserData();
      let dataToExport: ExportedData | DecryptedExportData;
      let filename: string;
      let formatLabel: string;

      // Determine what data to export based on format
      if (exportFormat === 'decrypted') {
        const decryptedData = decryptExportData(rawData, encryptionKey);
        dataToExport = decryptedData;
        setDecryptedExportedData(decryptedData);
        setExportedData(null);
        filename = 'streamline-scheduler-decrypted-export';
        formatLabel = 'decrypted';
      } else {
        dataToExport = rawData;
        setExportedData(rawData);
        setDecryptedExportedData(null);
        filename = 'streamline-scheduler-export';
        formatLabel = 'encrypted';
      }

      // Handle password protection
      if (usePasswordProtection) {
        const salt = generateSalt();
        const iv = generateIV();
        const derivedKey = deriveKeyFromPassword(password, salt);
        const encrypted = encryptData(dataToExport, derivedKey, iv);
        
        const encryptedPackage = {
          encrypted_data: encrypted,
          salt,
          iv,
          version: '1.0.0',
          created_at: new Date().toISOString(),
          original_format: exportFormat // Track the original format
        };
        
        setEncryptedExport(JSON.stringify(encryptedPackage, null, 2));
        
        // Create and download encrypted file
        const blob = new Blob([JSON.stringify(encryptedPackage, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${filename}-password-protected-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } else {
        setEncryptedExport('');
        
        // Create and download plain file
        const blob = new Blob([JSON.stringify(dataToExport, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${filename}-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }
    } catch (error) {
      console.error('Export failed:', error);
      setError(`Failed to export ${exportFormat} data`);
    } finally {
      setIsExporting(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const getDataSummary = (data: ExportedData | DecryptedExportData) => {
    if ('tasks' in data.data) {
      // DecryptedExportData
      return `${data.data.tasks.length} tasks, ${data.data.projects.length} projects, ${data.data.calendars.length} calendars, ${data.data.calendarEvents.length} calendar events`;
    } else {
      // ExportedData
      return `${data.data.can_do_list.length} tasks, ${data.data.projects.length} projects, ${data.data.calendars.length} calendars, ${data.data.calendar_events.length} calendar events`;
    }
  };

  const getFormatDescription = () => {
    if (exportFormat === 'decrypted') {
      return 'Export your data as human-readable, unencrypted JSON. Perfect for backup or migration to other systems.';
    } else {
      return 'Export your data with the original encryption intact. Requires your encryption key to decrypt later.';
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold mb-2">Export Your Data</h2>
        <p className="text-sm text-muted-foreground">
          Export all your tasks, projects, calendars, and events. Choose your preferred format and security options.
        </p>
      </div>

      {/* Export Configuration */}
      <div className="border rounded-lg p-4 space-y-4">
        <h3 className="font-medium">Export Configuration</h3>
        
        {/* Format Selection */}
        <div className="space-y-3">
          <Label>Data Format</Label>
          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <input
                type="radio"
                id="format-encrypted"
                name="format"
                value="encrypted"
                checked={exportFormat === 'encrypted'}
                onChange={(e) => setExportFormat(e.target.value as 'encrypted' | 'decrypted')}
                className="h-4 w-4"
              />
              <Label htmlFor="format-encrypted" className="flex items-center gap-2 cursor-pointer">
                <Unlock className="h-4 w-4" />
                Encrypted Format (Original Database Format)
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <input
                type="radio"
                id="format-decrypted"
                name="format"
                value="decrypted"
                checked={exportFormat === 'decrypted'}
                onChange={(e) => setExportFormat(e.target.value as 'encrypted' | 'decrypted')}
                className="h-4 w-4"
              />
              <Label htmlFor="format-decrypted" className="flex items-center gap-2 cursor-pointer">
                <FileText className="h-4 w-4" />
                Decrypted Format (Human Readable)
              </Label>
            </div>
          </div>
          <p className="text-sm text-muted-foreground">
            {getFormatDescription()}
          </p>
        </div>

        {/* Password Protection Option */}
        <div className="space-y-3">
          <div className="flex items-center space-x-2">
            <Checkbox
              id="use-password"
              checked={usePasswordProtection}
              onCheckedChange={(checked) => setUsePasswordProtection(checked as boolean)}
            />
            <Label htmlFor="use-password" className="flex items-center gap-2 cursor-pointer">
              <Lock className="h-4 w-4" />
              Add Password Protection
            </Label>
          </div>
          <p className="text-sm text-muted-foreground">
            Encrypt your export with an additional password for extra security during transport or storage.
          </p>
          
          {usePasswordProtection && (
            <div className="space-y-2">
              <Label htmlFor="export-password">Export Password</Label>
              <Input
                id="export-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter a strong password"
              />
            </div>
          )}
        </div>

        {/* Export Button */}
        <Button 
          onClick={handleExport} 
          disabled={isExporting || (usePasswordProtection && !password.trim())}
          className="w-full"
          size="lg"
        >
          <Download className="h-4 w-4 mr-2" />
          {isExporting ? 'Exporting...' : `Export ${exportFormat === 'decrypted' ? 'Decrypted' : 'Encrypted'} Data${usePasswordProtection ? ' (Password Protected)' : ''}`}
        </Button>
      </div>

      {/* Export Summary */}
      {(exportedData || decryptedExportedData) && (
        <div className="border rounded-lg p-4 space-y-4">
          <h3 className="font-medium">Export Summary</h3>
          <div className="grid gap-2 text-sm">
            <div className="flex justify-between">
              <span>Export Date:</span>
              <span>{new Date((decryptedExportedData || exportedData)!.timestamp).toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span>Data Summary:</span>
              <span>{getDataSummary(decryptedExportedData || exportedData!)}</span>
            </div>
            <div className="flex justify-between">
              <span>Version:</span>
              <span>{(decryptedExportedData || exportedData)!.version}</span>
            </div>
            <div className="flex justify-between">
              <span>Format:</span>
              <span className="flex items-center gap-1">
                {encryptedExport ? (
                  <>
                    <Lock className="h-3 w-3" />
                    Password Protected ({decryptedExportedData ? 'Decrypted' : 'Encrypted'})
                  </>
                ) : decryptedExportedData ? (
                  <>
                    <FileText className="h-3 w-3" />
                    Decrypted
                  </>
                ) : (
                  <>
                    <Unlock className="h-3 w-3" />
                    Encrypted
                  </>
                )}
              </span>
            </div>
          </div>
          
          {encryptedExport && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Password Protected Export Preview</Label>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => copyToClipboard(encryptedExport)}
                >
                  <Copy className="h-4 w-4 mr-2" />
                  Copy
                </Button>
              </div>
              <Textarea
                value={encryptedExport}
                readOnly
                className="h-32 text-xs font-mono"
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
} 