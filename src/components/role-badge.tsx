import { Badge } from "@/components/ui/badge";

export function OrgRoleBadge({ role }: { role: string }) {
  const colorVariant =
    role === "owner"
      ? "destructive"
      : role === "admin"
        ? "secondary"
        : "outline";
  return (
    <Badge variant={colorVariant} className="text-xs capitalize">
      {role}
    </Badge>
  );
}
