import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { PlatformMembershipRole } from "@/generated/prisma/enums";
import { requirePlatformRole } from "./platform-authorization";

export async function requirePlatformOwnerPage() {
  const requestHeaders = await headers();

  try {
    return await requirePlatformRole(
      requestHeaders,
      [PlatformMembershipRole.PLATFORM_OWNER],
    );
  } catch (error) {
    const errorName = error instanceof Error ? error.name : "";

    if (errorName === "PlatformAuthenticationRequiredError") {
      redirect("/login");
    }

    if (
      errorName === "PlatformMembershipRequiredError" ||
      errorName === "InsufficientPlatformRoleError"
    ) {
      redirect("/platform/access-denied");
    }

    throw error;
  }
}
