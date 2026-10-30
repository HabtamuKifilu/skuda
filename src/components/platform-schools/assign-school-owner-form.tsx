"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

type User = {
  id: string;
  name: string;
  email: string;
  image: string | null;
};

type AssignSchoolOwnerFormProps = {
  schoolId: string;
};

export function AssignSchoolOwnerForm({
  schoolId,
}: AssignSchoolOwnerFormProps) {
  const router = useRouter();

  const [users, setUsers] = useState<User[]>([]);
  const [userId, setUserId] = useState("");
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadUsers() {
      setLoadingUsers(true);
      setError("");

      try {
        const response = await fetch(
          `/api/platform/users?schoolId=${encodeURIComponent(schoolId)}`,
        );

        const data = await response.json();

        if (!response.ok) {
          if (!cancelled) {
            setError(data.error ?? "Unable to load users.");
          }
          return;
        }

        if (!cancelled) {
          setUsers(data.users ?? []);
        }
      } catch {
        if (!cancelled) {
          setError(
            "Unable to connect to the platform. Please try again.",
          );
        }
      } finally {
        if (!cancelled) {
          setLoadingUsers(false);
        }
      }
    }

    loadUsers();

    return () => {
      cancelled = true;
    };
  }, [schoolId]);

  async function handleSubmit(
    event: React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();
    setError("");

    if (!userId) {
      setError("Please select a user.");
      return;
    }

    setSubmitting(true);

    try {
      const response = await fetch(
        `/api/platform/schools/${schoolId}/members`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            userId,
            role: "OWNER",
          }),
        },
      );

      const data = await response.json();

      if (!response.ok) {
        setError(data.error ?? "Unable to assign the school owner.");
        return;
      }

      router.push(`/platform/schools/${schoolId}`);
      router.refresh();
    } catch {
      setError("Unable to connect to the platform. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  const inputClassName =
    "flex h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none transition-colors focus:border-ring focus:ring-2 focus:ring-ring/20 disabled:cursor-not-allowed disabled:opacity-50";

  return (
    <form onSubmit={handleSubmit} className="space-y-8 p-6">
      <div className="max-w-2xl space-y-2">
        <label htmlFor="school-owner-user" className="text-sm font-medium">
          School owner
        </label>

        <select
          id="school-owner-user"
          value={userId}
          onChange={(event) => setUserId(event.target.value)}
          className={inputClassName}
          disabled={loadingUsers || submitting}
          required
        >
          <option value="">
            {loadingUsers ? "Loading users..." : "Select a user"}
          </option>

          {users.map((user) => (
            <option key={user.id} value={user.id}>
              {user.name} — {user.email}
            </option>
          ))}
        </select>

        <p className="text-xs leading-5 text-muted-foreground">
          The selected user will become the owner of this school and receive
          full school-level administrative authority.
        </p>
      </div>

      <div className="rounded-xl border border-border bg-muted/40 px-4 py-4">
        <p className="text-sm font-medium">What happens next?</p>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">
          The Platform Owner establishes the school ownership here. After
          that, the School Owner can manage administrators, staff, students,
          parents, and other school operations from the school workspace.
        </p>
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
          onClick={() => router.push(`/platform/schools/${schoolId}`)}
          disabled={submitting}
          className="inline-flex h-10 items-center justify-center rounded-lg border border-border bg-background px-4 text-sm font-medium shadow-sm transition-colors hover:bg-muted disabled:pointer-events-none disabled:opacity-50"
        >
          Cancel
        </button>

        <button
          type="submit"
          disabled={submitting || loadingUsers || users.length === 0}
          className="inline-flex h-10 items-center justify-center rounded-lg bg-primary px-5 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 disabled:pointer-events-none disabled:opacity-50"
        >
          {submitting ? "Assigning owner..." : "Assign school owner"}
        </button>
      </div>
    </form>
  );
}
