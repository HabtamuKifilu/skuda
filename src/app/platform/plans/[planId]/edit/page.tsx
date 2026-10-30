import { Receipt } from "lucide-react";
import { notFound } from "next/navigation";
import { EditPlanForm } from "@/components/platform-plans/edit-plan-form";
import { PlatformShell } from "@/components/platform-shell/platform-shell";
import { PlatformPageLayout } from "@/components/platform-shell/platform-page";
import { prisma } from "@/lib/db/prisma";
import { requirePlatformOwnerPage } from "@/lib/platform-page";

type RouteContext = {
  params: Promise<{
    planId: string;
  }>;
};

export default async function EditPlatformPlanPage({
  params,
}: RouteContext) {
  await requirePlatformOwnerPage();

  const { planId } = await params;

  const plan = await prisma.plan.findUnique({
    where: {
      id: planId,
    },
    select: {
      id: true,
      name: true,
      slug: true,
      description: true,
      currency: true,
      monthlyPrice: true,
      annualPrice: true,
      maxStudents: true,
      maxStaff: true,
      maxAdmins: true,
      isActive: true,
      isPublic: true,
    },
  });

  if (!plan) {
    notFound();
  }

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
            <span className="text-muted-foreground">{plan.name}</span>
            <span className="text-muted-foreground/50">/</span>
            <span className="text-muted-foreground">Edit</span>
          </div>

          <h1 className="mt-2 text-2xl font-semibold tracking-tight">
            Edit plan
          </h1>

          <p className="mt-1.5 max-w-2xl text-sm leading-6 text-muted-foreground">
            Update pricing, capacity limits, visibility, and other commercial
            settings for this subscription package.
          </p>
        </section>

        <section className="overflow-hidden rounded-xl border border-border bg-card">
          <div className="flex items-center gap-3 border-b border-border px-5 py-4 sm:px-6">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Receipt className="size-[18px]" strokeWidth={1.8} />
            </div>

            <div className="min-w-0">
              <h2 className="text-sm font-semibold">
                {plan.name}
              </h2>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Changes are applied to the plan immediately after saving.
              </p>
            </div>
          </div>

          <EditPlanForm
            planId={plan.id}
            initialValues={{
              name: plan.name,
              slug: plan.slug,
              description: plan.description ?? "",
              currency: plan.currency,
              monthlyPrice: plan.monthlyPrice.toString(),
              annualPrice: plan.annualPrice.toString(),
              maxStudents:
                plan.maxStudents === null
                  ? ""
                  : String(plan.maxStudents),
              maxStaff:
                plan.maxStaff === null
                  ? ""
                  : String(plan.maxStaff),
              maxAdmins:
                plan.maxAdmins === null
                  ? ""
                  : String(plan.maxAdmins),
              isActive: plan.isActive,
              isPublic: plan.isPublic,
            }}
          />
        </section>
      </PlatformPageLayout>
    </PlatformShell>
  );
}
