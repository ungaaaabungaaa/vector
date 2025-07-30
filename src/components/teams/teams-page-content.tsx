"use client";

import { useState, useEffect } from "react";
import { CreateTeamButton, TeamsTable } from "@/components/teams";
import { Button } from "@/components/ui/button";
import { useAuthActions } from "@convex-dev/auth/react";
import { PageSkeleton } from "@/components/ui/table-skeleton";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/lib/convex";
import { Id } from "@/convex/_generated/dataModel";

interface TeamsPageContentProps {
  orgSlug: string;
  canCreateTeams: boolean;
  orgName?: string;
}

export function TeamsPageContent({
  orgSlug,
  canCreateTeams,
}: TeamsPageContentProps) {
  // --------------------------------------------------
  // Pagination (server-side)
  // --------------------------------------------------
  const PAGE_SIZE = 25;
  const [page, setPage] = useState(1);

  const teamsData = useQuery(api.teams.list, { orgSlug });
  const total = teamsData?.length ?? 0;

  const isLoading = teamsData === undefined;

  // Transform teams data to match expected interface
  const teams =
    teamsData?.map((team) => ({
      id: team._id,
      name: team.name,
      description: team.description,
      key: team.key,
      icon: team.icon,
      color: team.color,
      createdAt: new Date(team._creationTime),
      lead: team.lead,
      memberCount: team.memberCount,
    })) ?? [];

  // Ensure page stays within bounds when total changes
  useEffect(() => {
    if (page !== 1 && (page - 1) * PAGE_SIZE >= total) {
      setPage(1);
    }
  }, [total, page]);

  // --------------------------------------------------
  // Team operations
  // --------------------------------------------------
  const { signOut } = useAuthActions();

  const deleteMutation = useMutation(api.teams.deleteTeam);

  const handleDelete = (teamId: string) => {
    deleteMutation({ teamId: teamId as Id<"teams"> });
  };

  // --------------------------------------------------
  // Render
  // --------------------------------------------------
  // Loading state
  if (isLoading && teams.length === 0) {
    return (
      <PageSkeleton
        showTabs={true}
        tabCount={1}
        showCreateButton={canCreateTeams}
        tableRows={8}
        tableColumns={4}
      />
    );
  }

  return (
    <div className="bg-background h-full">
      {/* Header with tabs */}
      <div className="border-b">
        <div className="flex items-center justify-between p-1">
          <div className="flex items-center gap-1">
            <Button
              variant="secondary"
              size="sm"
              className="bg-secondary h-6 gap-2 rounded-xs px-3 text-xs font-normal"
            >
              <span>All teams</span>
              <span className="text-muted-foreground text-xs">{total}</span>
            </Button>
          </div>
          {canCreateTeams && (
            <CreateTeamButton orgSlug={orgSlug} size="sm" className="h-6" />
          )}
        </div>
      </div>

      {/* Teams table */}
      <TeamsTable
        orgSlug={orgSlug}
        teams={teams}
        onDelete={handleDelete}
        deletePending={false}
      />
    </div>
  );
}
