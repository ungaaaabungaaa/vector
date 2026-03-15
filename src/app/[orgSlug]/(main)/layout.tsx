'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { OrgSidebar, OrgOptionsDropdown } from '@/components/organization';
import { OrgAssistantDock } from '@/components/assistant/org-assistant-dock';
import { UserMenu } from '@/components/user-menu';
import { NotificationBell } from '@/components/notifications/notification-bell';
import { Skeleton } from '@/components/ui/skeleton';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { CommandMenu } from '@/components/command-menu';
import { CommandMenuActions } from '@/components/command-menu-actions';
import {
  CheckSquare,
  FolderOpen,
  Users,
  LayoutDashboard,
  Menu,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useQuery } from 'convex/react';
import { api } from '@/lib/convex';
import { useParams, usePathname } from 'next/navigation';
import { Doc } from '@/convex/_generated/dataModel';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SIDEBAR_MIN_WIDTH = 200;
const SIDEBAR_MAX_WIDTH = 480;
const SIDEBAR_DEFAULT_WIDTH = 224; // w-56
const SIDEBAR_STORAGE_KEY = 'vector-sidebar-width';

function getInitialSidebarWidth() {
  if (typeof window === 'undefined') {
    return SIDEBAR_DEFAULT_WIDTH;
  }

  const stored = window.localStorage.getItem(SIDEBAR_STORAGE_KEY);
  if (!stored) {
    return SIDEBAR_DEFAULT_WIDTH;
  }

  const parsed = parseInt(stored, 10);
  if (
    Number.isNaN(parsed) ||
    parsed < SIDEBAR_MIN_WIDTH ||
    parsed > SIDEBAR_MAX_WIDTH
  ) {
    return SIDEBAR_DEFAULT_WIDTH;
  }

  return parsed;
}

// ---------------------------------------------------------------------------
// Contexts
// ---------------------------------------------------------------------------

const MobileNavContext = createContext<(() => void) | null>(null);
const BottomBarPortalContext = createContext<HTMLDivElement | null>(null);

// ---------------------------------------------------------------------------
// Exported helpers for pages
// ---------------------------------------------------------------------------

/** @deprecated Bottom bar replaces the hamburger. Kept for import compat. */
export function MobileNavTrigger(_props: { className?: string }) {
  return null;
}

/** Portal children into the mobile bottom bar actions slot. No-op on desktop. */
export function BottomBarSlot({ children }: { children: ReactNode }) {
  const target = useContext(BottomBarPortalContext);
  if (!target) return null;
  return createPortal(children, target);
}

// ---------------------------------------------------------------------------
// Resizable sidebar hook
// ---------------------------------------------------------------------------

function useResizableSidebar() {
  const [width, setWidth] = useState(getInitialSidebarWidth);
  const [isDragging, setIsDragging] = useState(false);
  const isResizing = useRef(false);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isResizing.current = true;
    setIsDragging(true);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing.current) return;
      const newWidth = Math.min(
        SIDEBAR_MAX_WIDTH,
        Math.max(SIDEBAR_MIN_WIDTH, e.clientX),
      );
      setWidth(newWidth);
    };

    const handleMouseUp = () => {
      isResizing.current = false;
      setIsDragging(false);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, []);

  // Persist to localStorage
  useEffect(() => {
    localStorage.setItem(SIDEBAR_STORAGE_KEY, String(width));
  }, [width]);

  return { width, isDragging, handleMouseDown };
}

// ---------------------------------------------------------------------------
// Bottom nav item
// ---------------------------------------------------------------------------

function BottomNavItem({
  href,
  icon: Icon,
  label,
  isActive,
}: {
  href: string;
  icon: typeof CheckSquare;
  label: string;
  isActive: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        'flex flex-1 flex-col items-center justify-center gap-0.5 py-1.5 text-[10px] font-medium transition-colors',
        isActive ? 'text-foreground' : 'text-muted-foreground',
      )}
    >
      <Icon className='size-5' strokeWidth={isActive ? 2.2 : 1.8} />
      <span>{label}</span>
    </Link>
  );
}

