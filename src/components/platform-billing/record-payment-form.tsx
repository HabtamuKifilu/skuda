"use client";

import {
  AlertCircle,
  CheckCircle2,
  CreditCard,
  Loader2,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type PaymentStatus = "PENDING" | "SUCCEEDED" | "FAILED";

type RecordPaymentFormProps = {
  invoiceId: string;
  currency: string;
  outstandingAmount: number;
  disabled?: boolean;
};

const inputClassName =
  "flex h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-ring focus:ring-2 focus:ring-ring/20";

const selectClassName =
  "flex h-10 w-full appearance-none rounded-lg border border-input bg-background px-3 text-sm outline-none transition-colors focus:border-ring focus:ring-2 focus:ring-ring/20";

function formatAmount(amount: number, currency: string) {
  return new Intl.NumberFormat("en", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function RecordPaymentForm({
  invoiceId,
  currency,
  outstandingAmount,
  disabled = false,
}: RecordPaymentFormProps) {
  const router = useRouter();

  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState(
    outstandingAmount > 0 ? outstandingAmount.toFixed(2) : "",
  );
  const [status, setStatus] =
    useState<PaymentStatus>("SUCCEEDED");
  const [paymentMethod, setPaymentMethod] = useState("");
  const [externalReference, setExternalReference] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const amountNumber = Number(amount);

  const amountError = useMemo(() => {
    if (!amount) {
      return "";
    }

    if (!Number.isFinite(amountNumber) || amountNumber <= 0) {
      return "Enter a valid payment amount.";
    }

    if (amountNumber > outstandingAmount) {
      return "Payment amount cannot exceed the outstanding balance.";
    }

    return "";
  }, [amount, amountNumber, outstandingAmount]);

  function openForm() {
    setAmount(
      outstandingAmount > 0 ? outstandingAmount.toFixed(2) : "",
    );
    setStatus("SUCCEEDED");
    setPaymentMethod("");
    setExternalReference("");
    setError("");
    setSuccess("");
    setOpen(true);
  }

  function closeForm() {
    if (submitting) {
      return;
    }

    setOpen(false);
    setError("");
    setSuccess("");
  }

  async function handleSubmit(
    event: React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    setError("");
    setSuccess("");

    if (
      !Number.isFinite(amountNumber) ||
      amountNumber <= 0
    ) {
      setError("Enter a valid payment amount.");
      return;
    }

    if (amountNumber > outstandingAmount) {
      setError(
        "Payment amount cannot exceed the outstanding balance.",
      );
      return;
    }

    setSubmitting(true);

    try {
      const response = await fetch(
        `/api/platform/invoices/${invoiceId}/payments`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            amount: amountNumber,
            status,
            paymentMethod: paymentMethod.trim() || undefined,
            externalReference:
              externalReference.trim() || undefined,
          }),
        },
      );

      const body = await response.json();

      if (!response.ok) {
        throw new Error(
          body.error || "Unable to record the payment.",
        );
      }

      setSuccess(
        status === "SUCCEEDED"
          ? "Payment recorded successfully."
          : "Payment record created successfully.",
      );

      router.refresh();

      window.setTimeout(() => {
        setOpen(false);
        setSuccess("");
      }, 700);
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Unable to record the payment.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (disabled || outstandingAmount <= 0) {
    return null;
  }

  return (
    <div className="border-b border-border">
      {!open ? (
        <div className="flex items-center justify-between gap-4 px-5 py-3">
          <div className="min-w-0">
            <p className="text-xs font-medium">
              Outstanding balance
            </p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              Record a payment against the remaining invoice balance.
            </p>
          </div>

          <button
            type="button"
            onClick={openForm}
            className="inline-flex h-9 shrink-0 items-center gap-2 rounded-lg bg-primary px-3.5 text-xs font-medium text-primary-foreground transition-opacity hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-ring/30 disabled:pointer-events-none disabled:opacity-50"
          >
            <CreditCard className="size-3.5" />
            Record payment
          </button>
        </div>
      ) : (
        <form
          onSubmit={handleSubmit}
          className="bg-muted/20 px-5 py-5"
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="text-sm font-semibold">
                Record payment
              </h3>

              <p className="mt-1 text-xs text-muted-foreground">
                Outstanding balance:{" "}
                <span className="font-medium text-foreground">
                  {formatAmount(
                    outstandingAmount,
                    currency,
                  )}
                </span>
              </p>
            </div>

            <button
              type="button"
              onClick={closeForm}
              disabled={submitting}
              className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg border border-border bg-background text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-50"
              aria-label="Close payment form"
            >
              <X className="size-4" />
            </button>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <div>
              <label
                htmlFor="payment-amount"
                className="mb-1.5 block text-xs font-medium"
              >
                Amount
              </label>

              <div className="relative">
                <input
                  id="payment-amount"
                  name="amount"
                  type="number"
                  min="0.01"
                  max={outstandingAmount}
                  step="0.01"
                  value={amount}
                  onChange={(event) => {
                    setAmount(event.target.value);
                    setError("");
                  }}
                  className={`${inputClassName} pr-16`}
                  disabled={submitting}
                  required
                />

                <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs font-medium text-muted-foreground">
                  {currency}
                </span>
              </div>

              {amountError ? (
                <p className="mt-1.5 text-[11px] text-destructive">
                  {amountError}
                </p>
              ) : null}
            </div>

            <div>
              <label
                htmlFor="payment-status"
                className="mb-1.5 block text-xs font-medium"
              >
                Payment status
              </label>

              <select
                id="payment-status"
                name="status"
                value={status}
                onChange={(event) =>
                  setStatus(
                    event.target.value as PaymentStatus,
                  )
                }
                className={selectClassName}
                disabled={submitting}
              >
                <option value="SUCCEEDED">Succeeded</option>
                <option value="PENDING">Pending</option>
                <option value="FAILED">Failed</option>
              </select>
            </div>

            <div>
              <label
                htmlFor="payment-method"
                className="mb-1.5 block text-xs font-medium"
              >
                Payment method
                <span className="ml-1 font-normal text-muted-foreground">
                  Optional
                </span>
              </label>

              <input
                id="payment-method"
                name="paymentMethod"
                type="text"
                maxLength={100}
                placeholder="Bank transfer, cash, etc."
                value={paymentMethod}
                onChange={(event) =>
                  setPaymentMethod(event.target.value)
                }
                className={inputClassName}
                disabled={submitting}
              />
            </div>

            <div>
              <label
                htmlFor="external-reference"
                className="mb-1.5 block text-xs font-medium"
              >
                External reference
                <span className="ml-1 font-normal text-muted-foreground">
                  Optional
                </span>
              </label>

              <input
                id="external-reference"
                name="externalReference"
                type="text"
                maxLength={200}
                placeholder="Transaction or receipt reference"
                value={externalReference}
                onChange={(event) =>
                  setExternalReference(event.target.value)
                }
                className={inputClassName}
                disabled={submitting}
              />
            </div>
          </div>

          {status === "SUCCEEDED" ? (
            <div className="mt-4 flex items-start gap-2.5 rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-3.5 py-3">
              <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />

              <p className="text-xs leading-5 text-muted-foreground">
                A successful payment reduces the outstanding balance
                and automatically marks the invoice paid when the
                full balance is settled.
              </p>
            </div>
          ) : null}

          {error ? (
            <div className="mt-4 flex items-start gap-2.5 rounded-lg border border-destructive/20 bg-destructive/5 px-3.5 py-3">
              <AlertCircle className="mt-0.5 size-4 shrink-0 text-destructive" />

              <p className="text-xs leading-5 text-destructive">
                {error}
              </p>
            </div>
          ) : null}

          {success ? (
            <div className="mt-4 flex items-start gap-2.5 rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-3.5 py-3">
              <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />

              <p className="text-xs leading-5 text-emerald-700 dark:text-emerald-400">
                {success}
              </p>
            </div>
          ) : null}

          <div className="mt-5 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={closeForm}
              disabled={submitting}
              className="inline-flex h-9 items-center rounded-lg border border-border bg-background px-3.5 text-xs font-medium transition-colors hover:bg-muted disabled:pointer-events-none disabled:opacity-50"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={
                submitting ||
                Boolean(amountError) ||
                !amount ||
                amountNumber <= 0 ||
                amountNumber > outstandingAmount
              }
              className="inline-flex h-9 items-center gap-2 rounded-lg bg-primary px-3.5 text-xs font-medium text-primary-foreground transition-opacity hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-ring/30 disabled:pointer-events-none disabled:opacity-50"
            >
              {submitting ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" />
                  Recording…
                </>
              ) : (
                <>
                  <CreditCard className="size-3.5" />
                  Record payment
                </>
              )}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
