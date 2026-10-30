"use client";

import {
  AlertCircle,
  CheckCircle2,
  CircleDollarSign,
  Loader2,
  School,
  WalletCards,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type SubscriptionStatus = "ACTIVE" | "TRIALING";
type BillingCycle = "MONTHLY" | "ANNUAL";

type SchoolOption = {
  id: string;
  name: string;
  code: string | null;
  city: string | null;
  country: string;
  currency: string;
  isActive: boolean;
};

type PlanOption = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  currency: string;
  monthlyPrice: string;
  annualPrice: string;
  maxStudents: number | null;
  maxStaff: number | null;
  maxAdmins: number | null;
  isActive: boolean;
  isPublic: boolean;
};

type FormValues = {
  schoolId: string;
  planId: string;
  status: SubscriptionStatus;
  billingCycle: BillingCycle;
  startDate: string;
  trialEndsAt: string;
};

const inputClassName =
  "flex h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-ring focus:ring-2 focus:ring-ring/20";

const selectClassName =
  "flex h-10 w-full appearance-none rounded-lg border border-input bg-background px-3 text-sm outline-none transition-colors focus:border-ring focus:ring-2 focus:ring-ring/20";

function getToday() {
  const now = new Date();

  return [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
  ].join("-");
}

function formatPrice(value: string, currency: string) {
  const amount = Number(value);

  if (!Number.isFinite(amount)) {
    return `${currency} ${value}`;
  }

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

function formatLimit(value: number | null) {
  return value === null ? "Unlimited" : value.toLocaleString();
}

function getErrorMessage(body: { error?: string }) {
  if (!body.error) {
    return "Unable to create the subscription.";
  }

  return body.error;
}

export function NewSubscriptionForm() {
  const router = useRouter();

  const [schools, setSchools] = useState<SchoolOption[]>([]);
  const [plans, setPlans] = useState<PlanOption[]>([]);

  const [values, setValues] = useState<FormValues>({
    schoolId: "",
    planId: "",
    status: "ACTIVE",
    billingCycle: "MONTHLY",
    startDate: getToday(),
    trialEndsAt: "",
  });

  const [loadingOptions, setLoadingOptions] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadOptions() {
      setLoadingOptions(true);
      setError("");

      try {
        const [schoolsResponse, plansResponse] = await Promise.all([
          fetch("/api/platform/schools", {
            method: "GET",
            cache: "no-store",
          }),
          fetch("/api/platform/plans", {
            method: "GET",
            cache: "no-store",
          }),
        ]);

        const [schoolsBody, plansBody] = await Promise.all([
          schoolsResponse.json(),
          plansResponse.json(),
        ]);

        if (!schoolsResponse.ok) {
          throw new Error(
            getErrorMessage(schoolsBody) ||
              "Unable to load schools.",
          );
        }

        if (!plansResponse.ok) {
          throw new Error(
            getErrorMessage(plansBody) ||
              "Unable to load plans.",
          );
        }

        if (cancelled) {
          return;
        }

        setSchools(
          (schoolsBody.schools ?? []).filter(
            (school: SchoolOption) => school.isActive,
          ),
        );

        setPlans(
          (plansBody.plans ?? []).filter(
            (plan: PlanOption) => plan.isActive,
          ),
        );
      } catch (loadError) {
        if (!cancelled) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Unable to load subscription options.",
          );
        }
      } finally {
        if (!cancelled) {
          setLoadingOptions(false);
        }
      }
    }

    void loadOptions();

    return () => {
      cancelled = true;
    };
  }, []);

  const selectedSchool = useMemo(
    () => schools.find((school) => school.id === values.schoolId) ?? null,
    [schools, values.schoolId],
  );

  const selectedPlan = useMemo(
    () => plans.find((plan) => plan.id === values.planId) ?? null,
    [plans, values.planId],
  );

  const currencyMismatch =
    selectedSchool &&
    selectedPlan &&
    selectedSchool.currency !== selectedPlan.currency;

  const selectedPrice = selectedPlan
    ? values.billingCycle === "MONTHLY"
      ? selectedPlan.monthlyPrice
      : selectedPlan.annualPrice
    : null;

  function updateValue<K extends keyof FormValues>(
    key: K,
    value: FormValues[K],
  ) {
    setValues((current) => ({
      ...current,
      [key]: value,
    }));

    setError("");
  }

  function handleStatusChange(status: SubscriptionStatus) {
    setValues((current) => ({
      ...current,
      status,
      trialEndsAt: status === "TRIALING" ? current.trialEndsAt : "",
    }));

    setError("");
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!values.schoolId) {
      setError("Select a school.");
      return;
    }

    if (!values.planId) {
      setError("Select a plan.");
      return;
    }

    if (!values.startDate) {
      setError("Select a subscription start date.");
      return;
    }

    if (values.status === "TRIALING" && !values.trialEndsAt) {
      setError("Select a trial end date for a trialing subscription.");
      return;
    }

    if (
      values.status === "TRIALING" &&
      values.trialEndsAt &&
      values.trialEndsAt <= values.startDate
    ) {
      setError("Trial end date must be after the subscription start date.");
      return;
    }

    if (currencyMismatch) {
      setError("School currency does not match the selected plan currency.");
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      const response = await fetch("/api/platform/subscriptions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          schoolId: values.schoolId,
          planId: values.planId,
          status: values.status,
          billingCycle: values.billingCycle,
          startDate: values.startDate,
          trialEndsAt:
            values.status === "TRIALING" ? values.trialEndsAt : null,
        }),
      });

      const body = await response.json();

      if (!response.ok) {
        setError(getErrorMessage(body));
        return;
      }

      if (!body.subscription?.id) {
        setError("The subscription was created but no subscription ID was returned.");
        return;
      }

      router.push(`/platform/subscriptions/${body.subscription.id}`);
      router.refresh();
    } catch {
      setError("Unable to reach the subscription service. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      {error ? (
        <div className="border-b border-destructive/20 bg-destructive/5 px-5 py-3.5 sm:px-6">
          <div className="flex items-start gap-2.5 text-sm text-destructive">
            <AlertCircle className="mt-0.5 size-4 shrink-0" strokeWidth={1.8} />
            <p>{error}</p>
          </div>
        </div>
      ) : null}

      <div className="grid gap-0 lg:grid-cols-[minmax(0,1.4fr)_minmax(320px,0.8fr)]">
        <div className="min-w-0 border-b border-border lg:border-b-0 lg:border-r">
          <div className="border-b border-border px-5 py-5 sm:px-6">
            <div className="flex items-center gap-2">
              <School className="size-4 text-primary" strokeWidth={1.8} />
              <h3 className="text-sm font-semibold">Assignment</h3>
            </div>

            <div className="mt-5 grid gap-5 sm:grid-cols-2">
              <div>
                <label
                  htmlFor="subscription-school"
                  className="text-xs font-medium"
                >
                  School
                </label>

                <select
                  id="subscription-school"
                  value={values.schoolId}
                  onChange={(event) =>
                    updateValue("schoolId", event.target.value)
                  }
                  disabled={loadingOptions || submitting}
                  className={`${selectClassName} mt-2`}
                >
                  <option value="">
                    {loadingOptions ? "Loading schools..." : "Select school"}
                  </option>

                  {schools.map((school) => (
                    <option key={school.id} value={school.id}>
                      {school.name}
                      {school.code ? ` · ${school.code}` : ""}
                    </option>
                  ))}
                </select>

                {selectedSchool ? (
                  <p className="mt-1.5 text-xs text-muted-foreground">
                    {selectedSchool.city || selectedSchool.country} ·{" "}
                    {selectedSchool.currency}
                  </p>
                ) : (
                  <p className="mt-1.5 text-xs text-muted-foreground">
                    Only active schools are available.
                  </p>
                )}
              </div>

              <div>
                <label
                  htmlFor="subscription-plan"
                  className="text-xs font-medium"
                >
                  Plan
                </label>

                <select
                  id="subscription-plan"
                  value={values.planId}
                  onChange={(event) =>
                    updateValue("planId", event.target.value)
                  }
                  disabled={loadingOptions || submitting}
                  className={`${selectClassName} mt-2`}
                >
                  <option value="">
                    {loadingOptions ? "Loading plans..." : "Select plan"}
                  </option>

                  {plans.map((plan) => (
                    <option key={plan.id} value={plan.id}>
                      {plan.name} · {plan.currency}
                    </option>
                  ))}
                </select>

                <p className="mt-1.5 text-xs text-muted-foreground">
                  Only active plans are available.
                </p>
              </div>
            </div>
          </div>

          <div className="border-b border-border px-5 py-5 sm:px-6">
            <div className="flex items-center gap-2">
              <WalletCards className="size-4 text-primary" strokeWidth={1.8} />
              <h3 className="text-sm font-semibold">Billing</h3>
            </div>

            <div className="mt-5 grid gap-5 sm:grid-cols-2">
              <div>
                <label
                  htmlFor="subscription-cycle"
                  className="text-xs font-medium"
                >
                  Billing cycle
                </label>

                <select
                  id="subscription-cycle"
                  value={values.billingCycle}
                  onChange={(event) =>
                    updateValue(
                      "billingCycle",
                      event.target.value as BillingCycle,
                    )
                  }
                  disabled={submitting}
                  className={`${selectClassName} mt-2`}
                >
                  <option value="MONTHLY">Monthly</option>
                  <option value="ANNUAL">Annual</option>
                </select>
              </div>

              <div>
                <label
                  htmlFor="subscription-status"
                  className="text-xs font-medium"
                >
                  Initial status
                </label>

                <select
                  id="subscription-status"
                  value={values.status}
                  onChange={(event) =>
                    handleStatusChange(
                      event.target.value as SubscriptionStatus,
                    )
                  }
                  disabled={submitting}
                  className={`${selectClassName} mt-2`}
                >
                  <option value="ACTIVE">Active</option>
                  <option value="TRIALING">Trialing</option>
                </select>

                <p className="mt-1.5 text-xs text-muted-foreground">
                  Other lifecycle states are managed after creation.
                </p>
              </div>
            </div>

            <div className="mt-5 grid gap-5 sm:grid-cols-2">
              <div>
                <label
                  htmlFor="subscription-start"
                  className="text-xs font-medium"
                >
                  Start date
                </label>

                <input
                  id="subscription-start"
                  type="date"
                  value={values.startDate}
                  onChange={(event) =>
                    updateValue("startDate", event.target.value)
                  }
                  disabled={submitting}
                  className={`${inputClassName} mt-2`}
                />
              </div>

              {values.status === "TRIALING" ? (
                <div>
                  <label
                    htmlFor="subscription-trial-end"
                    className="text-xs font-medium"
                  >
                    Trial end date
                  </label>

                  <input
                    id="subscription-trial-end"
                    type="date"
                    value={values.trialEndsAt}
                    min={values.startDate || undefined}
                    onChange={(event) =>
                      updateValue("trialEndsAt", event.target.value)
                    }
                    disabled={submitting}
                    className={`${inputClassName} mt-2`}
                  />

                  <p className="mt-1.5 text-xs text-muted-foreground">
                    The subscription period will end at the trial date.
                  </p>
                </div>
              ) : null}
            </div>
          </div>

          <div className="flex flex-col-reverse gap-3 px-5 py-5 sm:flex-row sm:items-center sm:justify-end sm:px-6">
            <button
              type="button"
              onClick={() => router.push("/platform/subscriptions")}
              disabled={submitting}
              className="inline-flex h-10 items-center justify-center rounded-lg border border-border bg-background px-4 text-sm font-medium transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={
                submitting ||
                loadingOptions ||
                !values.schoolId ||
                !values.planId ||
                Boolean(currencyMismatch)
              }
              className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting ? (
                <>
                  <Loader2 className="size-4 animate-spin" strokeWidth={1.8} />
                  Creating...
                </>
              ) : (
                <>
                  <CheckCircle2 className="size-4" strokeWidth={1.8} />
                  Create subscription
                </>
              )}
            </button>
          </div>
        </div>

        <aside className="min-w-0 bg-muted/20">
          <div className="px-5 py-5 sm:px-6">
            <div className="flex items-center gap-2">
              <CircleDollarSign
                className="size-4 text-primary"
                strokeWidth={1.8}
              />
              <h3 className="text-sm font-semibold">Subscription preview</h3>
            </div>

            {!selectedSchool && !selectedPlan ? (
              <div className="mt-5 rounded-lg border border-dashed border-border bg-background px-4 py-5">
                <p className="text-sm font-medium">Select a school and plan</p>
                <p className="mt-1.5 text-xs leading-5 text-muted-foreground">
                  Pricing, currency, and capacity information will appear
                  here before the subscription is created.
                </p>
              </div>
            ) : (
              <div className="mt-5 space-y-4">
                {selectedSchool ? (
                  <div className="rounded-lg border border-border bg-background p-4">
                    <p className="text-[11px] font-medium uppercase tracking-[0.1em] text-muted-foreground">
                      School
                    </p>
                    <p className="mt-1.5 text-sm font-semibold">
                      {selectedSchool.name}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {selectedSchool.code || "No school code"} ·{" "}
                      {selectedSchool.currency}
                    </p>
                  </div>
                ) : null}

                {selectedPlan ? (
                  <div className="rounded-lg border border-border bg-background p-4">
                    <p className="text-[11px] font-medium uppercase tracking-[0.1em] text-muted-foreground">
                      Plan
                    </p>

                    <div className="mt-1.5 flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold">
                          {selectedPlan.name}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {selectedPlan.description || "No plan description"}
                        </p>
                      </div>

                      {selectedPrice ? (
                        <p className="shrink-0 text-sm font-semibold">
                          {formatPrice(
                            selectedPrice,
                            selectedPlan.currency,
                          )}
                        </p>
                      ) : null}
                    </div>

                    <div className="mt-4 grid grid-cols-3 gap-2 border-t border-border pt-3">
                      <div>
                        <p className="text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
                          Students
                        </p>
                        <p className="mt-1 text-xs font-medium">
                          {formatLimit(selectedPlan.maxStudents)}
                        </p>
                      </div>

                      <div>
                        <p className="text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
                          Staff
                        </p>
                        <p className="mt-1 text-xs font-medium">
                          {formatLimit(selectedPlan.maxStaff)}
                        </p>
                      </div>

                      <div>
                        <p className="text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
                          Admins
                        </p>
                        <p className="mt-1 text-xs font-medium">
                          {formatLimit(selectedPlan.maxAdmins)}
                        </p>
                      </div>
                    </div>
                  </div>
                ) : null}

                {currencyMismatch ? (
                  <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-4">
                    <div className="flex items-start gap-2.5">
                      <AlertCircle
                        className="mt-0.5 size-4 shrink-0 text-destructive"
                        strokeWidth={1.8}
                      />
                      <div>
                        <p className="text-xs font-semibold text-destructive">
                          Currency mismatch
                        </p>
                        <p className="mt-1 text-xs leading-5 text-destructive/80">
                          The school uses {selectedSchool.currency}, while the
                          selected plan uses {selectedPlan.currency}. Choose a
                          compatible plan before creating the subscription.
                        </p>
                      </div>
                    </div>
                  </div>
                ) : selectedSchool && selectedPlan ? (
                  <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-4">
                    <div className="flex items-start gap-2.5">
                      <CheckCircle2
                        className="mt-0.5 size-4 shrink-0 text-emerald-600"
                        strokeWidth={1.8}
                      />
                      <div>
                        <p className="text-xs font-semibold text-emerald-700">
                          Ready to assign
                        </p>
                        <p className="mt-1 text-xs leading-5 text-muted-foreground">
                          {selectedPlan.currency} billing will be applied on a{" "}
                          {values.billingCycle.toLowerCase()} cycle.
                        </p>
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>
            )}
          </div>
        </aside>
      </div>
    </form>
  );
}
