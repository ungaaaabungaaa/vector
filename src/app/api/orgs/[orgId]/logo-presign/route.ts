import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth/auth";
import { OrganizationService } from "@/entities/organizations/organization.service";
import { getPresignedUploadUrl } from "@/lib/s3";

interface Params {
  orgId: string;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<Params> },
) {
  try {
    const { orgId } = await params;
    const { fileType } = await req.json();

    if (!fileType) {
      return NextResponse.json(
        { error: "fileType is required" },
        { status: 400 },
      );
    }

    // Authenticate user via BetterAuth wrapper
    const session = await auth.api.getSession({ headers: req.headers });
    if (!session?.user) {
      return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    }

    // Ensure user belongs to organisation and is admin/owner
    const membership = await OrganizationService.verifyUserOrganizationAccess(
      session.user.id,
      orgId,
    );
    if (
      !membership ||
      (membership.role !== "owner" && membership.role !== "admin")
    ) {
      return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
    }

    const extension = fileType.split("/")[1] || "png";
    const key = `org-logos/${orgId}/${Date.now()}.${extension}`;

    const { uploadUrl } = await getPresignedUploadUrl(key, fileType, 60);

    return NextResponse.json({ uploadUrl, key });
  } catch (err) {
    console.error("logo-presign error", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
