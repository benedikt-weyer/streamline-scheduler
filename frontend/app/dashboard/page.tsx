import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import { CanDoListMain } from "@/components/dashboard/can-do-list";
import { ErrorProvider } from "@/utils/context/ErrorContext";

export default async function ProtectedPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return redirect("/sign-in");
  }

  return (
    <div className="flex flex-col gap-6 mx-auto p-8 w-full">
      <h1 className="text-3xl font-bold">Dashboard</h1>
      
      <p>Welcome to Streamline Sheduler!</p>
    </div>
  );
}
