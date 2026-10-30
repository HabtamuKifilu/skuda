"use client";

import { Search, X } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

type SchoolsLiveSearchProps = {
  initialQuery: string;
};

export function SchoolsLiveSearch({
  initialQuery,
}: SchoolsLiveSearchProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [value, setValue] = useState(initialQuery);

  useEffect(() => {
    setValue(initialQuery);
  }, [initialQuery]);

  useEffect(() => {
    const normalizedValue = value.trim();
    const currentQuery = searchParams.get("q") ?? "";

    if (normalizedValue === currentQuery) {
      return;
    }

    const timeout = window.setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString());

      if (normalizedValue) {
        params.set("q", normalizedValue);
      } else {
        params.delete("q");
      }

      startTransition(() => {
        const queryString = params.toString();

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
  }, [value, pathname, router, searchParams]);

  function clearSearch() {
    setValue("");

    const params = new URLSearchParams(searchParams.toString());
    params.delete("q");

    startTransition(() => {
      const queryString = params.toString();

      router.replace(
        queryString ? `${pathname}?${queryString}` : pathname,
        {
          scroll: false,
        },
      );
    });
  }

  return (
    <div className="relative min-w-0 flex-1">
      <Search
        className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
        strokeWidth={1.8}
      />

      <input
        type="search"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder="Search schools by name, code, or location..."
        aria-label="Search schools"
        className="h-9 w-full rounded-lg border border-input bg-background pl-9 pr-16 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/15"
      />

      {value ? (
        <button
          type="button"
          onClick={clearSearch}
          aria-label="Clear search"
          className="absolute right-2 top-1/2 flex size-6 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <X className="size-3.5" />
        </button>
      ) : null}

      {isPending ? (
        <span
          className="pointer-events-none absolute right-9 top-1/2 flex size-4 -translate-y-1/2 items-center justify-center"
          aria-label="Searching"
        >
          <span className="size-3.5 animate-spin rounded-full border-2 border-muted-foreground/25 border-t-primary" />
        </span>
      ) : null}
    </div>
  );
}
