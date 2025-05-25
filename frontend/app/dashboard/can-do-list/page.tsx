'use client';

import { ErrorProvider } from '@/utils/context/ErrorContext';
import CanDoListMain from '@/components/dashboard/can-do-list/can-do-list-main';

export default function CanDoListPage() {
  return (
    <ErrorProvider>
      <CanDoListMain />
    </ErrorProvider>
  );
}