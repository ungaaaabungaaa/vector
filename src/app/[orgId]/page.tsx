import { redirect } from "next/navigation";

interface OrgRootPageProps {
  params: { orgId: string };
}

export default function OrgRootPage({ params }: OrgRootPageProps) {
  // Immediately redirect to the issues list for the organization
  redirect(`/${params.orgId}/issues`);
  // This return is unreachable but satisfies the type checker
  return null;
}
