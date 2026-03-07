'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, ShieldCheck } from 'lucide-react';
import { extractAuthErrorMessage } from '@/lib/auth-error-handler';
import Link from 'next/link';
import { useAction } from 'convex/react';
import { api } from '@/lib/convex';

export const dynamic = 'force-dynamic';

const setupAdminSchema = z
  .object({
    name: z.string().min(1, 'Name is required'),
    email: z.string().email('Please enter a valid email address'),
    username: z.string().min(3, 'Username must be at least 3 characters'),
    password: z.string().min(8, 'Password must be at least 8 characters'),
    confirmPassword: z.string().min(1, 'Please confirm your password'),
  })
  .refine(data => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ['confirmPassword'],
  });

type SetupAdminForm = z.infer<typeof setupAdminSchema>;

export default function SetupAdminPage() {
  const router = useRouter();
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm<SetupAdminForm>({
    resolver: zodResolver(setupAdminSchema),
    defaultValues: {
      name: 'Admin User',
      email: 'admin@example.com',
      username: 'admin',
      password: '',
      confirmPassword: '',
    },
  });

  const bootstrapMutation = useAction(api.users.bootstrapAdmin);

  const onSubmit = async (values: SetupAdminForm) => {
    setGlobalError(null);
    setIsLoading(true);

    try {
      await bootstrapMutation({
        name: values.name,
        email: values.email,
        username: values.username,
        password: values.password,
      });

      router.push(
        '/auth/login?message=Admin account created successfully. Please sign in.',
      );
    } catch (error) {
      setGlobalError(extractAuthErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className='flex min-h-screen items-center justify-center px-4'>
      <div className='w-full max-w-sm space-y-6'>
        {globalError && (
          <Alert variant='destructive'>
            <AlertCircle className='h-4 w-4' />
            <AlertDescription>{globalError}</AlertDescription>
          </Alert>
        )}

        <Card className='border shadow-sm'>
          <CardHeader className='space-y-1 pb-4'>
            <div className='flex items-center gap-2'>
              <ShieldCheck className='h-4 w-4 text-emerald-600' />
              <CardTitle className='text-lg'>Initial Admin Setup</CardTitle>
            </div>
            <CardDescription className='text-sm'>
              Create the first administrator account to configure Vector.
            </CardDescription>
          </CardHeader>
          <CardContent className='space-y-4'>
            <Form {...form}>
              <form
                onSubmit={form.handleSubmit(onSubmit)}
                className='space-y-5'
              >
                <FormField
                  control={form.control}
                  name='name'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className='text-sm font-medium'>
                        Full Name
                      </FormLabel>
                      <FormControl>
                        <Input
                          placeholder='Enter your full name'
                          className='h-11 text-base'
                          disabled={isLoading}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name='email'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className='text-sm font-medium'>
                        Email Address
                      </FormLabel>
                      <FormControl>
                        <Input
                          type='email'
                          placeholder='name@example.com'
                          className='h-11 text-base'
                          disabled={isLoading}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name='username'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className='text-sm font-medium'>
                        Username
                      </FormLabel>
                      <FormControl>
                        <Input
                          placeholder='Choose a unique username'
                          className='h-11 text-base'
                          disabled={isLoading}
                          {...field}
                        />
                      </FormControl>
                      <FormDescription className='text-muted-foreground text-sm'>
                        This will be your login username
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name='password'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className='text-sm font-medium'>
                        Password
                      </FormLabel>
                      <FormControl>
                        <Input
                          type='password'
                          placeholder='Create a strong password'
                          className='h-11 text-base'
                          disabled={isLoading}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name='confirmPassword'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className='text-sm font-medium'>
                        Confirm Password
                      </FormLabel>
                      <FormControl>
                        <Input
                          type='password'
                          placeholder='Confirm your password'
                          className='h-11 text-base'
                          disabled={isLoading}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button
                  type='submit'
                  className='h-11 w-full'
                  disabled={isLoading}
                >
                  {isLoading
                    ? 'Creating Admin Account...'
                    : 'Create Admin Account'}
                </Button>
              </form>
            </Form>

            <p className='text-muted-foreground text-center text-sm'>
              Already have an account?{' '}
              <Link href='/auth/login' className='text-primary hover:underline'>
                Sign in
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
