import Link from "next/link";
import { ArrowLeft, CircleUserRound, ShieldCheck, UserPlus } from "lucide-react";
import { PlatformShell } from "@/components/platform-shell/platform-shell";
import { NewPlatformUserForm } from "@/components/platform-users/new-platform-user-form";
import { requirePlatformOwnerPage } from "@/lib/platform-page";

export default async function NewPlatformUserPage() {
  await requirePlatformOwnerPage();

  return (
    <PlatformShell>
      <div className="mx-auto w-full max-w-[900px] px-4 py-6 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-6">
          <section>
            <Link
              href="/platform/users"
              className="inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              <ArrowLeft className="size-4" />
              Back to users
            </Link>

            <div className="mt-5 flex items-start gap-4">
              <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <UserPlus className="size-5" strokeWidth={1.8} />
              </div>

              <div>
                <p className="text-sm font-medium text-primary">
                  Platform administration
                </p>

                <h1 className="mt-1 text-2xl font-semibold tracking-tight">
                  Create user
                </h1>

                <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">
                  Create a SKUDA authentication account that can later be
                  assigned to one or more schools.
                </p>
              </div>
            </div>
          </section>

          <section className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
            <div className="border-b border-border px-6 py-5">
              <div className="flex items-center gap-3">
                <div className="flex size-9 items-center justify-center rounded-lg bg-muted">
                  <CircleUserRound className="size-4 text-muted-foreground" />
                </div>

                <div>
                  <h2 className="text-sm font-semibold">Account details</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Enter the basic information for this SKUDA user.
                  </p>
                </div>
              </div>
            </div>

            <NewPlatformUserForm />
          </section>

          <section className="rounded-xl border border-border bg-muted/30 p-5">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-background">
                <ShieldCheck className="size-4 text-muted-foreground" />
              </div>

              <div>
                <h2 className="text-sm font-semibold">
                  About school permissions
                </h2>

                <p className="mt-1 text-sm leading-6 text-muted-foreground">
                  Creating a user only creates their SKUDA account. It does
                  not automatically make them a school owner, administrator,
                  teacher, or other school member. School roles are assigned
                  separately.
                </p>
              </div>
            </div>
          </section>
        </div>
      </div>
    </PlatformShell>
  );
}
