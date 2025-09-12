'use client';

import { signOutClient } from "@/utils/auth/auth-client";
import { clearHashedPassword } from "@/utils/cryptography/encryption";
import { Button } from "../ui/button";

export default function SignOutButton() {
  const handleSignOut = async () => {
    // Clear the encryption key cookie before signing out
    clearHashedPassword();
    
    const result = await signOutClient();
    
    if (result.error) {
      console.error('Sign out error:', result.error);
    }
    
    // Redirect to sign-in regardless of result
    window.location.href = '/sign-in';
  };

  return (
    <Button onClick={handleSignOut} variant="outline">
      Sign out
    </Button>
  );
}