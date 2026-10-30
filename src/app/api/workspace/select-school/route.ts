import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";

export async function POST(request: NextRequest) {
  const session = await auth.api.getSession({
    headers: request.headers,
  });

  if (!session?.user) {
    return NextResponse.redirect(new URL("/login", request.url), 303);
  }

  const formData = await request.formData();
  const schoolId = formData.get("schoolId");

  if (typeof schoolId !== "string" || !schoolId.trim()) {
    return NextResponse.redirect(new URL("/", request.url), 303);
  }

  const membership = await prisma.schoolMembership.findFirst({
    where: {
      userId: session.user.id,
      schoolId,
      isActive: true,
      school: { isActive: true },
    },
    select: { id: true },
  });

  if (!membership) {
    return NextResponse.redirect(new URL("/", request.url), 303);
  }

  const response = NextResponse.redirect(new URL("/", request.url), 303);

  response.cookies.set("skuda_school_id", schoolId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });

  return response;
}
