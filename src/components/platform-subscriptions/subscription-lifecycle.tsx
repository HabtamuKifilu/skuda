"use client";

import {
  AlertCircle,
  Check,
  ChevronDown,
  Loader2,
  Pause,
  Play,
  RotateCcw,
  X,
} from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";

type SubscriptionStatus =
  | "TRIALING"
  | "ACTIVE"
  | "PAST_DUE"
  | "PAUSED"
  | "CANCELED"
  | "EXPIRED";

const transitions: Record<
  SubscriptionStatus,
  SubscriptionStatus[]
> = {
  TRIALING: ["ACTIVE", "PAUSED", "CANCELED", "EXPIRED"],
  ACTIVE: ["PAST_DUE", "PAUSED", "CANCELED", "EXPIRED"],
  PAST_DUE: ["ACTIVE", "PAUSED", "CANCELED", "EXPIRED"],
  PAUSED: ["ACTIVE", "CANCELED"],
  CANCELED: [],
  EXPIRED: [],
};

function formatStatus(value: SubscriptionStatus) {
  return value
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function actionLabel(status: SubscriptionStatus) {
  switch (status) {
    case "ACTIVE":
      return "Activate";
    case "PAST_DUE":
      return "Mark past due";
    case "PAUSED":
      return "Pause";
    case "CANCELED":
      return "Cancel";
    case "EXPIRED":
      return "Expire";
    default:
      return formatStatus(status);
  }
}

function actionIcon(status: SubscriptionStatus) {
  switch (status) {
    case "ACTIVE":
      return Play;
    case "PAST_DUE":
      return AlertCircle;
    case "PAUSED":
      return Pause;
    case "CANCELED":
      return X;
    case "EXPIRED":
      return Check;
    default:
      return RotateCcw;
  }
}

export function SubscriptionLifecycle({
  subscriptionId,
  currentStatus,
}: {
  subscriptionId: string;
  currentStatus: SubscriptionStatus;
}) {
  const router = useRouter();
  const triggerRef = useRef<HTMLButtonElement>(null);

  const [open, setOpen] = useState(false);
  const [pendingStatus, setPendingStatus] =
    useState<SubscriptionStatus | null>(null);
  const [error, setError] = useState("");
  const [menuPosition, setMenuPosition] = useState({
    top: 0,
    right: 0,
  });

  const availableTransitions = useMemo(
    () => transitions[currentStatus],
    [currentStatus],
  );

  function toggleMenu() {
    if (open) {
      setOpen(false);
      return;
    }

    const rect = triggerRef.current?.getBoundingClientRect();

    if (!rect) {
      return;
    }

    setMenuPosition({
      top: rect.bottom + 8,
      right: window.innerWidth - rect.right,
    });

    setOpen(true);
  }

  async function changeStatus(nextStatus: SubscriptionStatus) {
    setPendingStatus(nextStatus);
    setError("");
    setOpen(false);

    try {
      const response = await fetch(
        `/api/platform/subscriptions/${subscriptionId}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            status: nextStatus,
          }),
        },
      );

      const body = await response.json();

      if (!response.ok) {
        setError(
          body.error || "Unable to update the subscription status.",
        );
        return;
      }

      router.refresh();
    } catch {
      setError(
        "Unable to reach the subscription service. Please try again.",
      );
    } finally {
      setPendingStatus(null);
    }
  }

  if (availableTransitions.length === 0) {
    return (
      <div className="text-right">
        <span className="inline-flex h-9 items-center rounded-lg border border-border bg-muted/30 px-3 text-xs font-medium text-muted-foreground">
          {currentStatus === "CANCELED"
            ? "Canceled · Final"
            : "Expired · Final"}
        </span>
      </div>
    );
  }

  return (
    <>
      <div>
        {error ? (
          <div className="absolute right-0 top-11 z-20 w-72 rounded-lg border border-destructive/20 bg-background p-3 text-xs text-destructive">
            {error}
          </div>
        ) : null}

        <button
          ref={triggerRef}
          type="button"
          onClick={toggleMenu}
          disabled={pendingStatus !== null}
          className="inline-flex h-9 items-center gap-2 rounded-lg border border-border bg-background px-3.5 text-sm font-medium transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pendingStatus ? (
            <>
              <Loader2 className="size-4 animate-spin" strokeWidth={1.8} />
              Updating...
            </>
          ) : (
            <>
              Manage status
              <ChevronDown className="size-3.5" strokeWidth={1.8} />
            </>
          )}
        </button>
      </div>

      {open
        ? createPortal(
            <div
              className="fixed z-[100] w-60 overflow-hidden rounded-lg border border-border bg-popover p-1"
              style={{
                top: menuPosition.top,
                right: menuPosition.right,
              }}
            >
              <div className="px-2.5 py-2">
                <p className="text-[10px] font-medium uppercase tracking-[0.1em] text-muted-foreground">
                  Change status
                </p>
              </div>

              {availableTransitions.map((status) => {
                const Icon = actionIcon(status);

                return (
                  <button
                    key={status}
                    type="button"
                    onClick={() => void changeStatus(status)}
                    className="flex min-h-9 w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-xs font-medium transition-colors hover:bg-muted"
                  >
                    <Icon
                      className="size-3.5 shrink-0 text-muted-foreground"
                      strokeWidth={1.8}
                    />
                    <span>{actionLabel(status)}</span>
                  </button>
                );
              })}
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
