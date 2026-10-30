"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

type SchoolRole =
  | "OWNER"
  | "ADMIN"
  | "ACADEMIC_HEAD"
  | "ACCOUNTANT"
  | "TEACHER"
  | "REGISTRAR"
  | "HR_MANAGER"
  | "PARENT"
  | "STUDENT";

type User = {
  id: string;
  name: string;
  email: string;
  image: string | null;
};

type NewSchoolMemberFormProps = {
  schoolId: string;
};

const roles: Array<{ value: SchoolRole; label: string }> = [
  { value: "OWNER", label: "Owner" },
  { value: "ADMIN", label: "Administrator" },
  { value: "ACADEMIC_HEAD", label: "Academic Head" },
  { value: "ACCOUNTANT", label: "Accountant" },
  { value: "TEACHER", label: "Teacher" },
  { value: "REGISTRAR", label: "Registrar" },
  { value: "HR_MANAGER", label: "HR Manager" },
  { value: "PARENT", label: "Parent" },
  { value: "STUDENT", label: "Student" },
];

export function NewSchoolMemberForm({
  schoolId,
}: NewSchoolMemberFormProps) {
  const router = useRouter();

  const [users, setUsers] = useState<User[]>([]);
  const [userId, setUserId] = useState("");
  const [role, setRole] = useState<SchoolRole>("TEACHER");
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
            role,
          }),
        },
      );

      const data = await response.json();

      if (!response.ok) {
        setError(data.error ?? "Unable to add the school member.");
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
      <div className="grid gap-6 md:grid-cols-2">
        <div className="space-y-2">
          <label htmlFor="member-user" className="text-sm font-medium">
            User
          </label>

          <select
            id="member-user"
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

          <p className="text-xs text-muted-foreground">
            Only users who are not already active members of this school are
            shown.
          </p>
        </div>

        <div className="space-y-2">
          <label htmlFor="member-role" className="text-sm font-medium">
            School role
          </label>

          <select
            id="member-role"
            value={role}
            onChange={(event) =>
              setRole(event.target.value as SchoolRole)
            }
            className={inputClassName}
            disabled={submitting}
            required
          >
            {roles.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>

          <p className="text-xs text-muted-foreground">
            This role controls what the user can access within this school.
          </p>
        </div>
      </div>

      {!loadingUsers && users.length === 0 && !error ? (
        <div className="rounded-lg border border-border bg-muted/40 px-4 py-4">
          <p className="text-sm font-medium">No available users</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Every existing user is already an active member of this school,
            or no users have been registered yet.
          </p>
        </div>
      ) : null}

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
          {submitting ? "Adding member..." : "Add member"}
        </button>
      </div>
    </form>
  );
}
