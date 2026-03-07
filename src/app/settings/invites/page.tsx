'use client';

import { useQuery, useMutation } from 'convex/react';
import { api } from '@/lib/convex';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { Mail } from 'lucide-react';
import { toast } from 'sonner';
import type { Id } from '@/convex/_generated/dataModel';

const header = (
  <div className='border-b'>
    <div className='flex items-center p-1'>
      <span className='flex items-center gap-1.5 px-3 text-xs font-medium'>
        <Mail className='size-3.5' />
        Invitations
      </span>
    </div>
  </div>
);

export default function InvitesPage() {
  const invites = useQuery(api.users.getPendingInvitations);
  const acceptInvite = useMutation(
    api.organizations.mutations.acceptInvitation,
  );
  const declineInvite = useMutation(api.organizations.mutations.revokeInvite);

  const handleAccept = async (inviteId: Id<'invitations'>) => {
    try {
      await acceptInvite({ inviteId });
      toast.success('Invitation accepted');
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  const handleDecline = async (inviteId: Id<'invitations'>) => {
    try {
      await declineInvite({ inviteId });
      toast.info('Invitation declined');
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  if (invites === undefined) {
    return (
      <div className='bg-background h-full'>
        {header}
        <div className='text-muted-foreground p-3 text-sm'>Loading...</div>
      </div>
    );
  }

  return (
    <div className='bg-background h-full'>
      {header}

      {invites.length === 0 ? (
        <div className='text-muted-foreground flex items-center justify-center py-12 text-sm'>
          No pending invitations
        </div>
      ) : (
        <div className='divide-y'>
          {invites.map(inv => (
            <div key={inv._id} className='flex items-center gap-3 px-3 py-2'>
              <div className='min-w-0 flex-1'>
                <p className='truncate text-sm font-medium'>
                  {inv.organization?.name ?? 'Unknown Organization'}
                </p>
                <p className='text-muted-foreground text-xs'>
                  Invited {format(new Date(inv._creationTime), 'MMM d, yyyy')}
                </p>
              </div>

              <Badge variant='outline' className='text-xs capitalize'>
                {inv.role}
              </Badge>

              <div className='text-muted-foreground text-xs'>
                Expires {format(new Date(inv.expiresAt), 'MMM d')}
              </div>

              <div className='flex gap-1'>
                <Button
                  size='sm'
                  className='h-6 text-xs'
                  onClick={() => handleAccept(inv._id)}
                >
                  Accept
                </Button>
                <Button
                  size='sm'
                  variant='ghost'
                  className='h-6 text-xs'
                  onClick={() => handleDecline(inv._id)}
                >
                  Decline
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
