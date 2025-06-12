import { createClientServer } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import { CanDoListMain } from "@/components/dashboard/can-do-list";
import { ErrorProvider } from "@/utils/context/ErrorContext";
import Link from "next/link";

export default async function ProtectedPage() {
  const supabase = await createClientServer();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return redirect("/sign-in");
  }

  return (
    <div className="flex flex-col gap-6 mx-auto p-8 w-full">
      <h1 className="text-3xl font-bold">Dashboard</h1>
      
      <p>Welcome to Streamline Scheduler!</p>
      
      <div className="grid gap-4 md:grid-cols-3">
        <Link href="/dashboard/can-do-list" className="block">
          <div className="border rounded-lg p-6 hover:shadow-md transition-shadow">
            <h2 className="text-xl font-semibold mb-2">Can-Do List</h2>
            <p className="text-sm text-muted-foreground">
              Manage your tasks and projects
            </p>
          </div>
        </Link>
        
        <Link href="/dashboard/calendar" className="block">
          <div className="border rounded-lg p-6 hover:shadow-md transition-shadow">
            <h2 className="text-xl font-semibold mb-2">Calendar</h2>
            <p className="text-sm text-muted-foreground">
              View and manage your events
            </p>
          </div>
        </Link>
        
        <Link href="/dashboard/scheduler" className="block">
          <div className="border rounded-lg p-6 hover:shadow-md transition-shadow">
            <h2 className="text-xl font-semibold mb-2">Scheduler</h2>
            <p className="text-sm text-muted-foreground">
              Plan and schedule your tasks
            </p>
          </div>
        </Link>
      </div>
    </div>
  );
}
