'use client';

import { signUpAction } from "@/app/actions";
import { FormMessage, Message } from "@/components/auth/form-message";
import { SubmitButton } from "@/components/ui/submit-button";
import { Input } from "@/components/ui/input";
import Link from "next/link";
import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem, FormLabel } from "@/components/ui/form";

// Define the schema for form validation
const signUpSchema = z.object({
  email: z.string().email({ message: "Please enter a valid email address" }),
  password: z.string().min(6, { message: "Password must be at least 6 characters" })
});

type SignUpFormValues = z.infer<typeof signUpSchema>;

export default function Signup() {
  const searchParams = useSearchParams();
  const [message, setMessage] = useState<Message | null>(null);

  // Initialize react-hook-form with zod validation
  const form = useForm<SignUpFormValues>({
    resolver: zodResolver(signUpSchema),
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

  const onSubmit = async (values: SignUpFormValues) => {
    const formData = new FormData();
    formData.append('email', values.email);
    formData.append('password', values.password);
    
    await signUpAction(formData);
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col min-w-64 max-w-64 mx-auto">
        <h1 className="text-2xl font-medium">Sign up</h1>
        <p className="text-sm text text-foreground">
          Already have an account?{" "}
          <Link className="text-primary font-medium underline" href="/sign-in">
            Sign in
          </Link>
        </p>
        <div className="flex flex-col gap-4 mt-8">
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Email</FormLabel>
                <FormControl>
                  <Input placeholder="you@example.com" {...field} />
                </FormControl>
              </FormItem>
            )}
          />
          
          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Password</FormLabel>
                <FormControl>
                  <Input type="password" placeholder="Your password" {...field} />
                </FormControl>
              </FormItem>
            )}
          />
          
          <SubmitButton pendingText="Signing up...">
            Sign up
          </SubmitButton>
          {message && <FormMessage message={message} />}
        </div>
      </form>
    </Form>
  );
}
