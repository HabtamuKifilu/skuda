"use client";

import { ArrowUpRight } from "lucide-react";
import { useState } from "react";
import { SchoolDetailsModal } from "./school-details-modal";

type SchoolDetails = {
  id: string;
  name: string;
  slug: string;
  code: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  country: string;
  timezone: string;
  currency: string;
  isActive: boolean;
  createdAt: string;
  students: number;
  staff: number;
  memberships: number;
  owner: {
    name: string;
    email: string;
    image: string | null;
  } | null;
};

export function SchoolDetailsModalTrigger({
  school,
}: {
  school: SchoolDetails;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex h-8 items-center justify-center gap-1.5 rounded-lg px-2.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      >
        Details
        <ArrowUpRight className="size-3.5" />
      </button>

      {open ? (
        <SchoolDetailsModal
          school={school}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </>
  );
}
