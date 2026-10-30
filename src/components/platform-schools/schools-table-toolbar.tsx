"use client";

import { ChevronDown, Search, X } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

type SchoolsTableToolbarProps = {
  initialQuery: string;
  initialStatus: string;
};

export function SchoolsTableToolbar({
  initialQuery,
  initialStatus,
}: SchoolsTableToolbarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [query, setQuery] = useState(initialQuery);

  useEffect(() => {
    setQuery(initialQuery);
  }, [initialQuery]);

  useEffect(() => {
    const normalizedQuery = query.trim();
    const currentQuery = searchParams.get("q") ?? "";

    if (normalizedQuery === currentQuery) {
      return;
    }

    const timeout = window.setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString());

      if (normalizedQuery) {
        params.set("q", normalizedQuery);
      } else {
        params.delete("q");
      }

      const queryString = params.toString();

      startTransition(() => {
        router.replace(
          queryString ? `${pathname}?${queryString}` : pathname,
          {
            scroll: false,
          },
        );
      });
    }, 300);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [query, pathname, router, searchParams]);

  function updateStatus(value: string) {
    const params = new URLSearchParams(searchParams.toString());

    if (value === "all") {
      params.delete("status");
    } else {
      params.set("status", value);
    }

    const queryString = params.toString();

    startTransition(() => {
      router.replace(
        queryString ? `${pathname}?${queryString}` : pathname,
        {
          scroll: false,
        },
      );
    });
  }

  function clearSearch() {
    setQuery("");

    const params = new URLSearchParams(searchParams.toString());
    params.delete("q");

    const queryString = params.toString();

    startTransition(() => {
      router.replace(
        queryString ? `${pathname}?${queryString}` : pathname,
        {
          scroll: false,
        },
      );
    });
  }

  function clearFilters() {
    setQuery("");

    startTransition(() => {
      router.replace(pathname, {
        scroll: false,
      });
    });
  }

  const hasFilters = Boolean(query.trim() || initialStatus);

  return (
    <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
      <div className="relative min-w-0 flex-1">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          strokeWidth={1.8}
        />

        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search schools by name, code, or location..."
          aria-label="Search schools"
          className="h-9 w-full rounded-lg border border-input bg-background pl-9 pr-16 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/15"
        />

        {isPending ? (
          <span
            className="pointer-events-none absolute right-9 top-1/2 flex size-4 -translate-y-1/2 items-center justify-center"
            aria-label="Searching"
          >
            <span className="size-3.5 animate-spin rounded-full border-2 border-muted-foreground/25 border-t-primary" />
          </span>
        ) : null}

        {query ? (
          <button
            type="button"
            onClick={clearSearch}
            aria-label="Clear search"
            className="absolute right-2 top-1/2 flex size-6 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <X className="size-3.5" />
          </button>
        ) : null}
      </div>

      <div className="relative shrink-0">
        <select
          value={initialStatus || "all"}
          onChange={(event) => updateStatus(event.target.value)}
          aria-label="Filter schools by status"
          className="h-9 min-w-36 appearance-none rounded-lg border border-input bg-background pl-3 pr-9 text-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/15"
        >
          <option value="all">All statuses</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>

        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
      </div>

      {hasFilters ? (
        <button
          type="button"
          onClick={clearFilters}
          className="inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-lg px-2.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <X className="size-3.5" />
          Clear
        </button>
      ) : null}
    </div>
  );
}
