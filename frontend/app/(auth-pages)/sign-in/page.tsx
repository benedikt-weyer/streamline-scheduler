'use client';

import { signInAction } from "@/app/actions";

import { FormMessage as AuthFormMessage, Message } from "@/components/auth/form-message";
import { SubmitButton } from "@/components/ui/submit-button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";

import { hashPasswordForAuth, hashPasswordForEncryption, storeEncryptionKey } from "@/utils/cryptography/encryption";

import { useState, useEffect, Suspense } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

// Define the schema for form validation
const signInSchema = z.object({
  email: z.string().email({ message: "Please enter a valid email address" }),
  password: z.string().min(1, { message: "Password is required" })
});

type SignInFormValues = z.infer<typeof signInSchema>;

function SignInForm() {
  const searchParams = useSearchParams();
  const [message, setMessage] = useState<Message | null>(null);

  // Initialize react-hook-form with zod validation
  const form = useForm<SignInFormValues>({
    resolver: zodResolver(signInSchema),
    defaultValues: {
      email: '',
      password: ''
    }
  });

  useEffect(() => {
    if (searchParams.has('success')) {
      setMessage({ success: searchParams.get('success')! });
    } else if (searchParams.has('error')) {
      setMessage({ error: searchParams.get('error')! });
    } else if (searchParams.has('message')) {
      setMessage({ message: searchParams.get('message')! });
    }
  }, [searchParams]);

  const onSubmit = async (values: SignInFormValues) => {    
    // Hash the password for authentication with Supabase
    const authHash = hashPasswordForAuth(values.password);
    
    // Hash the password for encryption and store it in a cookie for client-side encryption
    const encryptionKey = hashPasswordForEncryption(values.password);
    storeEncryptionKey(encryptionKey);
    
    // Create and submit the form data with the hashed password for authentication
    const formData = new FormData();
    formData.append('email', values.email);
    formData.append('password', authHash);
    
    await signInAction(formData);
  };

  return (
    <Form {...form}>
      <form 
        onSubmit={form.handleSubmit(onSubmit)} 
        className="flex-1 flex flex-col min-w-64"
        autoComplete="on"
      >
        <h1 className="text-2xl font-medium">Sign in</h1>
        <p className="text-sm text-foreground">
          Don't have an account?{" "}
          <Link className="text-foreground font-medium underline" href="/sign-up">
            Sign up
          </Link>
        </p>
        <div className="flex flex-col gap-4 mt-8">
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel htmlFor="email">Email</FormLabel>
                <FormControl>
                  <Input 
                    id="email"
                    type="email"
                    autoComplete="email"
                    placeholder="you@example.com" 
                    {...field} 
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          
          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <div className="flex justify-between items-center">
                  <FormLabel htmlFor="current-password">Password</FormLabel>
                  <Link
                    className="text-xs text-foreground underline"
                    href="/forgot-password"
                  >
                    Forgot Password?
                  </Link>
                </div>
                <FormControl>
                  <Input 
                    id="current-password"
                    type="password" 
                    autoComplete="current-password"
                    placeholder="Your password" 
                    {...field} 
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          
          <SubmitButton pendingText="Signing In...">
            Sign in
          </SubmitButton>
          { message ? <AuthFormMessage message={message} /> : null }
        </div>
      </form>
    </Form>
  );
}

export default function Login() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <SignInForm />
    </Suspense>
  );
}
