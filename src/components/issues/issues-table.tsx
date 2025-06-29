"use client";

import Link from "next/link";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { formatDateHuman } from "@/lib/date";
import { getDynamicIcon } from "@/lib/dynamic-icons";
import { Circle } from "lucide-react";

import type { InferSelectModel } from "drizzle-orm";
import { issue as issueTable } from "@/db/schema/issues";

// Extend the base issue type with all the joined data from getRecentIssues
type Issue = Pick<
  InferSelectModel<typeof issueTable>,
  "id" | "title" | "key" | "sequenceNumber" | "stateId" | "priorityId"
> & {
  createdAt: string | Date;
  updatedAt: string | Date;
  projectName: string | null;
  teamName: string | null;
  projectKey: string | null;
  teamKey: string | null;
  // State details
  stateName: string | null;
  stateColor: string | null;
  stateIcon: string | null;
  stateType: string | null;
  // Priority details
  priorityName: string | null;
  priorityWeight: number | null;
  priorityColor: string | null;
  priorityIcon: string | null;
  // Assignee details
  assigneeId: string | null;
  assigneeName: string | null;
  assigneeEmail: string | null;
  reporterName: string | null;
};

interface IssuesTableProps {
  orgSlug: string;
  issues: Issue[];
}

export function IssuesTable({ orgSlug, issues }: IssuesTableProps) {
  const utils = trpc.useUtils();
  const deleteMutation = trpc.issue.delete.useMutation({
    onSuccess: () => {
      // Refresh only issue-related queries instead of nuking entire cache.
      Promise.all([
        utils.organization.listIssues.invalidate({ orgSlug }),
        utils.organization.listIssuesPaged.invalidate({ orgSlug }),
      ]).catch(() => {});
    },
  });

  function getAssigneeInitials(name?: string | null): string {
    if (!name) return "?";
    return name
      .split(" ")
      .map((part) => part.charAt(0))
      .join("")
      .toUpperCase()
      .slice(0, 2);
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-[50%]">Issue</TableHead>
          <TableHead className="w-[20%]">Created</TableHead>
          <TableHead className="w-[15%]">Assignee</TableHead>
          <TableHead className="w-[15%] text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {issues.map((issue) => {
          // Get priority icon component and styling
          const PriorityIcon = issue.priorityIcon
            ? getDynamicIcon(issue.priorityIcon) || Circle
            : Circle;
          const priorityColor = issue.priorityColor || "#94a3b8";

          // Get state icon component and styling
          const StateIcon = issue.stateIcon
            ? getDynamicIcon(issue.stateIcon) || Circle
            : Circle;
          const stateColor = issue.stateColor || "#94a3b8";

          return (
            <TableRow key={issue.id} className="h-12">
              <TableCell className="py-2">
                <div className="flex items-center gap-2">
                  {/* Priority Icon */}
                  <div className="flex-shrink-0">
                    <PriorityIcon
                      className="size-4"
                      style={{ color: priorityColor }}
                    />
                  </div>

                  {/* Issue Key */}
                  <span className="text-muted-foreground flex-shrink-0 font-mono text-xs">
                    {issue.key}
                  </span>

                  {/* State Icon */}
                  <div className="flex-shrink-0">
                    <StateIcon
                      className="size-4"
                      style={{ color: stateColor }}
                    />
                  </div>

                  {/* Title */}
                  <Link
                    href={`/${orgSlug}/issues/${issue.key}`}
                    className="hover:text-primary min-w-0 flex-1 truncate text-sm font-medium"
                  >
                    {issue.title}
                  </Link>
                </div>
              </TableCell>

              {/* Created Date */}
              <TableCell className="py-2">
                <span className="text-muted-foreground text-xs">
                  {formatDateHuman(issue.createdAt)}
                </span>
              </TableCell>

              {/* Assignee */}
              <TableCell className="py-2">
                {issue.assigneeId ? (
                  <div className="flex items-center gap-2">
                    <Avatar className="size-6">
                      <AvatarFallback className="text-xs">
                        {getAssigneeInitials(issue.assigneeName)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-muted-foreground truncate text-xs">
                      {issue.assigneeName}
                    </span>
                  </div>
                ) : (
                  <span className="text-muted-foreground text-xs">—</span>
                )}
              </TableCell>

              {/* Actions */}
              <TableCell className="py-2">
                <div className="flex justify-end gap-1">
                  <Button variant="outline" size="sm" asChild>
                    <Link href={`/${orgSlug}/issues/${issue.key}`}>Open</Link>
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    disabled={deleteMutation.isPending}
                    onClick={() => {
                      if (
                        !confirm(
                          "Delete this issue? This action cannot be undone.",
                        )
                      )
                        return;
                      deleteMutation.mutate({ issueId: issue.id });
                    }}
                  >
                    Delete
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
