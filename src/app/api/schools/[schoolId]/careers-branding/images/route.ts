import { randomUUID } from "node:crypto";
import { NextRequest } from "next/server";
import { SchoolMembershipRole } from "@/generated/prisma/client";
import { authorizationErrorResponse } from "@/lib/api-errors";
import { createAuditLog } from "@/lib/audit-log";
import { requireSchoolRole } from "@/lib/authorization";
import { prisma } from "@/lib/db/prisma";
import { uploadCareersImage } from "@/lib/storage/careers-public-image-storage";

export const runtime = "nodejs";

const uploadRoles = [
  SchoolMembershipRole.OWNER,
  SchoolMembershipRole.ADMIN,
  SchoolMembershipRole.HR_MANAGER,
];

type RouteContext = {
  params: Promise<{ schoolId: string }>;
};

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { schoolId } = await context.params;
    const authorization = await requireSchoolRole(
      request.headers,
      schoolId,
      uploadRoles,
    );

    const school = await prisma.school.findUnique({
      where: { id: schoolId },
      select: { slug: true },
    });
    if (!school) {
      return Response.json({ error: "School not found." }, { status: 404 });
    }

    const declaredLength = Number(request.headers.get("content-length") || 0);
    if (declaredLength > 6 * 1024 * 1024) {
      return Response.json(
        { error: "Image upload must not exceed 5 MB." },
        { status: 413 },
      );
    }

    const form = await request.formData();
    const file = form.get("image");
    const kind = form.get("kind");

    if (kind !== "logo" && kind !== "cover") {
      return Response.json(
        { error: "Image kind must be logo or cover." },
        { status: 400 },
      );
    }

    if (!(file instanceof File)) {
      return Response.json(
        { error: "Choose an image file to upload." },
        { status: 400 },
      );
    }

    if (file.size === 0 || file.size > 5 * 1024 * 1024) {
      return Response.json(
        { error: "Choose an image no larger than 5 MB." },
        { status: 400 },
      );
    }

    const uploaded = await uploadCareersImage({
      schoolId,
      schoolSlug: school.slug,
      kind,
      bytes: new Uint8Array(await file.arrayBuffer()),
    });

    await prisma.$transaction(async (tx) => {
      await createAuditLog(
        tx,
        {
          actorId: authorization.userId,
          schoolId,
          action: "SCHOOL_CAREERS_IMAGE_UPLOADED",
          resourceType: "School",
          resourceId: schoolId,
          metadata: {
            kind,
            key: uploaded.key,
            contentType: uploaded.contentType,
            size: uploaded.size,
            uploadId: randomUUID(),
          },
        },
        request,
      );
    });

    return Response.json({
      url: uploaded.url,
      kind,
      contentType: uploaded.contentType,
      size: uploaded.size,
    });
  } catch (error) {
    const response = authorizationErrorResponse(error);
    if (response) return response;

    if (
      error instanceof Error &&
      (
        error.message.includes("Unsupported image") ||
        error.message.includes("Images must") ||
        error.message.includes("must be a valid URL") ||
        error.message.includes("must use HTTPS")
      )
    ) {
      return Response.json({ error: error.message }, { status: 400 });
    }

    console.error("Failed to upload careers image:", error);
    return Response.json(
      { error: "Unable to upload the image." },
      { status: 500 },
    );
  }
}
