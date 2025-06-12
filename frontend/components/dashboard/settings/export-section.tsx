'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useError } from '@/utils/context/ErrorContext';
import { exportAllUserData, type ExportedData } from '@/app/dashboard/settings/actions';
import { encryptData, generateIV, generateSalt, deriveKeyFromPassword } from '@/utils/cryptography/encryption';
import { Download, Lock, Unlock, Copy } from 'lucide-react';

interface ExportSectionProps {
  encryptionKey: string;
}

export function ExportSection({ encryptionKey }: ExportSectionProps) {
  const [isExporting, setIsExporting] = useState(false);
  const [password, setPassword] = useState('');
  const [exportedData, setExportedData] = useState<ExportedData | null>(null);
  const [encryptedExport, setEncryptedExport] = useState<string>('');
  const { setError } = useError();

  const handlePlainExport = async () => {
    setIsExporting(true);
    try {
      const data = await exportAllUserData();
      setExportedData(data);
      setEncryptedExport('');
      
      // Create and download file
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `streamline-scheduler-export-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Export failed:', error);
      setError('Failed to export data');
    } finally {
      setIsExporting(false);
    }
  };

  const handlePasswordProtectedExport = async () => {
    if (!password.trim()) {
      setError('Please enter a password for encryption');
      return;
    }

    setIsExporting(true);
    try {
      const data = await exportAllUserData();
      
      // Encrypt the data with user-provided password
      const salt = generateSalt();
      const iv = generateIV();
      const derivedKey = deriveKeyFromPassword(password, salt);
      const encrypted = encryptData(data, derivedKey, iv);
      
      const encryptedPackage = {
        encrypted_data: encrypted,
        salt,
        iv,
        version: '1.0.0',
        created_at: new Date().toISOString()
      };
      
      setEncryptedExport(JSON.stringify(encryptedPackage, null, 2));
      setExportedData(data);
      
      // Create and download encrypted file
      const blob = new Blob([JSON.stringify(encryptedPackage, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `streamline-scheduler-export-encrypted-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Encrypted export failed:', error);
      setError('Failed to create encrypted export');
    } finally {
      setIsExporting(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const getDataSummary = (data: ExportedData) => {
    return `${data.data.tasks.length} tasks, ${data.data.projects.length} projects, ${data.data.calendars.length} calendars, ${data.data.calendarEvents.length} calendar events`;
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold mb-2">Export Your Data</h2>
        <p className="text-sm text-muted-foreground">
          Export all your tasks, projects, calendars, and events. Choose between plain JSON or password-protected format.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {/* Plain Export */}
        <div className="border rounded-lg p-4 space-y-4">
          <div className="flex items-center gap-2">
            <Unlock className="h-5 w-5" />
            <h3 className="font-medium">Plain JSON Export</h3>
          </div>
          <p className="text-sm text-muted-foreground">
            Export your data as readable JSON. Note: This includes encrypted data that requires your encryption key to decrypt.
          </p>
          <Button 
            onClick={handlePlainExport} 
            disabled={isExporting}
            className="w-full"
          >
            <Download className="h-4 w-4 mr-2" />
            {isExporting ? 'Exporting...' : 'Export Plain JSON'}
          </Button>
        </div>

        {/* Password Protected Export */}
        <div className="border rounded-lg p-4 space-y-4">
          <div className="flex items-center gap-2">
            <Lock className="h-5 w-5" />
            <h3 className="font-medium">Password Protected Export</h3>
          </div>
          <p className="text-sm text-muted-foreground">
            Encrypt your export with an additional password for extra security.
          </p>
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
          <Button 
            onClick={handlePasswordProtectedExport} 
            disabled={isExporting || !password.trim()}
            className="w-full"
          >
            <Lock className="h-4 w-4 mr-2" />
            {isExporting ? 'Encrypting...' : 'Export Password Protected'}
          </Button>
        </div>
      </div>

      {/* Export Summary */}
      {exportedData && (
        <div className="border rounded-lg p-4 space-y-4">
          <h3 className="font-medium">Export Summary</h3>
          <div className="grid gap-2 text-sm">
            <div className="flex justify-between">
              <span>Export Date:</span>
              <span>{new Date(exportedData.timestamp).toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span>Data Summary:</span>
              <span>{getDataSummary(exportedData)}</span>
            </div>
            <div className="flex justify-between">
              <span>Version:</span>
              <span>{exportedData.version}</span>
            </div>
          </div>
          
          {encryptedExport && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Encrypted Export Preview</Label>
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