import { WalletCards } from "lucide-react";
import { PlatformShell } from "@/components/platform-shell/platform-shell";
import { PlatformPageLayout } from "@/components/platform-shell/platform-page";
import { SubscriptionsDirectory } from "@/components/platform-subscriptions/subscriptions-directory";
import { requirePlatformOwnerPage } from "@/lib/platform-page";

export default async function PlatformSubscriptionsPage() {
  await requirePlatformOwnerPage();

  return (
    <PlatformShell>
      <PlatformPageLayout>
        <section className="flex flex-col gap-5 border-b border-border pb-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-xs font-medium text-primary">
              <WalletCards className="size-4" strokeWidth={1.8} />
              <span>Commercial</span>
              <span className="text-muted-foreground/50">/</span>
              <span className="text-muted-foreground">Subscriptions</span>
            </div>

            <h1 className="mt-2 text-2xl font-semibold tracking-tight">
              Subscriptions
            </h1>

            <p className="mt-1.5 max-w-2xl text-sm leading-6 text-muted-foreground">
              Manage school subscriptions, plan assignments, billing cycles,
              and subscription lifecycle status across the SKUDA platform.
            </p>
          </div>
        </section>

        <SubscriptionsDirectory />
      </PlatformPageLayout>
    </PlatformShell>
  );
}
