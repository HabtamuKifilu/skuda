import Link from "next/link";
import { ArrowLeft, ShieldAlert } from "lucide-react";

export default function PlatformAccessDeniedPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6">
      <div className="w-full max-w-md text-center">
        <div className="mx-auto flex size-12 items-center justify-center rounded-xl bg-destructive/10 text-destructive">
          <ShieldAlert className="size-6" />
        </div>

        <p className="mt-6 text-sm font-medium text-muted-foreground">
          SKUDA Platform
        </p>

        <h1 className="mt-2 text-2xl font-semibold tracking-tight">
          Platform access required
        </h1>

        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          Your account does not have permission to access the SKUDA platform
          control plane. If you believe this is incorrect, contact your
          platform administrator.
        </p>

        <Link
          href="/"
          className="mt-6 inline-flex h-9 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
        >
          <ArrowLeft className="size-4" />
          Return to workspace
        </Link>
      </div>
    </main>
  );
}
