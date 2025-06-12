import { createClientServer } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import { ErrorProvider } from "@/utils/context/ErrorContext";
import { SettingsMain } from "@/components/dashboard/settings";

export default async function SettingsPage() {
  const supabase = await createClientServer();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return redirect("/sign-in");
  }

  return (
    <ErrorProvider>
      <div className="flex flex-col gap-6 mx-auto p-8 w-full max-w-4xl">
        <h1 className="text-3xl font-bold">Settings</h1>
        
        <SettingsMain />
      </div>
    </ErrorProvider>
  );
} 