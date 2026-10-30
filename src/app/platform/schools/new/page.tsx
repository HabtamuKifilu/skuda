import Link from "next/link";
import { ArrowLeft, Building2 } from "lucide-react";
import { PlatformShell } from "@/components/platform-shell/platform-shell";
import { NewSchoolForm } from "@/components/platform-schools/new-school-form";
import { requirePlatformOwnerPage } from "@/lib/platform-page";

export default async function NewSchoolPage() {
  await requirePlatformOwnerPage();

  return (
    <PlatformShell>
      <div className="mx-auto w-full max-w-[1100px] px-4 py-6 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-6">
          <section>
            <Link
              href="/platform/schools"
              className="inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              <ArrowLeft className="size-4" />
              Back to schools
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
                  Create school
                </h1>
                <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">
                  Register a new school on the SKUDA platform. You can
                  configure its academic and operational settings after
                  creation.
                </p>
              </div>
            </div>
          </section>

          <section className="rounded-xl border border-border bg-card shadow-sm">
            <div className="border-b border-border px-6 py-5">
              <h2 className="text-sm font-semibold">School information</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Basic information used to identify and configure the school.
              </p>
            </div>

            <NewSchoolForm />
          </section>
        </div>
      </div>
    </PlatformShell>
  );
}
