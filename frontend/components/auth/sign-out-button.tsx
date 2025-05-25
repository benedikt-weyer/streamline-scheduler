'use client';

import { signOutAction } from "@/app/actions";
import { clearHashedPassword } from "@/utils/cryptography/encryption";
import { Button } from "../ui/button";

export default function SignOutButton() {
  const handleSignOut = async () => {
    // Clear the encryption key cookie before signing out
    clearHashedPassword();
    await signOutAction();
  };

  return (
    <Button onClick={handleSignOut} variant="outline">
      Sign out
    </Button>
  );
}