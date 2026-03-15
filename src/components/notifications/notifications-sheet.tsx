'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMutation, usePaginatedQuery } from 'convex/react';
import { formatDistanceToNow } from 'date-fns';
import {
  Bell,
  CheckCheck,
  ChevronRight,
  Mail,
  MessageSquare,
  UserPlus,
} from 'lucide-react';
import { api } from '@/lib/convex';
import { cn } from '@/lib/utils';
import { UserAvatar } from '@/components/user-avatar';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

function getNotificationIcon(category: string) {
  switch (category) {
    case 'mentions':
      return MessageSquare;
    case 'assignments':
      return UserPlus;
    case 'invites':
      return Mail;
    default:
      return Bell;
  }
}

export function NotificationsSheet({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [filter, setFilter] = useState<'all' | 'unread'>('unread');
  const { results, status, loadMore } = usePaginatedQuery(
    api.notifications.queries.listInbox,
    { filter },
    { initialNumItems: 12 },
  );
  const markRead = useMutation(api.notifications.mutations.markRead);
  const markAllRead = useMutation(api.notifications.mutations.markAllRead);

  const handleOpen = async (recipient: (typeof results)[number]) => {
    if (!recipient.isRead) {
      await markRead({ recipientId: recipient._id });
    }

    onOpenChange(false);
    router.push(recipient.href ?? '/settings/notifications');
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side='right'
        className='w-full gap-0 p-0 sm:max-w-md'
        showCloseButton={false}
      >
        <SheetTitle className='sr-only'>Notifications</SheetTitle>
        <div className='border-b p-3'>
          <div className='flex items-center justify-between gap-2'>
            <div className='min-w-0'>
              <p className='text-sm font-medium'>Notifications</p>
              <p className='text-muted-foreground text-xs'>
                Actionable updates across your work.
              </p>
            </div>
            <div className='flex items-center gap-1'>
              <Button
                variant='ghost'
                size='sm'
                className='h-7'
                onClick={() => void markAllRead({})}
              >
                <CheckCheck className='size-3.5' />
                Mark all read
              </Button>
              <Link href='/settings/notifications'>
                <Button variant='outline' size='sm' className='h-7'>
                  Settings
                </Button>
              </Link>
            </div>
          </div>

          <Tabs
            value={filter}
            onValueChange={value => setFilter(value as 'all' | 'unread')}
            className='mt-3 gap-0'
          >
            <TabsList variant='line'>
              <TabsTrigger value='unread' className='text-xs'>
                Unread
              </TabsTrigger>
              <TabsTrigger value='all' className='text-xs'>
                All
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        <div className='flex-1 overflow-y-auto'>
          {status === 'LoadingFirstPage' ? (
            <div className='divide-y'>
              {Array.from({ length: 6 }).map((_, index) => (
                <div key={index} className='flex items-start gap-3 px-3 py-2.5'>
                  <Skeleton className='size-8 rounded-full' />
                  <div className='min-w-0 flex-1 space-y-1'>
                    <Skeleton className='h-4 w-40' />
                    <Skeleton className='h-3 w-full max-w-72' />
                    <Skeleton className='h-3 w-24' />
                  </div>
                </div>
              ))}
            </div>
          ) : results.length === 0 ? (
            <div className='text-muted-foreground flex h-full items-center justify-center px-6 text-sm'>
              {filter === 'unread'
                ? 'No unread notifications.'
                : 'No notifications yet.'}
            </div>
          ) : (
            <div className='divide-y'>
              {results.map(recipient => {
                const Icon = getNotificationIcon(recipient.category);
                return (
                  <button
                    key={recipient._id}
                    type='button'
                    className={cn(
                      'hover:bg-muted/40 flex w-full items-start gap-3 px-3 py-2.5 text-left transition-colors',
                      !recipient.isRead && 'bg-primary/3',
                    )}
                    onClick={() => void handleOpen(recipient)}
                  >
                    <div className='relative flex-shrink-0'>
                      <UserAvatar
                        name={recipient.actorName}
                        image={recipient.actorImage}
                        size='default'
                      />
                      <div className='bg-background absolute -right-1 -bottom-1 rounded-full border p-0.5'>
                        <Icon className='text-muted-foreground size-3' />
                      </div>
                    </div>
                    <div className='min-w-0 flex-1'>
                      <div className='flex items-start gap-2'>
                        <p
                          className={cn(
                            'line-clamp-1 min-w-0 flex-1 text-sm',
                            !recipient.isRead && 'font-medium',
                          )}
                        >
                          {recipient.title}
                        </p>
                        {!recipient.isRead ? (
                          <span className='bg-primary mt-1 size-1.5 rounded-full' />
                        ) : null}
                      </div>
                      <p className='text-muted-foreground mt-0.5 line-clamp-2 text-xs leading-5'>
                        {recipient.body}
                      </p>
                      <p className='text-muted-foreground mt-1 text-[11px]'>
                        {formatDistanceToNow(new Date(recipient.createdAt), {
                          addSuffix: true,
                        })}
                      </p>
                    </div>
                    <ChevronRight className='text-muted-foreground mt-1 size-3.5 flex-shrink-0' />
                  </button>
                );
              })}

              {status === 'CanLoadMore' ? (
                <div className='p-3'>
                  <Button
                    variant='outline'
                    size='sm'
                    className='w-full'
                    onClick={() => loadMore(12)}
                  >
                    Load more
                  </Button>
                </div>
              ) : null}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
