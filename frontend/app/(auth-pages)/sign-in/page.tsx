'use client';

import { signInAction } from "@/app/actions";
import { FormMessage, Message } from "@/components/form-message";
import { SubmitButton } from "@/components/submit-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { hashPassword, storeHashedPassword } from "@/utils/encryption";
import Link from "next/link";
import { useState } from "react";

export default function Login(props: { searchParams: Message }) {
  const searchParams = props.searchParams;
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    // Hash the password and store it in a cookie for client-side encryption
    const hashedPassword = hashPassword(password);
    storeHashedPassword(hashedPassword);
    
    // Create and submit the form data
    const formData = new FormData();
    formData.append('email', email);
    formData.append('password', password);
    
    await signInAction(formData);
  };

  return (
    <form className="flex-1 flex flex-col min-w-64" onSubmit={handleSubmit}>
      <h1 className="text-2xl font-medium">Sign in</h1>
      <p className="text-sm text-foreground">
        Don't have an account?{" "}
        <Link className="text-foreground font-medium underline" href="/sign-up">
          Sign up
        </Link>
      </p>
      <div className="flex flex-col gap-2 [&>input]:mb-3 mt-8">
        <Label htmlFor="email">Email</Label>
        <Input 
          name="email" 
          placeholder="you@example.com" 
          required 
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <div className="flex justify-between items-center">
          <Label htmlFor="password">Password</Label>
          <Link
            className="text-xs text-foreground underline"
            href="/forgot-password"
          >
            Forgot Password?
          </Link>
        </div>
        <Input
          type="password"
          name="password"
          placeholder="Your password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <SubmitButton pendingText="Signing In...">
          Sign in
        </SubmitButton>
        <FormMessage message={searchParams} />
      </div>
    </form>
  );
}
