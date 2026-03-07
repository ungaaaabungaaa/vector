'use client';

import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Loader2 } from 'lucide-react';
import Link from 'next/link';
import { extractAuthErrorMessage } from '@/lib/auth-error-handler';
import { authClient } from '@/lib/auth-client';
import { toast } from 'sonner';

const signInSchema = z.object({
  identifier: z.string().min(1, 'Email or username is required'),
  password: z.string().min(1, 'Password is required'),
});

type SignInFormType = z.infer<typeof signInSchema>;

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get('redirectTo') || '/';

  const [isLoading, setIsLoading] = useState(false);

  const form = useForm<SignInFormType>({
    resolver: zodResolver(signInSchema),
    defaultValues: { identifier: '', password: '' },
  });

  const handleSubmit = async (values: SignInFormType) => {
    setIsLoading(true);

    try {
      const isEmail = values.identifier.includes('@');
      const result = isEmail
        ? await authClient.signIn.email({
            email: values.identifier,
            password: values.password,
          })
        : await authClient.signIn.username({
            username: values.identifier,
            password: values.password,
          });

      if (result.error) {
        throw result.error;
      }

      router.push(
        `/auth/signing-in?redirectTo=${encodeURIComponent(redirectTo)}`,
      );
    } catch (error) {
      const message = extractAuthErrorMessage(error);
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className='flex min-h-dvh items-center justify-center px-4'>
      <div className='w-full max-w-sm'>
        <div className='mb-6 text-center'>
          <h2 className='text-2xl font-semibold tracking-tight'>
            Welcome back
          </h2>
          <p className='text-muted-foreground mt-1 text-sm'>
            Sign in to Vector
          </p>
        </div>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(handleSubmit)}
            className='space-y-3'
          >
            <FormField
              control={form.control}
              name='identifier'
              render={({ field }) => (
                <FormItem>
                  <FormLabel className='sr-only'>Email or Username</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      type='text'
                      placeholder='Email or username'
                      autoComplete='email'
                      disabled={isLoading}
                      autoFocus
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name='password'
              render={({ field }) => (
                <FormItem>
                  <FormLabel className='sr-only'>Password</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      type='password'
                      placeholder='Password'
                      autoComplete='current-password'
                      disabled={isLoading}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button type='submit' className='w-full' disabled={isLoading}>
              {isLoading ? (
                <span className='flex items-center gap-2'>
                  <Loader2 className='h-4 w-4 animate-spin' />
                  Signing in...
                </span>
              ) : (
                'Sign in'
              )}
            </Button>

            <p className='text-muted-foreground mt-4 text-center text-sm'>
              Don&apos;t have an account?{' '}
              <Link
                href='/auth/signup'
                className='text-foreground font-medium hover:underline'
              >
                Sign up
              </Link>
            </p>
          </form>
        </Form>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className='flex min-h-dvh flex-col items-center justify-center gap-2'>
          <Loader2 className='text-muted-foreground h-5 w-5 animate-spin' />
          <span className='text-muted-foreground text-sm'>Loading...</span>
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
