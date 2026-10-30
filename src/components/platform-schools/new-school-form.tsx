"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type FormValues = {
  name: string;
  code: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  country: string;
  timezone: string;
  currency: string;
};

const initialValues: FormValues = {
  name: "",
  code: "",
  email: "",
  phone: "",
  address: "",
  city: "",
  country: "Ethiopia",
  timezone: "Africa/Addis_Ababa",
  currency: "ETB",
};

export function NewSchoolForm() {
  const router = useRouter();
  const [values, setValues] = useState(initialValues);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  function updateValue(field: keyof FormValues, value: string) {
    setValues((current) => ({ ...current, [field]: value }));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (!values.name.trim()) {
      setError("School name is required.");
      return;
    }

    setSubmitting(true);

    try {
      const response = await fetch("/api/platform/schools", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: values.name,
          code: values.code || undefined,
          email: values.email || undefined,
          phone: values.phone || undefined,
          address: values.address || undefined,
          city: values.city || undefined,
          country: values.country,
          timezone: values.timezone,
          currency: values.currency,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error ?? "Unable to create the school.");
        return;
      }

      router.push("/platform/schools");
      router.refresh();
    } catch {
      setError("Unable to connect to the platform. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  const inputClassName =
    "flex h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-ring focus:ring-2 focus:ring-ring/20";

  return (
    <form onSubmit={handleSubmit} className="space-y-8 p-6">
      <div className="grid gap-6 md:grid-cols-2">
        <div className="space-y-2">
          <label htmlFor="school-name" className="text-sm font-medium">
            School name
          </label>
          <input
            id="school-name"
            name="name"
            type="text"
            value={values.name}
            onChange={(event) => updateValue("name", event.target.value)}
            placeholder="e.g. Horizon Academy"
            className={inputClassName}
            autoComplete="organization"
            required
          />
          <p className="text-xs text-muted-foreground">
            The official name displayed throughout SKUDA.
          </p>
        </div>

        <div className="space-y-2">
          <label htmlFor="school-code" className="text-sm font-medium">
            School code{" "}
            <span className="font-normal text-muted-foreground">
              Optional
            </span>
          </label>
          <input
            id="school-code"
            name="code"
            type="text"
            value={values.code}
            onChange={(event) =>
              updateValue("code", event.target.value.toUpperCase())
            }
            placeholder="e.g. HZA-001"
            className={`${inputClassName} uppercase`}
          />
          <p className="text-xs text-muted-foreground">
            A short internal identifier for the organization.
          </p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="space-y-2">
          <label htmlFor="school-email" className="text-sm font-medium">
            School email{" "}
            <span className="font-normal text-muted-foreground">Optional</span>
          </label>
          <input
            id="school-email"
            name="email"
            type="email"
            value={values.email}
            onChange={(event) => updateValue("email", event.target.value)}
            placeholder="office@example.com"
            className={inputClassName}
            autoComplete="email"
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="school-phone" className="text-sm font-medium">
            Phone{" "}
            <span className="font-normal text-muted-foreground">Optional</span>
          </label>
          <input
            id="school-phone"
            name="phone"
            type="tel"
            value={values.phone}
            onChange={(event) => updateValue("phone", event.target.value)}
            placeholder="+251 ..."
            className={inputClassName}
            autoComplete="tel"
          />
        </div>
      </div>

      <div className="border-t border-border pt-8">
        <div className="mb-5">
          <h3 className="text-sm font-semibold">Location</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Where the school is physically located.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <div className="space-y-2 md:col-span-2">
            <label htmlFor="school-address" className="text-sm font-medium">
              Address{" "}
              <span className="font-normal text-muted-foreground">
                Optional
              </span>
            </label>
            <input
              id="school-address"
              name="address"
              type="text"
              value={values.address}
              onChange={(event) => updateValue("address", event.target.value)}
              placeholder="Street, building, or neighborhood"
              className={inputClassName}
              autoComplete="street-address"
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="school-city" className="text-sm font-medium">
              City{" "}
              <span className="font-normal text-muted-foreground">
                Optional
              </span>
            </label>
            <input
              id="school-city"
              name="city"
              type="text"
              value={values.city}
              onChange={(event) => updateValue("city", event.target.value)}
              placeholder="Addis Ababa"
              className={inputClassName}
              autoComplete="address-level2"
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="school-country" className="text-sm font-medium">
              Country
            </label>
            <input
              id="school-country"
              name="country"
              type="text"
              value={values.country}
              onChange={(event) => updateValue("country", event.target.value)}
              className={inputClassName}
              autoComplete="country-name"
              required
            />
          </div>
        </div>
      </div>

      <div className="border-t border-border pt-8">
        <div className="mb-5">
          <h3 className="text-sm font-semibold">Regional settings</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Defaults used for dates, times, and financial records.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <div className="space-y-2">
            <label htmlFor="school-timezone" className="text-sm font-medium">
              Timezone
            </label>
            <input
              id="school-timezone"
              name="timezone"
              type="text"
              value={values.timezone}
              onChange={(event) =>
                updateValue("timezone", event.target.value)
              }
              className={inputClassName}
              required
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="school-currency" className="text-sm font-medium">
              Currency
            </label>
            <input
              id="school-currency"
              name="currency"
              type="text"
              value={values.currency}
              onChange={(event) =>
                updateValue("currency", event.target.value.toUpperCase())
              }
              className={`${inputClassName} uppercase`}
              maxLength={3}
              required
            />
          </div>
        </div>
      </div>

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
          onClick={() => router.push("/platform/schools")}
          disabled={submitting}
          className="inline-flex h-10 items-center justify-center rounded-lg border border-border bg-background px-4 text-sm font-medium shadow-sm transition-colors hover:bg-muted disabled:pointer-events-none disabled:opacity-50"
        >
          Cancel
        </button>

        <button
          type="submit"
          disabled={submitting}
          className="inline-flex h-10 items-center justify-center rounded-lg bg-primary px-5 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 disabled:pointer-events-none disabled:opacity-50"
        >
          {submitting ? "Creating school..." : "Create school"}
        </button>
      </div>
    </form>
  );
}
