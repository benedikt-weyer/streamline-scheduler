'use client';

import React, { createContext, useContext, useState, ReactNode } from 'react';

interface SchedulerNavContextType {
  schedulerNavContent: ReactNode | null;
  setSchedulerNavContent: (content: ReactNode | null) => void;
}

const SchedulerNavContext = createContext<SchedulerNavContextType | undefined>(undefined);

export function SchedulerNavProvider({ children }: { children: ReactNode }) {
  const [schedulerNavContent, setSchedulerNavContent] = useState<ReactNode | null>(null);

  return (
    <SchedulerNavContext.Provider value={{ schedulerNavContent, setSchedulerNavContent }}>
      {children}
    </SchedulerNavContext.Provider>
  );
}

export function useSchedulerNav() {
  const context = useContext(SchedulerNavContext);
  if (context === undefined) {
    throw new Error('useSchedulerNav must be used within a SchedulerNavProvider');
  }
  return context;
}

