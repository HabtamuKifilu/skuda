import { PlatformShell } from "@/components/platform-shell/platform-shell";
import { PlatformPageLayout } from "@/components/platform-shell/platform-page";
import { BillingDirectory } from "@/components/platform-billing/billing-directory";
import { requirePlatformOwnerPage } from "@/lib/platform-page";

export default async function PlatformBillingPage() {
  await requirePlatformOwnerPage();

  return (
    <PlatformShell>
    <PlatformPageLayout>
      <div>
        <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-primary">
          Commercial
        </p>

        <h1 className="mt-1 text-2xl font-semibold tracking-tight">
          Billing
        </h1>

        <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">
          Monitor invoices, billing periods, and settlement status across
          the platform.
        </p>
      </div>

      <BillingDirectory />
    </PlatformPageLayout>
    </PlatformShell>
  );
}
