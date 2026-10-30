import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const session = await auth.api.getSession({
    headers: request.headers,
  });

  if (!session?.user) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const response = NextResponse.redirect(new URL("/", request.url));

  response.cookies.set("skuda_school_id", "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });

  return response;
}
