"use client";

import type React from "react";
import { CreateTeamDialog } from "./create-team-dialog";
import { PermissionGate } from "@/hooks/use-permissions";
import { PERMISSIONS } from "@/auth/permission-constants";

/**
 * Thin wrapper kept for backwards-compatibility. Accepts the previous props
 * (`size`, etc.) but simply forwards through to the new unified
 * `CreateTeamDialog` component.
 */
interface LegacyCreateTeamButtonProps
  extends React.ComponentProps<typeof CreateTeamDialog> {
  /** Optional size prop kept for API parity but not used. */
  size?: "default" | "sm" | "lg" | "icon";
}

export function CreateTeamButton({
  size: _size,
  orgSlug,
  ...rest
}: LegacyCreateTeamButtonProps) {
  // `_size` is intentionally ignored – sizing is handled internally by the
  // new dialog component. All other props are forwarded through untouched.
  return (
    <PermissionGate orgSlug={orgSlug} permission={PERMISSIONS.TEAM_CREATE}>
      <CreateTeamDialog orgSlug={orgSlug} {...rest} />
    </PermissionGate>
  );
}
