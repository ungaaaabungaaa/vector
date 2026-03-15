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
import { Skeleton } from '@/components/ui/skeleton';
import Link from 'next/link';
import { extractAuthErrorMessage } from '@/lib/auth-error-handler';
import { authClient } from '@/lib/auth-client';
import { toast } from 'sonner';
import { useBranding } from '@/hooks/use-branding';
import {
  DEFAULT_BRANDING,
  getContrastingTextColor,
  resolveBrandColor,
} from '@/lib/branding';

export const dynamic = 'force-dynamic';

const signUpSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  username: z
    .string()
    .min(3, 'Username must be at least 3 characters')
    .max(20, 'Username must be 20 characters or fewer')
    .regex(
      /^[a-zA-Z0-9_-]+$/,
      'Only letters, numbers, hyphens, and underscores',
    ),
  password: z
    .string()
    .min(6, 'Password must be at least 6 characters')
    .max(128, 'Password must be 128 characters or fewer'),
});

type SignUpFormType = z.infer<typeof signUpSchema>;

function SignupForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get('redirectTo') || '/';
  const branding = useBranding();
  const accentColor = resolveBrandColor(
    branding.accentColor,
    DEFAULT_BRANDING.accentColor,
  );
  const accentTextColor = getContrastingTextColor(accentColor);

  const [isLoading, setIsLoading] = useState(false);

  const form = useForm<SignUpFormType>({
    resolver: zodResolver(signUpSchema),
    defaultValues: { email: '', username: '', password: '' },
  });

  const handleSubmit = async (values: SignUpFormType) => {
    setIsLoading(true);

    try {
      const normalizedEmail = values.email.trim().toLowerCase();

      const result = await authClient.signUp.email({
        email: normalizedEmail,
        password: values.password,
        name: values.username,
        username: values.username,
      });

      if (result.error) {
        throw result.error;
      }

      toast.success('Account created!');
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
          {branding.logoUrl && (
            <img
              src={branding.logoUrl}
              alt={branding.name}
              className='mx-auto mb-4 size-12 rounded-xl object-contain'
            />
          )}
          <h2 className='text-2xl font-semibold tracking-tight'>
            Create your account
          </h2>
          <p className='text-muted-foreground mt-1 text-sm'>
            Get started with {branding.name}
          </p>
        </div>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(handleSubmit)}
            className='space-y-3'
            noValidate
          >
            <FormField
              control={form.control}
              name='email'
              render={({ field }) => (
                <FormItem>
                  <FormLabel className='sr-only'>Email</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      type='email'
                      placeholder='Email address'
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
              name='username'
              render={({ field }) => (
                <FormItem>
                  <FormLabel className='sr-only'>Username</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      type='text'
                      placeholder='Username'
                      autoComplete='username'
                      disabled={isLoading}
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
                      placeholder='Password (min 6 characters)'
                      autoComplete='new-password'
                      disabled={isLoading}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button
              type='submit'
              className='w-full transition-opacity hover:opacity-90'
              disabled={isLoading}
              style={{
                backgroundColor: accentColor,
                color: accentTextColor,
              }}
            >
              {isLoading ? (
                <span className='flex items-center gap-2'>
                  <Loader2 className='h-4 w-4 animate-spin' />
                  Creating account...
                </span>
              ) : (
                'Create account'
              )}
            </Button>

            <p className='text-muted-foreground mt-4 text-center text-sm'>
              Already have an account?{' '}
              <Link
                href='/auth/login'
                className='text-foreground font-medium hover:underline'
              >
                Sign in
              </Link>
            </p>
          </form>
        </Form>
      </div>
    </div>
  );
}

export default function SignupPage() {
  return (
    <Suspense
      fallback={
        <div className='flex min-h-dvh items-center justify-center px-4'>
          <div className='w-full max-w-sm space-y-6'>
            <div className='flex flex-col items-center gap-2'>
              <Skeleton className='h-7 w-48' />
              <Skeleton className='h-4 w-36' />
            </div>
            <div className='space-y-3'>
              <Skeleton className='h-10 w-full rounded-md' />
              <Skeleton className='h-10 w-full rounded-md' />
              <Skeleton className='h-10 w-full rounded-md' />
              <Skeleton className='h-10 w-full rounded-md' />
            </div>
            <Skeleton className='mx-auto h-4 w-48' />
          </div>
        </div>
      }
    >
      <SignupForm />
    </Suspense>
  );
}
