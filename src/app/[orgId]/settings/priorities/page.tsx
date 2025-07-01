import { redirect } from "next/navigation";

interface PageProps {
  params: Promise<{ orgId: string }>;
}

export default async function PrioritiesPage({ params }: PageProps) {
  const { orgId: orgSlug } = await params;

  // Route deprecated – redirect to unified states page
  redirect(`/${orgSlug}/settings/states`);
}
