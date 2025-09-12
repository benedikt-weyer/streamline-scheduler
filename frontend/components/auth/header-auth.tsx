import Link from "next/link";
import { Button } from "../ui/button";
import { getBackend } from "@/utils/api/backend-interface";
import SignOutButton from "./sign-out-button";

export default async function AuthButton() {
  let user = null;
  
  try {
    const backend = getBackend();
    const { data: { user: authUser } } = await backend.auth.getUser();
    user = authUser;
  } catch (error) {
    console.warn('Backend not initialized in AuthButton:', error);
  }

  return user ? (
    <div className="flex items-center gap-2 md:gap-4">
      <span className="hidden md:inline">Hey, {user.email}!</span>
      <SignOutButton />
    </div>
  ) : (
    <div className="flex gap-2">
      <Button asChild size="sm" variant={"outline"}>
        <Link href="/sign-in">Sign in</Link>
      </Button>
      <Button asChild size="sm" variant={"default"}>
        <Link href="/sign-up">Sign up</Link>
      </Button>
    </div>
  );
}
