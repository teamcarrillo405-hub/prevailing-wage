import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Layout } from '../components/shared/Layout';
import { PageHeader } from '../components/ui/PageHeader';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';

interface Member {
  id: string;
  email: string;
  role: 'owner' | 'member';
  joinedAt: string;
}

interface PendingInvite {
  id: string;
  email: string;
  expiresAt: string;
}

interface TeamData {
  members: Member[];
  pendingInvite: PendingInvite | null;
  isOwner: boolean;
}

export function TeamPage() {
  const queryClient = useQueryClient();
  const [confirmAction, setConfirmAction] = useState<{
    type: 'remove' | 'transfer';
    userId: string;
    email: string;
  } | null>(null);
  const [inviteEmail, setInviteEmail] = useState('');
  const [error, setError] = useState<string | null>(null);

  const { data, isLoading } = useQuery<TeamData>({
    queryKey: ['team'],
    queryFn: () =>
      fetch('/api/team', { credentials: 'include' })
        .then((r) => r.json())
        .then((d) => d.data),
  });

  const sendInviteMutation = useMutation({
    mutationFn: async (email: string) => {
      const res = await fetch('/api/team/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw err;
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team'] });
      setInviteEmail('');
      setError(null);
    },
    onError: (err: any) => {
      setError(err.error || 'Could not send invite. Try again.');
    },
  });

  const revokeInviteMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/team/invite', {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!res.ok) throw await res.json();
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team'] });
    },
  });

  const removeMemberMutation = useMutation({
    mutationFn: async (userId: string) => {
      const res = await fetch(`/api/team/members/${userId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!res.ok) throw await res.json();
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team'] });
      setConfirmAction(null);
    },
    onError: (err: any) => {
      setError(err.error || 'Could not remove member. Try again.');
    },
  });

  const transferMutation = useMutation({
    mutationFn: async (targetUserId: string) => {
      const res = await fetch('/api/team/transfer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ targetUserId }),
      });
      if (!res.ok) throw await res.json();
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team'] });
      setConfirmAction(null);
    },
    onError: (err: any) => {
      setError(err.error || 'Could not transfer ownership. Try again.');
    },
  });

  const atCapacity = (data?.members.length ?? 0) >= 2;

  if (isLoading) {
    return (
      <Layout>
        <div className="text-center py-16 text-gray-500">Loading...</div>
      </Layout>
    );
  }

  return (
    <Layout>
      <PageHeader title="Team" subtitle="Manage team members and invitations" />

      {/* Members Card */}
      <Card padding="default" className="mb-8">
        <h2 className="font-headline text-lg mb-4">Members</h2>
        {data?.members.map((member) =>
          confirmAction?.userId === member.id ? (
            /* Inline confirm row */
            <div
              key={member.id}
              className="flex items-center justify-between py-3 border-b border-gray-200 bg-gray-50 px-3 rounded"
            >
              <p className="text-sm">
                {confirmAction.type === 'remove' ? (
                  <>Remove {member.email} from the team?</>
                ) : (
                  <>
                    Transfer ownership to {member.email}?{' '}
                    <span className="text-red-600">You will become a Member.</span>
                  </>
                )}
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant={confirmAction.type === 'remove' ? 'ghost' : 'primary'}
                  size="sm"
                  className={
                    confirmAction.type === 'remove'
                      ? 'bg-red-600 text-white hover:bg-red-700 border-transparent'
                      : undefined
                  }
                  onClick={() => {
                    if (confirmAction.type === 'remove') {
                      removeMemberMutation.mutate(member.id);
                    } else {
                      transferMutation.mutate(member.id);
                    }
                  }}
                  disabled={removeMemberMutation.isPending || transferMutation.isPending}
                >
                  {confirmAction.type === 'remove'
                    ? removeMemberMutation.isPending
                      ? 'Removing...'
                      : 'Yes, Remove'
                    : transferMutation.isPending
                      ? 'Transferring...'
                      : 'Yes, Transfer'}
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setConfirmAction(null)}>
                  {confirmAction.type === 'remove' ? 'Keep Member' : 'Keep Ownership'}
                </Button>
              </div>
            </div>
          ) : (
            /* Normal member row */
            <div
              key={member.id}
              className="flex items-center justify-between py-3 border-b border-gray-200 last:border-b-0"
            >
              <div>
                <p className="text-sm font-medium text-gray-900">{member.email}</p>
                <p className="text-xs text-gray-500">
                  Joined {new Date(member.joinedAt).toLocaleDateString()}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <Badge variant={member.role === 'owner' ? 'compliant' : 'neutral'}>
                  {member.role === 'owner' ? 'Owner' : 'Member'}
                </Badge>
                {/* Show action buttons only for owner viewing a non-self member */}
                {data?.isOwner && member.role !== 'owner' && (
                  <>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        setConfirmAction({
                          type: 'transfer',
                          userId: member.id,
                          email: member.email,
                        })
                      }
                    >
                      Transfer Ownership
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-red-600 hover:text-red-800"
                      onClick={() =>
                        setConfirmAction({
                          type: 'remove',
                          userId: member.id,
                          email: member.email,
                        })
                      }
                      aria-label={`Remove ${member.email} from team`}
                    >
                      Remove
                    </Button>
                  </>
                )}
              </div>
            </div>
          )
        )}
      </Card>

      {/* Invite Card */}
      <Card padding="default">
        <h2 className="font-headline text-lg mb-4">Invite a Team Member</h2>
        {/* Pending invite row */}
        {data?.pendingInvite && (
          <div className="flex items-center justify-between p-3 bg-gray-50 rounded border border-gray-200 mb-4">
            <div>
              <p className="text-sm font-medium">Invite pending</p>
              <p className="text-xs text-gray-500">
                {data.pendingInvite.email} &mdash; expires{' '}
                {new Date(data.pendingInvite.expiresAt).toLocaleString()}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Badge variant="warning">Pending</Badge>
              {data?.isOwner && (
                <button
                  className="text-sm text-red-600 underline hover:text-red-800"
                  onClick={() => revokeInviteMutation.mutate()}
                  disabled={revokeInviteMutation.isPending}
                >
                  {revokeInviteMutation.isPending ? 'Revoking...' : 'Revoke'}
                </button>
              )}
            </div>
          </div>
        )}
        {/* Invite form (owner only) */}
        {data?.isOwner && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              sendInviteMutation.mutate(inviteEmail);
            }}
            className="space-y-3"
          >
            <input
              type="email"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="colleague@company.com"
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:ring-2 focus:ring-brand-gold focus:outline-none"
              disabled={atCapacity || !!data?.pendingInvite}
            />
            <Button
              variant="primary"
              type="submit"
              className="w-full"
              disabled={
                atCapacity ||
                !!data?.pendingInvite ||
                sendInviteMutation.isPending ||
                !inviteEmail
              }
              title={
                atCapacity
                  ? 'Team is at capacity (2 members maximum)'
                  : data?.pendingInvite
                    ? 'An invite is already pending'
                    : undefined
              }
            >
              {sendInviteMutation.isPending ? 'Sending...' : 'Send Invite'}
            </Button>
            {atCapacity && (
              <p className="text-xs text-gray-500 mt-2">
                Team is at capacity (2 members maximum).
              </p>
            )}
            {!atCapacity && data?.pendingInvite && (
              <p className="text-xs text-gray-500 mt-2">
                An invite is already pending. Revoke it to send a new one.
              </p>
            )}
            {error && (
              <div className="bg-red-50 border border-red-200 rounded px-3 py-2 text-sm text-red-700">
                {error}
              </div>
            )}
          </form>
        )}
      </Card>
    </Layout>
  );
}
