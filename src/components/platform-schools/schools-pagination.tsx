import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

type SchoolsPaginationProps = {
  page: number;
  pageSize: number;
  total: number;
  query: string;
  status: string;
};

export function SchoolsPagination({
  page,
  pageSize,
  total,
  query,
  status,
}: SchoolsPaginationProps) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  if (totalPages <= 1) {
    return null;
  }

  const start = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);

  function href(nextPage: number) {
    const params = new URLSearchParams();

    if (query) {
      params.set("q", query);
    }

    if (status) {
      params.set("status", status);
    }

    if (nextPage > 1) {
      params.set("page", String(nextPage));
    }

    const queryString = params.toString();

    return queryString ? `/platform/schools?${queryString}` : "/platform/schools";
  }

  const pages: Array<number | "ellipsis"> = [];
  const visiblePages = new Set<number>([
    1,
    totalPages,
    page,
    page - 1,
    page + 1,
  ]);

  const sortedPages = [...visiblePages]
    .filter((value) => value >= 1 && value <= totalPages)
    .sort((a, b) => a - b);

  sortedPages.forEach((value, index) => {
    if (index > 0 && value - sortedPages[index - 1] > 1) {
      pages.push("ellipsis");
    }

    pages.push(value);
  });

  return (
    <div className="flex flex-col gap-3 border-t border-border px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-xs text-muted-foreground">
        Showing{" "}
        <span className="font-medium text-foreground">{start}</span>
        {"–"}
        <span className="font-medium text-foreground">{end}</span>
        {" of "}
        <span className="font-medium text-foreground">{total}</span>{" "}
        {total === 1 ? "school" : "schools"}
      </p>

      <div className="flex items-center gap-1">
        {page > 1 ? (
          <Link
            href={href(page - 1)}
            className="inline-flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            aria-label="Previous page"
          >
            <ChevronLeft className="size-4" />
          </Link>
        ) : (
          <span
            className="inline-flex size-8 items-center justify-center rounded-lg text-muted-foreground/35"
            aria-hidden="true"
          >
            <ChevronLeft className="size-4" />
          </span>
        )}

        {pages.map((item, index) =>
          item === "ellipsis" ? (
            <span
              key={`ellipsis-${index}`}
              className="flex size-8 items-center justify-center text-xs text-muted-foreground"
            >
              …
            </span>
          ) : (
            <Link
              key={item}
              href={href(item)}
              aria-current={item === page ? "page" : undefined}
              className={
                item === page
                  ? "inline-flex size-8 items-center justify-center rounded-lg bg-primary text-xs font-medium text-primary-foreground"
                  : "inline-flex size-8 items-center justify-center rounded-lg text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              }
            >
              {item}
            </Link>
          ),
        )}

        {page < totalPages ? (
          <Link
            href={href(page + 1)}
            className="inline-flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            aria-label="Next page"
          >
            <ChevronRight className="size-4" />
          </Link>
        ) : (
          <span
            className="inline-flex size-8 items-center justify-center rounded-lg text-muted-foreground/35"
            aria-hidden="true"
          >
            <ChevronRight className="size-4" />
          </span>
        )}
      </div>
    </div>
  );
}
