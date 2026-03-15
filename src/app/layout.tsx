import type { Metadata } from 'next';
import { Urbanist, Poppins, Geist } from 'next/font/google';
import './globals.css';
import { TopLoaderProvider } from '@/providers/top-loader-provider';
import { ConvexAuthProvider } from '@/providers/convex-auth-provider';
import { ErrorBoundary } from '@/components/ui/error-boundary';
import { Toaster } from '@/components/ui/sonner';
import { NotificationClientBootstrap } from '@/components/notifications/notification-client-bootstrap';
import { BrandingHead } from '@/components/branding-head';
import { getToken } from '@/lib/auth-server';
import { cn } from '@/lib/utils';
import { ThemeProvider } from '@/components/theme-provider';

const geist = Geist({ subsets: ['latin'], variable: '--font-sans' });

const urbanist = Urbanist({
  variable: '--font-title',
  subsets: ['latin'],
});

const poppins = Poppins({
  variable: '--font-body',
  subsets: ['latin'],
  weight: ['400'],
});

export const metadata: Metadata = {
  title: 'Vector',
  description: 'Project management platform',
  manifest: '/manifest.webmanifest',
};

async function getInitialToken() {
  try {
    return await getToken();
  } catch (error) {
    console.error('Failed to load auth token during app bootstrap.', error);
    return null;
  }
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang='en'
      className={cn('font-sans', geist.variable)}
      suppressHydrationWarning
    >
      <body className={`${urbanist.variable} ${poppins.variable} antialiased`}>
        <ThemeProvider
          attribute='class'
          defaultTheme='light'
          disableTransitionOnChange
        >
          <TopLoaderProvider />
          <ErrorBoundary>
            <ConvexAuthProvider initialToken={await getInitialToken()}>
              <NotificationClientBootstrap />
              <BrandingHead />
              {children}
              <Toaster />
            </ConvexAuthProvider>
          </ErrorBoundary>
        </ThemeProvider>
      </body>
    </html>
  );
}
