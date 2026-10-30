"use client";

import { CheckCircle2, FilePlus2, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";

type GenerateInvoiceButtonProps = {
  subscriptionId: string;
  disabled?: boolean;
  alreadyGenerated?: boolean;
};

export function GenerateInvoiceButton({
  subscriptionId,
  disabled = false,
  alreadyGenerated = false,
}: GenerateInvoiceButtonProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handleGenerate() {
    setIsSubmitting(true);
    setError("");

    try {
      const response = await fetch("/api/platform/invoices", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          subscriptionId,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Unable to generate invoice.");
        return;
      }

      router.refresh();
    } catch {
      setError("Unable to generate invoice. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (alreadyGenerated) {
    return (
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled
      >
        <CheckCircle2 />
        Invoice generated
      </Button>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1.5">
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={disabled || isSubmitting}
        onClick={handleGenerate}
      >
        {isSubmitting ? (
          <Loader2 className="animate-spin" />
        ) : (
          <FilePlus2 />
        )}
        {isSubmitting ? "Generating..." : "Generate invoice"}
      </Button>

      {error ? (
        <p className="max-w-[280px] text-right text-[11px] text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
