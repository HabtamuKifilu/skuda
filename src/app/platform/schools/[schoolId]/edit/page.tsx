import Link from "next/link";
import { ArrowLeft, Building2 } from "lucide-react";
import { PlatformShell } from "@/components/platform-shell/platform-shell";
import { EditSchoolForm } from "@/components/platform-schools/edit-school-form";
import { requirePlatformOwnerPage } from "@/lib/platform-page";
import { prisma } from "@/lib/db/prisma";
import { notFound } from "next/navigation";

type EditSchoolPageProps = {
  params: Promise<{
    schoolId: string;
  }>;
};

export default async function EditSchoolPage({
  params,
}: EditSchoolPageProps) {
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
      email: true,
      phone: true,
      address: true,
      city: true,
      country: true,
      timezone: true,
      currency: true,
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
                <Building2 className="size-5" strokeWidth={1.8} />
              </div>

              <div>
                <p className="text-sm font-medium text-primary">
                  Organization
                </p>
                <h1 className="mt-1 text-2xl font-semibold tracking-tight">
                  Edit school
                </h1>
                <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">
                  Update the school&apos;s identity, contact information, and
                  platform settings.
                </p>
              </div>
            </div>
          </section>

          <section className="rounded-xl border border-border bg-card shadow-sm">
            <div className="border-b border-border px-6 py-5">
              <h2 className="text-sm font-semibold">School information</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Changes apply to the school immediately after saving.
              </p>
            </div>

            <EditSchoolForm
              schoolId={school.id}
              initialValues={{
                name: school.name,
                code: school.code ?? "",
                email: school.email ?? "",
                phone: school.phone ?? "",
                address: school.address ?? "",
                city: school.city ?? "",
                country: school.country,
                timezone: school.timezone,
                currency: school.currency,
              }}
            />
          </section>
        </div>
      </div>
    </PlatformShell>
  );
}
