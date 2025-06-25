"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { trpc } from "@/lib/trpc";

const setupAdminSchema = z
  .object({
    name: z.string().min(1, "Name is required"),
    email: z.string().email("Please enter a valid email address"),
    username: z.string().min(3, "Username must be at least 3 characters"),
    password: z.string().min(8, "Password must be at least 8 characters"),
    confirmPassword: z.string().min(1, "Please confirm your password"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  });

type SetupAdminForm = z.infer<typeof setupAdminSchema>;

export default function SetupAdminPage() {
  const router = useRouter();
  const [globalError, setGlobalError] = useState<string | null>(null);

  const form = useForm<SetupAdminForm>({
    resolver: zodResolver(setupAdminSchema),
    defaultValues: {
      name: "Admin User",
      email: "admin@example.com",
      username: "admin",
      password: "",
      confirmPassword: "",
    },
  });

  const bootstrapMutation = trpc.user.bootstrapAdmin.useMutation({
    onSuccess: () => {
      router.push(
        "/auth/login?message=Admin account created successfully. Please sign in.",
      );
    },
    onError: (error) => {
      setGlobalError(error.message);
    },
  });

  const onSubmit = async (values: SetupAdminForm) => {
    setGlobalError(null);
    await bootstrapMutation.mutateAsync({
      name: values.name,
      email: values.email,
      username: values.username,
      password: values.password,
    });
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 via-white to-slate-100 p-6 lg:p-12 dark:from-slate-950 dark:via-slate-900 dark:to-slate-800">
      <div className="w-full max-w-md space-y-8">
        {globalError && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{globalError}</AlertDescription>
          </Alert>
        )}

        <Card className="border-0 bg-white/90 shadow-xl backdrop-blur-sm dark:bg-slate-900/90">
          <CardHeader className="space-y-3 pb-6">
            <div className="flex items-center space-x-2">
              <ShieldCheck className="h-5 w-5 text-emerald-600" />
              <CardTitle className="text-xl">Initial Admin Setup</CardTitle>
            </div>
            <CardDescription className="text-base">
              Create the first administrator account to configure AIKP.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <Form {...form}>
              <form
                onSubmit={form.handleSubmit(onSubmit)}
                className="space-y-5"
              >
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-medium">
                        Full Name
                      </FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Enter your full name"
                          className="h-11 text-base"
                          disabled={bootstrapMutation.isPending}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-medium">
                        Email Address
                      </FormLabel>
                      <FormControl>
                        <Input
                          type="email"
                          placeholder="name@example.com"
                          className="h-11 text-base"
                          disabled={bootstrapMutation.isPending}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="username"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-medium">
                        Username
                      </FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Choose a unique username"
                          className="h-11 text-base"
                          disabled={bootstrapMutation.isPending}
                          {...field}
                        />
                      </FormControl>
                      <FormDescription className="text-muted-foreground text-sm">
                        This will be your login username
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-medium">
                        Password
                      </FormLabel>
                      <FormControl>
                        <Input
                          type="password"
                          placeholder="Create a strong password"
                          className="h-11 text-base"
                          disabled={bootstrapMutation.isPending}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="confirmPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-medium">
                        Confirm Password
                      </FormLabel>
                      <FormControl>
                        <Input
                          type="password"
                          placeholder="Confirm your password"
                          className="h-11 text-base"
                          disabled={bootstrapMutation.isPending}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button
                  type="submit"
                  className="h-11 w-full"
                  disabled={bootstrapMutation.isPending}
                >
                  {bootstrapMutation.isPending
                    ? "Creating Admin Account..."
                    : "Create Admin Account"}
                </Button>
              </form>
            </Form>

            <p className="text-muted-foreground text-center text-sm">
              Already have an account?{" "}
              <Link href="/auth/login" className="text-primary hover:underline">
                Sign in
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
