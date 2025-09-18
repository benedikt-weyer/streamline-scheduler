'use client';

import { useState } from 'react';
import { useEncryptionKey } from '@/hooks/cryptography/useEncryptionKey';
import { useError } from '@/utils/context/ErrorContext';
import { ExportSection } from './export-section';
import { ImportSection } from './import-section';
import { DeleteSection } from './delete-section';
import { FixSection } from './fix-section';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export function SettingsMain() {
  const { encryptionKey, isLoading: isLoadingKey } = useEncryptionKey();
  const { setError } = useError();

  if (isLoadingKey) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  if (!encryptionKey) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <p className="text-red-600 mb-4">Encryption key not available</p>
          <p>Please refresh the page and try again.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Tabs defaultValue="export" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="export">Export Data</TabsTrigger>
          <TabsTrigger value="import">Import Data</TabsTrigger>
          <TabsTrigger value="fix">Fix Data</TabsTrigger>
          <TabsTrigger value="delete">Delete Data</TabsTrigger>
        </TabsList>
        
        <TabsContent value="export" className="space-y-4">
          <ExportSection encryptionKey={encryptionKey} />
        </TabsContent>
        
        <TabsContent value="import" className="space-y-4">
          <ImportSection encryptionKey={encryptionKey} />
        </TabsContent>
        
        <TabsContent value="fix" className="space-y-4">
          <FixSection encryptionKey={encryptionKey} />
        </TabsContent>
        
        <TabsContent value="delete" className="space-y-4">
          <DeleteSection />
        </TabsContent>
      </Tabs>
    </div>
  );
} 