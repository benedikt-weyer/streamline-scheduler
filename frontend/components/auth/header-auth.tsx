'use client';

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "../ui/button";
import { getBackend } from "@/utils/api/backend-interface";
import { AuthUser } from "@/utils/api/types";
import SignOutButton from "./sign-out-button";

export default function AuthButton() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function checkAuth() {
      try {
        const backend = getBackend();
        const { data: { user: authUser }, error } = await backend.auth.getUser();
        setUser(authUser);
      } catch (error) {
        console.warn('Backend not initialized in AuthButton:', error);
      } finally {
        setIsLoading(false);
      }
    }

    checkAuth();

    // Listen for auth state changes
    const backend = getBackend();
    const { data } = backend.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        setUser(session.user);
        setIsLoading(false);
      } else if (event === 'SIGNED_OUT') {
        setUser(null);
        setIsLoading(false);
      }
    });

    return () => {
      if (data?.subscription?.unsubscribe) {
        data.subscription.unsubscribe();
      }
    };
  }, []);

  if (isLoading) {
    return (
      <div className="flex gap-2">
        <div className="w-16 h-8 bg-gray-200 animate-pulse rounded"></div>
        <div className="w-16 h-8 bg-gray-200 animate-pulse rounded"></div>
      </div>
    );
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
