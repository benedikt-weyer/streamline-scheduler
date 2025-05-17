import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import CanDoListWrapper from "@/components/dashboard/can-do-list-wrapper";

export default async function ProtectedPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return redirect("/sign-in");
  }

  return (
    <div className="flex flex-col gap-6 max-w-4xl mx-auto p-4">
      <h1 className="text-3xl font-bold">Dashboard</h1>
      
      <section className="bg-card rounded-lg shadow p-6">
        <h2 className="text-2xl font-semibold mb-4">Can-Do List</h2>
        <CanDoListWrapper />
      </section>
    </div>
  );
}
