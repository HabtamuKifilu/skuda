import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Crown, ShieldCheck } from "lucide-react";
import { PlatformShell } from "@/components/platform-shell/platform-shell";
import { AssignSchoolOwnerForm } from "@/components/platform-schools/assign-school-owner-form";
import { prisma } from "@/lib/db/prisma";
import { requirePlatformOwnerPage } from "@/lib/platform-page";

type AssignSchoolOwnerPageProps = {
  params: Promise<{
    schoolId: string;
  }>;
};

export default async function AssignSchoolOwnerPage({
  params,
}: AssignSchoolOwnerPageProps) {
  await requirePlatformOwnerPage();

  const { schoolId } = await params;

  const school = await prisma.school.findUnique({
    where: {
      id: schoolId,
    },
    select: {
      id: true,
      name: true,
      code: true,
    },
  });

  if (!school) {
    notFound();
  }

  return (
    <PlatformShell>
      <div className="mx-auto w-full max-w-[1100px] px-4 py-6 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-6">
          <section>
            <Link
              href={`/platform/schools/${school.id}`}
              className="inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              <ArrowLeft className="size-4" />
              Back to school
            </Link>

            <div className="mt-5 flex items-start gap-4">
              <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Crown className="size-5" strokeWidth={1.8} />
              </div>

              <div className="min-w-0">
                <p className="text-sm font-medium text-primary">
                  School administration
                </p>

                <h1 className="mt-1 text-2xl font-semibold tracking-tight">
                  Assign school owner
                </h1>

                <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">
                  Establish the person responsible for administering this
                  school within SKUDA.
                </p>

                <div className="mt-3 inline-flex items-center gap-2 rounded-lg bg-muted px-3 py-1.5 text-xs text-muted-foreground">
                  <ShieldCheck className="size-3.5" />
                  {school.code
                    ? `${school.name} · ${school.code}`
                    : school.name}
                </div>
              </div>
            </div>
          </section>

          <section className="rounded-xl border border-border bg-card shadow-sm">
            <div className="border-b border-border px-6 py-5">
              <h2 className="text-sm font-semibold">School ownership</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Select an existing SKUDA user to become the owner of this
                school.
              </p>
            </div>

            <AssignSchoolOwnerForm schoolId={school.id} />
          </section>
        </div>
      </div>
    </PlatformShell>
  );
}
