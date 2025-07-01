"use client";

import { AnimatePresence, motion } from "motion/react";
import { Button } from "@/components/ui/button";
import { Shield, Edit, Trash2, Users } from "lucide-react";
import { formatDateHuman } from "@/lib/date";

export interface CustomRoleRow {
  id: string;
  name: string;
  description: string | null;
  createdAt: string | Date;
  system?: boolean;
}

interface CustomRolesTableProps {
  roles: ReadonlyArray<CustomRoleRow>;
  canAssign: boolean;
  canEdit: boolean;
  canDelete: boolean;
  onAssign: (roleId: string) => void;
  onEdit: (roleId: string) => void;
  onDelete: (roleId: string) => void;
}

export function CustomRolesTable({
  roles,
  canAssign,
  canEdit,
  canDelete,
  onAssign,
  onEdit,
  onDelete,
}: CustomRolesTableProps) {
  if (roles.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-muted-foreground text-center text-sm">
          No custom roles created yet.
        </div>
      </div>
    );
  }

  return (
    <div className="divide-y">
      <AnimatePresence initial={false}>
        {roles.map((role) => (
          <motion.div
            key={role.id}
            layout
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.2 }}
            className="hover:bg-muted/50 flex items-center gap-3 px-3 py-2 transition-colors"
          >
            {/* Icon */}
            <Shield className="size-4 flex-shrink-0 text-purple-600" />

            {/* Role name & description */}
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium">{role.name}</div>
              {role.description && (
                <div className="text-muted-foreground truncate text-xs">
                  {role.description}
                </div>
              )}
            </div>

            {/* Created date */}
            <div className="text-muted-foreground flex-shrink-0 text-xs">
              {formatDateHuman(new Date(role.createdAt))}
            </div>

            {/* Actions */}
            <div className="flex flex-shrink-0 gap-1">
              {canAssign && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="size-7 p-0"
                  onClick={() => onAssign(role.id)}
                  title="Assign role"
                >
                  <Users className="size-3" />
                </Button>
              )}
              {canEdit && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="size-7 p-0"
                  onClick={() => onEdit(role.id)}
                  title="Edit role"
                >
                  <Edit className="size-3" />
                </Button>
              )}
              {canDelete && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="size-7 p-0 text-red-600 hover:bg-red-50 hover:text-red-700"
                  onClick={() => onDelete(role.id)}
                  title="Delete role"
                >
                  <Trash2 className="size-3" />
                </Button>
              )}
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
