"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type FormValues = {
  name: string;
  slug: string;
  description: string;
  currency: string;
  monthlyPrice: string;
  annualPrice: string;
  maxStudents: string;
  maxStaff: string;
  maxAdmins: string;
  isActive: boolean;
  isPublic: boolean;
};

const initialValues: FormValues = {
  name: "",
  slug: "",
  description: "",
  currency: "ETB",
  monthlyPrice: "",
  annualPrice: "",
  maxStudents: "",
  maxStaff: "",
  maxAdmins: "",
  isActive: true,
  isPublic: true,
};

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function optionalPositiveInteger(value: string) {
  if (!value.trim()) {
    return null;
  }

  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    return null;
  }

  return parsed;
}

export function NewPlanForm() {
  const router = useRouter();
  const [values, setValues] = useState(initialValues);
  const [slugEdited, setSlugEdited] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  function updateValue(field: keyof FormValues, value: string) {
    setValues((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function updateName(value: string) {
    setValues((current) => ({
      ...current,
      name: value,
      slug: slugEdited ? current.slug : slugify(value),
    }));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    const name = values.name.trim();
    const slug = values.slug.trim();
    const currency = values.currency.trim().toUpperCase();
    const monthlyPrice = values.monthlyPrice.trim();
    const annualPrice = values.annualPrice.trim();

    if (!name) {
      setError("Plan name is required.");
      return;
    }

    if (!slug) {
      setError("Plan slug is required.");
      return;
    }

    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
      setError(
        "Slug may contain lowercase letters, numbers, and hyphens only.",
      );
      return;
    }

    if (!/^\d+(\.\d{1,2})?$/.test(monthlyPrice)) {
      setError("Enter a valid monthly price.");
      return;
    }

    if (!/^\d+(\.\d{1,2})?$/.test(annualPrice)) {
      setError("Enter a valid annual price.");
      return;
    }

    if (!/^[A-Z]{3}$/.test(currency)) {
      setError("Currency must be a valid three-letter code.");
      return;
    }

    const limits = [
      ["students", values.maxStudents],
      ["staff", values.maxStaff],
      ["administrators", values.maxAdmins],
    ] as const;

    for (const [label, value] of limits) {
      if (!value.trim()) {
        continue;
      }

      if (optionalPositiveInteger(value) === null) {
        setError(
          `${label.charAt(0).toUpperCase()}${label.slice(1)} limit must be a positive whole number.`,
        );
        return;
      }
    }

    setSubmitting(true);

    try {
      const response = await fetch("/api/platform/plans", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name,
          slug,
          description: values.description.trim() || undefined,
          currency,
          monthlyPrice,
          annualPrice,
          maxStudents: optionalPositiveInteger(values.maxStudents),
          maxStaff: optionalPositiveInteger(values.maxStaff),
          maxAdmins: optionalPositiveInteger(values.maxAdmins),
          isActive: values.isActive,
          isPublic: values.isPublic,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error ?? "Unable to create the plan.");
        return;
      }

      router.push(`/platform/plans/${data.plan.id}`);
      router.refresh();
    } catch {
      setError("Unable to connect to the platform. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  const inputClassName =
    "flex h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-ring focus:ring-2 focus:ring-ring/20";

  const textareaClassName =
    "flex min-h-24 w-full resize-y rounded-lg border border-input bg-background px-3 py-2.5 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-ring focus:ring-2 focus:ring-ring/20";

  return (
    <form onSubmit={handleSubmit} className="space-y-8 p-5 sm:p-6">
      <section>
        <div className="mb-5">
          <h2 className="text-sm font-semibold">Basic information</h2>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            Define the identity of the subscription package shown throughout
            the platform.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <div className="space-y-2">
            <label htmlFor="plan-name" className="text-sm font-medium">
              Plan name
            </label>

            <input
              id="plan-name"
              name="name"
              type="text"
              value={values.name}
              onChange={(event) => updateName(event.target.value)}
              placeholder="e.g. Professional"
              className={inputClassName}
              autoComplete="off"
              required
            />

            <p className="text-xs text-muted-foreground">
              The name displayed to schools and platform administrators.
            </p>
          </div>

          <div className="space-y-2">
            <label htmlFor="plan-slug" className="text-sm font-medium">
              Slug
            </label>

            <input
              id="plan-slug"
              name="slug"
              type="text"
              value={values.slug}
              onChange={(event) => {
                setSlugEdited(true);
                updateValue(
                  "slug",
                  event.target.value.toLowerCase().replace(/\s+/g, "-"),
                );
              }}
              placeholder="professional"
              className={`${inputClassName} font-mono text-[13px]`}
              autoComplete="off"
              spellCheck={false}
              required
            />

            <p className="text-xs text-muted-foreground">
              Unique internal identifier. Lowercase letters, numbers, and
              hyphens.
            </p>
          </div>

          <div className="space-y-2 md:col-span-2">
            <label htmlFor="plan-description" className="text-sm font-medium">
              Description{" "}
              <span className="font-normal text-muted-foreground">
                Optional
              </span>
            </label>

            <textarea
              id="plan-description"
              name="description"
              value={values.description}
              onChange={(event) =>
                updateValue("description", event.target.value)
              }
              placeholder="Describe what this subscription package includes."
              className={textareaClassName}
              maxLength={500}
            />

            <p className="text-xs text-muted-foreground">
              Keep this concise. It can be used wherever the plan is presented
              to schools.
            </p>
          </div>
        </div>
      </section>

      <section className="border-t border-border pt-8">
        <div className="mb-5">
          <h2 className="text-sm font-semibold">Pricing</h2>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            Set the recurring price for monthly and annual subscriptions.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          <div className="space-y-2">
            <label htmlFor="plan-currency" className="text-sm font-medium">
              Currency
            </label>

            <input
              id="plan-currency"
              name="currency"
              type="text"
              value={values.currency}
              onChange={(event) =>
                updateValue(
                  "currency",
                  event.target.value.toUpperCase().slice(0, 3),
                )
              }
              className={`${inputClassName} uppercase`}
              maxLength={3}
              required
            />

            <p className="text-xs text-muted-foreground">
              Three-letter ISO currency code.
            </p>
          </div>

          <div className="space-y-2">
            <label htmlFor="plan-monthly-price" className="text-sm font-medium">
              Monthly price
            </label>

            <div className="relative">
              <input
                id="plan-monthly-price"
                name="monthlyPrice"
                type="text"
                inputMode="decimal"
                value={values.monthlyPrice}
                onChange={(event) =>
                  updateValue("monthlyPrice", event.target.value)
                }
                placeholder="0.00"
                className={`${inputClassName} pr-16`}
                required
              />

              <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-muted-foreground">
                {values.currency || "ETB"}
              </span>
            </div>

            <p className="text-xs text-muted-foreground">
              Recurring monthly subscription price.
            </p>
          </div>

          <div className="space-y-2">
            <label htmlFor="plan-annual-price" className="text-sm font-medium">
              Annual price
            </label>

            <div className="relative">
              <input
                id="plan-annual-price"
                name="annualPrice"
                type="text"
                inputMode="decimal"
                value={values.annualPrice}
                onChange={(event) =>
                  updateValue("annualPrice", event.target.value)
                }
                placeholder="0.00"
                className={`${inputClassName} pr-16`}
                required
              />

              <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-muted-foreground">
                {values.currency || "ETB"}
              </span>
            </div>

            <p className="text-xs text-muted-foreground">
              Recurring annual subscription price.
            </p>
          </div>
        </div>
      </section>

      <section className="border-t border-border pt-8">
        <div className="mb-5">
          <h2 className="text-sm font-semibold">Capacity limits</h2>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            Optional limits that control how much a school can use under this
            plan. Leave a field empty for unlimited capacity.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          <div className="space-y-2">
            <label htmlFor="plan-max-students" className="text-sm font-medium">
              Maximum students
            </label>

            <input
              id="plan-max-students"
              name="maxStudents"
              type="number"
              min="1"
              step="1"
              value={values.maxStudents}
              onChange={(event) =>
                updateValue("maxStudents", event.target.value)
              }
              placeholder="Unlimited"
              className={inputClassName}
            />

            <p className="text-xs text-muted-foreground">
              Maximum student profiles allowed.
            </p>
          </div>

          <div className="space-y-2">
            <label htmlFor="plan-max-staff" className="text-sm font-medium">
              Maximum staff
            </label>

            <input
              id="plan-max-staff"
              name="maxStaff"
              type="number"
              min="1"
              step="1"
              value={values.maxStaff}
              onChange={(event) =>
                updateValue("maxStaff", event.target.value)
              }
              placeholder="Unlimited"
              className={inputClassName}
            />

            <p className="text-xs text-muted-foreground">
              Maximum staff profiles allowed.
            </p>
          </div>

          <div className="space-y-2">
            <label htmlFor="plan-max-admins" className="text-sm font-medium">
              Maximum administrators
            </label>

            <input
              id="plan-max-admins"
              name="maxAdmins"
              type="number"
              min="1"
              step="1"
              value={values.maxAdmins}
              onChange={(event) =>
                updateValue("maxAdmins", event.target.value)
              }
              placeholder="Unlimited"
              className={inputClassName}
            />

            <p className="text-xs text-muted-foreground">
              Maximum administrative users allowed.
            </p>
          </div>
        </div>
      </section>

      <section className="border-t border-border pt-8">
        <div className="mb-5">
          <h2 className="text-sm font-semibold">Availability</h2>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            Control whether this plan can be assigned and whether it is
            visible as a public offering.
          </p>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border bg-muted/20 p-4 transition-colors hover:bg-muted/40">
            <input
              type="checkbox"
              checked={values.isActive}
              onChange={(event) =>
                setValues((current) => ({
                  ...current,
                  isActive: event.target.checked,
                }))
              }
              className="mt-0.5 size-4 accent-primary"
            />

            <span className="min-w-0">
              <span className="block text-sm font-medium">
                Active plan
              </span>
              <span className="mt-1 block text-xs leading-5 text-muted-foreground">
                Allow this plan to be selected when creating or changing a
                school subscription.
              </span>
            </span>
          </label>

          <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border bg-muted/20 p-4 transition-colors hover:bg-muted/40">
            <input
              type="checkbox"
              checked={values.isPublic}
              onChange={(event) =>
                setValues((current) => ({
                  ...current,
                  isPublic: event.target.checked,
                }))
              }
              className="mt-0.5 size-4 accent-primary"
            />

            <span className="min-w-0">
              <span className="block text-sm font-medium">
                Public plan
              </span>
              <span className="mt-1 block text-xs leading-5 text-muted-foreground">
                Make this package visible in public-facing subscription
                selection experiences.
              </span>
            </span>
          </label>
        </div>
      </section>

      {error ? (
        <div
          role="alert"
          className="rounded-lg border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive"
        >
          {error}
        </div>
      ) : null}

      <div className="flex flex-col-reverse gap-3 border-t border-border pt-6 sm:flex-row sm:justify-end">
        <button
          type="button"
          onClick={() => router.push("/platform/plans")}
          disabled={submitting}
          className="inline-flex h-10 items-center justify-center rounded-lg border border-border bg-background px-4 text-sm font-medium transition-colors hover:bg-muted disabled:pointer-events-none disabled:opacity-50"
        >
          Cancel
        </button>

        <button
          type="submit"
          disabled={submitting}
          className="inline-flex h-10 items-center justify-center rounded-lg bg-primary px-5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:pointer-events-none disabled:opacity-50"
        >
          {submitting ? "Creating plan..." : "Create plan"}
        </button>
      </div>
    </form>
  );
}