// ---------------------------------------------------------------------------
// Layout
// ---------------------------------------------------------------------------

interface AppLayoutProps {
  children: React.ReactNode;
}

export default function AppLayout({ children }: AppLayoutProps) {
  const params = useParams();
  const pathname = usePathname();
  const orgSlug = params.orgSlug as string;
  const [mobileOpen, setMobileOpen] = useState(false);
  const [portalTarget, setPortalTarget] = useState<HTMLDivElement | null>(null);
  const {
    width: sidebarWidth,
    isDragging,
    handleMouseDown,
  } = useResizableSidebar();

  // Fetch current user and organization data
  const user = useQuery(api.users.currentUser);
  const organization = useQuery(api.organizations.queries.getBySlug, {
    orgSlug,
  });
  const userOrganizations = useQuery(api.users.getOrganizations);

  // Route matching for bottom bar active state
  const isActive = (path: string) =>
    pathname === path || pathname.startsWith(path + '/');

  // Redirect unauthenticated users to login with return URL
  useEffect(() => {
    if (user === null) {
      window.location.href = `/auth/login?redirectTo=${encodeURIComponent(pathname)}`;
    }
  }, [user, pathname]);

  // Don't render until we have the data
  if (user === undefined || user === null || organization === undefined) {
    return (
      <div className='bg-secondary flex h-screen'>
        <aside
          className='relative hidden lg:block'
          style={{ width: sidebarWidth }}
        >
          <div className='flex h-full flex-col'>
            <div className='p-2'>
              <div className='bg-background flex w-full items-center justify-between rounded-md border p-1'>
                <div className='flex min-w-0 flex-1 items-center gap-2'>
                  <Skeleton className='size-5 shrink-0 rounded' />
                  <Skeleton className='h-4 w-24' />
                </div>
              </div>
            </div>
            <div className='flex-1 overflow-y-auto'>
              <div className='space-y-4 p-2 pt-0'>
                <div className='space-y-1'>
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div
                      key={i}
                      className='flex h-8 items-center gap-2 rounded-md px-2 py-1'
                    >
                      <Skeleton className='size-4 rounded' />
                      <Skeleton
                        className='h-4'
                        style={{ width: `${60 + (i % 3) * 20}px` }}
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className='border-border border-t p-2'>
              <div className='flex w-full justify-start gap-2 p-2'>
                <Skeleton className='size-8 rounded-full' />
                <div className='flex flex-col items-start gap-1'>
                  <Skeleton className='h-3.5 w-20' />
                  <Skeleton className='h-3 w-28' />
                </div>
              </div>
            </div>
          </div>
        </aside>
        <main className='bg-background mx-2 mt-2 mb-32 flex-1 overflow-y-auto rounded-md border pb-24 lg:mb-2 lg:ml-0 lg:pb-28'>
          {children}
        </main>
      </div>
    );
  }

  const organizations =
    userOrganizations?.filter(
      (org): org is Doc<'organizations'> => org !== null,
    ) || [];

  return (
    <MobileNavContext.Provider value={() => setMobileOpen(true)}>
      <BottomBarPortalContext.Provider value={portalTarget}>
        <div className='bg-secondary flex h-screen'>
          {/* Desktop sidebar */}
          <aside
            className='relative hidden lg:block'
            style={{ width: sidebarWidth }}
          >
            <div className='flex h-full flex-col'>
              <div className='p-2'>
                <OrgOptionsDropdown
                  currentOrgSlug={orgSlug}
                  currentOrgName={organization?.name ?? 'Organization'}
                  currentOrgLogo={organization?.logo}
                  organizations={organizations}
                />
              </div>
              <div className='min-h-0 flex-1 overflow-y-auto'>
                <OrgSidebar orgSlug={orgSlug} />
              </div>
              {/* Assistant dock */}
              <OrgAssistantDock orgSlug={orgSlug} />
              {/* User footer */}
              <div className='border-border flex items-center gap-1 border-t p-2'>
                <div className='min-w-0 flex-1'>
                  <UserMenu />
                </div>
                <NotificationBell />
              </div>
            </div>
            {/* Resize handle */}
            <div
              onMouseDown={handleMouseDown}
              className='group absolute top-0 -right-0.5 bottom-0 z-30 flex w-1.5 cursor-col-resize items-center justify-center'
            >
              <div
                className={cn(
                  'h-full w-px transition-colors',
                  isDragging
                    ? 'bg-foreground/30'
                    : 'group-hover:bg-foreground/15 bg-transparent',
                )}
              />
            </div>
          </aside>

          {/* Mobile sheet (opened from "More" in bottom bar) */}
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetContent
              side='left'
              showCloseButton={false}
              className='bg-secondary w-56 p-0 sm:max-w-56'
            >
              <SheetTitle className='sr-only'>Navigation</SheetTitle>
              <div className='flex h-full flex-col'>
                <div className='p-2'>
                  <OrgOptionsDropdown
                    currentOrgSlug={orgSlug}
                    currentOrgName={organization?.name ?? 'Organization'}
                    currentOrgLogo={organization?.logo}
                    organizations={organizations}
                  />
                </div>
                <div className='flex-1 overflow-y-auto'>
                  <OrgSidebar
                    orgSlug={orgSlug}
                    onNavigate={() => setMobileOpen(false)}
                  />
                </div>
                {/* Assistant dock in mobile sheet */}
                <OrgAssistantDock orgSlug={orgSlug} />
                <div className='border-border flex items-center gap-1 border-t p-2'>
                  <div className='min-w-0 flex-1'>
                    <UserMenu />
                  </div>
                  <NotificationBell />
                </div>
              </div>
            </SheetContent>
          </Sheet>

          {/* Main content */}
          <main className='bg-background mx-2 mt-2 mb-32 flex-1 overflow-y-auto rounded-md border pb-24 lg:mb-2 lg:ml-0 lg:pb-2'>
            {children}
          </main>

          {/* Command menu (⌘K) */}
          <CommandMenu />
          <CommandMenuActions />

          {/* Mobile bottom bar */}
          <div className='bg-background/80 fixed right-0 bottom-0 left-0 z-50 border-t backdrop-blur-lg lg:hidden'>
            {/* Page actions slot */}
            <div ref={setPortalTarget} />
            {/* Nav */}
            <nav className='flex h-12 items-stretch pb-[env(safe-area-inset-bottom)]'>
              <BottomNavItem
                href={`/${orgSlug}/issues`}
                icon={CheckSquare}
                label='Issues'
                isActive={isActive(`/${orgSlug}/issues`)}
              />
              <BottomNavItem
                href={`/${orgSlug}/projects`}
                icon={FolderOpen}
                label='Projects'
                isActive={isActive(`/${orgSlug}/projects`)}
              />
              <BottomNavItem
                href={`/${orgSlug}/teams`}
                icon={Users}
                label='Teams'
                isActive={isActive(`/${orgSlug}/teams`)}
              />
              <BottomNavItem
                href={`/${orgSlug}/dashboard`}
                icon={LayoutDashboard}
                label='Dashboard'
                isActive={isActive(`/${orgSlug}/dashboard`)}
              />
              <button
                onClick={() => setMobileOpen(true)}
                className='text-muted-foreground flex flex-1 flex-col items-center justify-center gap-0.5 py-1.5 text-[10px] font-medium transition-colors'
              >
                <Menu className='size-5' strokeWidth={1.8} />
                <span>More</span>
              </button>
            </nav>
          </div>
        </div>
      </BottomBarPortalContext.Provider>
    </MobileNavContext.Provider>
  );
}
