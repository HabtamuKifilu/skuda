import { Receipt } from "lucide-react";
import { NewPlanForm } from "@/components/platform-plans/new-plan-form";
import { PlatformShell } from "@/components/platform-shell/platform-shell";
import { PlatformPageLayout } from "@/components/platform-shell/platform-page";
import { requirePlatformOwnerPage } from "@/lib/platform-page";

export default async function NewPlatformPlanPage() {
  await requirePlatformOwnerPage();

  return (
    <PlatformShell>
      <PlatformPageLayout>
        <section className="border-b border-border pb-5">
          <div className="flex items-center gap-2 text-xs font-medium text-primary">
            <Receipt className="size-4" strokeWidth={1.8} />
            <span>Commercial</span>
            <span className="text-muted-foreground/50">/</span>
            <span className="text-muted-foreground">Plans</span>
            <span className="text-muted-foreground/50">/</span>
            <span className="text-muted-foreground">New</span>
          </div>

          <h1 className="mt-2 text-2xl font-semibold tracking-tight">
            Create plan
          </h1>

          <p className="mt-1.5 max-w-2xl text-sm leading-6 text-muted-foreground">
            Define a subscription package with pricing, capacity limits, and
            availability settings for schools.
          </p>
        </section>

        <section className="overflow-hidden rounded-xl border border-border bg-card">
          <div className="flex items-center gap-3 border-b border-border px-5 py-4 sm:px-6">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Receipt className="size-[18px]" strokeWidth={1.8} />
            </div>

            <div className="min-w-0">
              <h2 className="text-sm font-semibold">Plan configuration</h2>
              <p className="mt-0.5 text-xs text-muted-foreground">
                All pricing and capacity values can be changed later.
              </p>
            </div>
          </div>

          <NewPlanForm />
        </section>
      </PlatformPageLayout>
    </PlatformShell>
  );
}
