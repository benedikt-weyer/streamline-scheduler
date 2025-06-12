'use client';

import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useError } from '@/utils/context/ErrorContext';
import { importUserData, type ExportedData } from '@/app/dashboard/settings/actions';
import { decryptData, deriveKeyFromPassword } from '@/utils/cryptography/encryption';
import { Upload, Eye, AlertTriangle, CheckCircle, Lock, Unlock } from 'lucide-react';
// Remove unused import

interface ImportSectionProps {
  encryptionKey: string;
}

interface ImportPreview {
  isValid: boolean;
  data?: ExportedData;
  summary: string;
  warnings: string[];
  errors: string[];
}

export function ImportSection({ encryptionKey }: ImportSectionProps) {
  const [isImporting, setIsImporting] = useState(false);
  const [isDryRun, setIsDryRun] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [password, setPassword] = useState('');
  const [importData, setImportData] = useState<string>('');
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [isPasswordProtected, setIsPasswordProtected] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { setError } = useError();

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setImportFile(file);
      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target?.result as string;
        setImportData(content);
        // Try to detect if it's password protected
        try {
          const parsed = JSON.parse(content);
          setIsPasswordProtected(parsed.encrypted_data && parsed.salt && parsed.iv);
        } catch {
          setIsPasswordProtected(false);
        }
      };
      reader.readAsText(file);
    }
  };

  const decryptImportData = (rawData: string, password?: string): ExportedData | null => {
    try {
      const parsed = JSON.parse(rawData);
      
      // Check if it's password protected
      if (parsed.encrypted_data && parsed.salt && parsed.iv) {
        if (!password) {
          throw new Error('Password required for encrypted data');
        }
        
        const derivedKey = deriveKeyFromPassword(password, parsed.salt);
        const decrypted = decryptData(parsed.encrypted_data, derivedKey, parsed.iv);
        
        if (!decrypted) {
          throw new Error('Failed to decrypt data - check password');
        }
        
        return decrypted as ExportedData;
      } else {
        // Plain JSON format
        return parsed as ExportedData;
      }
    } catch (error) {
      console.error('Failed to decrypt import data:', error);
      return null;
    }
  };

  const validateImportData = (data: ExportedData): ImportPreview => {
    const warnings: string[] = [];
    const errors: string[] = [];

    // Basic structure validation
    if (!data.version) {
      errors.push('Missing version information');
    }
    if (!data.data) {
      errors.push('Invalid data structure');
      return {
        isValid: false,
        summary: 'Invalid import file structure',
        warnings,
        errors
      };
    }

    // Data validation
    const { tasks, projects, calendars, calendarEvents } = data.data;
    
    if (!Array.isArray(tasks)) errors.push('Invalid tasks data - must be an array');
    if (!Array.isArray(projects)) errors.push('Invalid projects data - must be an array');
    if (!Array.isArray(calendars)) errors.push('Invalid calendars data - must be an array');
    if (!Array.isArray(calendarEvents)) errors.push('Invalid calendar events data - must be an array');

    // Version compatibility
    if (data.version !== '1.0.0') {
      warnings.push(`Version mismatch: importing ${data.version}, current version is 1.0.0`);
    }

    // Data size warnings
    const totalItems = (tasks?.length || 0) + (projects?.length || 0) + (calendars?.length || 0) + (calendarEvents?.length || 0);
    if (totalItems > 1000) {
      warnings.push(`Large import detected (${totalItems} items) - this may take a while`);
    }

    // Check for potential conflicts and data issues
    if (tasks && tasks.length > 0) {
      warnings.push(`Processing ${tasks.length} tasks - duplicates will be automatically skipped`);
      
      // Check if tasks have required fields
      const invalidTasks = tasks.filter(task => !task.encrypted_data || !task.iv || !task.salt);
      if (invalidTasks.length > 0) {
        errors.push(`${invalidTasks.length} tasks are missing required encryption fields`);
      }
      
      // Check for tasks with project references
      const tasksWithProjects = tasks.filter(task => task.project_id);
      if (tasksWithProjects.length > 0) {
        warnings.push(`${tasksWithProjects.length} tasks reference projects - these relationships will be lost during import`);
      }
    }
    
    if (projects && projects.length > 0) {
      warnings.push(`Processing ${projects.length} projects - duplicates will be automatically skipped`);
      
      // Check if projects have required fields
      const invalidProjects = projects.filter(project => !project.encrypted_data || !project.iv || !project.salt);
      if (invalidProjects.length > 0) {
        errors.push(`${invalidProjects.length} projects are missing required encryption fields`);
      }
      
      // Check for nested projects
      const nestedProjects = projects.filter(project => project.parent_id);
      if (nestedProjects.length > 0) {
        warnings.push(`${nestedProjects.length} projects have parent relationships - these relationships will be lost during import`);
      }
    }

    if (calendars && calendars.length > 0) {
      warnings.push(`Processing ${calendars.length} calendars - duplicates will be automatically skipped`);
      
      // Check if calendars have required fields
      const invalidCalendars = calendars.filter(calendar => !calendar.encrypted_data || !calendar.iv || !calendar.salt);
      if (invalidCalendars.length > 0) {
        errors.push(`${invalidCalendars.length} calendars are missing required encryption fields`);
      }
    }

    if (calendarEvents && calendarEvents.length > 0) {
      warnings.push(`Processing ${calendarEvents.length} calendar events - duplicates will be automatically skipped`);
      
      // Check if events have required fields
      const invalidEvents = calendarEvents.filter(event => !event.encrypted_data || !event.iv || !event.salt);
      if (invalidEvents.length > 0) {
        errors.push(`${invalidEvents.length} calendar events are missing required encryption fields`);
      }
    }

    if (totalItems === 0) {
      warnings.push('No data to import - the export appears to be empty');
    }

    const summary = `${tasks?.length || 0} tasks, ${projects?.length || 0} projects, ${calendars?.length || 0} calendars, ${calendarEvents?.length || 0} events`;

    return {
      isValid: errors.length === 0,
      data,
      summary,
      warnings,
      errors
    };
  };

  const handleDryRun = async () => {
    if (!importData) {
      setError('Please select a file or enter import data');
      return;
    }

    if (isPasswordProtected && !password) {
      setError('Please enter the password for encrypted data');
      return;
    }

    setIsDryRun(true);
    try {
      const decrypted = decryptImportData(importData, password);
      if (!decrypted) {
        setError('Failed to decrypt or parse import data');
        return;
      }

      const preview = validateImportData(decrypted);
      setPreview(preview);
    } catch (error) {
      console.error('Dry run failed:', error);
      setError('Failed to analyze import data');
    } finally {
      setIsDryRun(false);
    }
  };

  const handleImport = async () => {
    if (!preview?.isValid || !preview.data) {
      setError('Please run a dry run first to validate the data');
      return;
    }

    setIsImporting(true);
    try {
      console.log('Starting import process...');
      await importUserData(preview.data);
      setError(''); // Clear any previous errors
      
      // Success feedback with more detail
      const summary = `Processed for import: ${preview.data.data.tasks.length} tasks, ${preview.data.data.projects.length} projects, ${preview.data.data.calendars.length} calendars, ${preview.data.data.calendarEvents.length} events`;
      
      alert(`Data import completed!\n\n${summary}\n\nNote: Duplicate items (same encrypted data) were automatically skipped. Some relationships between items may need to be re-established manually. Please refresh the page to see your imported data.`);
      
      // Reset form
      setImportData('');
      setImportFile(null);
      setPassword('');
      setPreview(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (error) {
      console.error('Import failed:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      setError(`Import failed: ${errorMessage}`);
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold mb-2">Import Your Data</h2>
        <p className="text-sm text-muted-foreground">
          Import data from a previous export. Run a dry run first to preview what will be imported.
        </p>
      </div>

      {/* File Upload */}
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="import-file">Import File</Label>
          <div className="flex gap-2">
            <Input
              ref={fileInputRef}
              id="import-file"
              type="file"
              accept=".json"
              onChange={handleFileSelect}
              className="flex-1"
            />
            <Button
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="h-4 w-4 mr-2" />
              Choose File
            </Button>
          </div>
          {importFile && (
            <p className="text-sm text-muted-foreground">
              Selected: {importFile.name} ({(importFile.size / 1024).toFixed(1)}KB)
            </p>
          )}
        </div>

        {/* Password Input for Encrypted Files */}
        {isPasswordProtected && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Lock className="h-4 w-4" />
              <Label htmlFor="import-password">Decryption Password</Label>
            </div>
            <Input
              id="import-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter the password used to encrypt this export"
            />
          </div>
        )}

        {/* Manual Data Input */}
        <div className="space-y-2">
          <Label htmlFor="import-data">Or Paste JSON Data</Label>
          <Textarea
            id="import-data"
            value={importData}
            onChange={(e) => setImportData(e.target.value)}
            placeholder="Paste your exported JSON data here..."
            className="h-32 text-xs font-mono"
          />
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-2">
        <Button
          onClick={handleDryRun}
          disabled={isDryRun || !importData}
          variant="outline"
          className="flex-1"
        >
          <Eye className="h-4 w-4 mr-2" />
          {isDryRun ? 'Analyzing...' : 'Dry Run Preview'}
        </Button>
        <Button
          onClick={handleImport}
          disabled={isImporting || !preview?.isValid}
          className="flex-1"
        >
          <Upload className="h-4 w-4 mr-2" />
          {isImporting ? 'Importing...' : 'Import Data'}
        </Button>
      </div>

      {/* Preview Results */}
      {preview && (
        <div className="border rounded-lg p-4 space-y-4">
          <div className="flex items-center gap-2">
            {preview.isValid ? (
              <CheckCircle className="h-5 w-5 text-green-600" />
            ) : (
              <AlertTriangle className="h-5 w-5 text-red-600" />
            )}
            <h3 className="font-medium">
              {preview.isValid ? 'Import Preview' : 'Validation Failed'}
            </h3>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Data Summary:</span>
              <span>{preview.summary}</span>
            </div>
            {preview.data && (
              <>
                <div className="flex justify-between text-sm">
                  <span>Export Date:</span>
                  <span>{new Date(preview.data.timestamp).toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Export Version:</span>
                  <span>{preview.data.version}</span>
                </div>
              </>
            )}
            <div className="flex justify-between text-sm">
              <span>Format:</span>
              <span className="flex items-center gap-1">
                {isPasswordProtected ? (
                  <>
                    <Lock className="h-3 w-3" />
                    Password Protected
                  </>
                ) : (
                  <>
                    <Unlock className="h-3 w-3" />
                    Plain JSON
                  </>
                )}
              </span>
            </div>
          </div>

          {/* Warnings */}
          {preview.warnings.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-amber-600">Warnings:</h4>
              <ul className="text-sm text-amber-700 space-y-1">
                {preview.warnings.map((warning, index) => (
                  <li key={index} className="flex items-start gap-2">
                    <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                    {warning}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Errors */}
          {preview.errors.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-red-600">Errors:</h4>
              <ul className="text-sm text-red-700 space-y-1">
                {preview.errors.map((error, index) => (
                  <li key={index} className="flex items-start gap-2">
                    <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                    {error}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
} 