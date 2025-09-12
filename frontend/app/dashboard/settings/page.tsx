'use client';

import { AuthGuard } from "@/components/auth/auth-guard";
import { ErrorProvider } from "@/utils/context/ErrorContext";
import { SettingsMain } from "@/components/dashboard/settings";

export default function SettingsPage() {
  return (
    <AuthGuard>
      <ErrorProvider>
        <div className="flex flex-col gap-6 mx-auto p-8 w-full max-w-4xl">
          <h1 className="text-3xl font-bold">Settings</h1>
          
          <SettingsMain />
        </div>
      </ErrorProvider>
    </AuthGuard>
  );
} 