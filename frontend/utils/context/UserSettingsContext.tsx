'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { getDecryptedBackend } from '@/utils/api/decrypted-backend';
import { UserSettingsDecrypted } from '@/utils/api/types';
import type { Language } from '@/utils/i18n/types';

interface UserSettingsContextType {
  settings: UserSettingsDecrypted;
  updateSettings: (newSettings: Partial<UserSettingsDecrypted>) => Promise<void>;
  loading: boolean;
  error: string | null;
  syncLanguage: (language: Language) => void;
}

const UserSettingsContext = createContext<UserSettingsContextType | undefined>(undefined);

export const UserSettingsProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [settings, setSettings] = useState<UserSettingsDecrypted>({
    taskClickBehavior: 'edit',
    weekStartsOn: 1,
    language: 'en',
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Callback to sync language from LanguageContext
  const syncLanguage = React.useCallback((language: Language) => {
    setSettings(prev => ({ ...prev, language }));
  }, []);

  // Load settings on mount
  useEffect(() => {
    const loadSettings = async () => {
      try {
        setLoading(true);
        
        // Try to get decrypted backend (requires auth)
        const backend = getDecryptedBackend();
        const response = await backend.userSettings.get();
        
        if (response.error) {
          setError(response.error);
        } else if (response.data) {
          setSettings(response.data);
          
          // Sync language to localStorage for LanguageContext to pick up on next load
          if (response.data.language) {
            localStorage.setItem('language', response.data.language);
          }
        }
      } catch (err) {
        // If user is not authenticated, just use default settings
        console.warn('Failed to load user settings (user may not be logged in):', err);
        setError(null); // Don't show error if user is not logged in
      } finally {
        setLoading(false);
      }
    };

    loadSettings();
  }, []);

  const updateSettings = async (newSettings: Partial<UserSettingsDecrypted>) => {
    try {
      const backend = getDecryptedBackend();
      const updatedSettings = { ...settings, ...newSettings };
      const response = await backend.userSettings.update(updatedSettings);
      
      if (response.error) {
        setError(response.error);
        throw new Error(response.error);
      } else if (response.data) {
        setSettings(response.data);
        setError(null);
      }
    } catch (err) {
      console.error('Failed to update user settings:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to update settings';
      setError(errorMessage);
      throw err;
    }
  };

  return (
    <UserSettingsContext.Provider value={{ settings, updateSettings, loading, error, syncLanguage }}>
      {children}
    </UserSettingsContext.Provider>
  );
};

export const useUserSettings = (): UserSettingsContextType => {
  const context = useContext(UserSettingsContext);
  if (!context) {
    throw new Error('useUserSettings must be used within a UserSettingsProvider');
  }
  return context;
};

/**
 * Hook to get the week start day setting (0 = Sunday, 1 = Monday)
 * Returns 1 (Monday) by default
 */
export const useWeekStartDay = (): 0 | 1 => {
  const { settings } = useUserSettings();
  return settings.weekStartsOn ?? 1;
};

