'use client';

import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { z } from "zod"

import { Button } from "@/components/ui/button"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { toast, Toaster } from "sonner"

const formSchema = z.object({
    email: z.string().min(2, {
        message: "Username must be at least 2 characters."
    })
    .email({
        message: "Username must be a valid email address."
    }),
    password: z.string().min(8, {
        message: "Password must be at least 8 characters."
    })
});

const RegisterPage = () => {
    // form definition
    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            email: "",
            password: "",
        },
    });
    
    // submit handler definition
    const onSubmit = async (values: z.infer<typeof formSchema>) => {

        try {
            const res = await fetch("/api/auth/register", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    email: values.email,
                    password: values.password,
                })
            });

            const resData = await res.json();

            // Throw an error if the response is not ok
            if (!res.ok) {
                throw new Error(`${res.status}, ${resData.error}`);
            }

            // Show a toast notification if the registration is successful
            toast("Success", {
                description: "Registered successfully"
            });

            console.log(resData);

        } catch (error) {

            // Show a toast notification if the registration fails
            toast("Registration failed", {
                description: error instanceof Error ? error.message : "Something went wrong. Please try again.",
            });

            console.log(error);
        }
    };

    return (
        <div className="flex items-center justify-center h-full">
            <div className="flex flex-col justify-center h-full gap-6">
                <h1 className="text-3xl font-bold">Create your Account</h1>

                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 w-80">
                        <FormField
                            control={form.control}
                            name="email"
                            render={({ field }) => (
                                <FormItem>
                                    <FormControl>
                                        <Input placeholder="Email" {...field} />
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
                                    <FormControl>
                                        <Input type="password" placeholder="Password" {...field} />
                                    </FormControl>
    
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <Button type="submit">Register</Button>
                    </form>
                </Form>
            </div>

            <Toaster />
        </div>
    );
};

export default RegisterPage;