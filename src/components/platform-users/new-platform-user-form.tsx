"use client";

import { Eye, EyeOff, Loader2, UserPlus } from "lucide-react";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

export function NewPlatformUserForm() {
  const router = useRouter();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("Password123");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setError("");
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/platform/users", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name,
          email,
          password,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(
          typeof data?.error === "string"
            ? data.error
            : "Unable to create the user.",
        );
        return;
      }

      router.push("/platform/users");
      router.refresh();
    } catch {
      setError("Unable to reach the server. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="p-6">
      <div className="grid gap-6">
        <div className="grid gap-2">
          <label
            htmlFor="name"
            className="text-sm font-medium"
          >
            Full name
          </label>

          <input
            id="name"
            name="name"
            type="text"
            autoComplete="name"
            required
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="e.g. Abebe Kebede"
            className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none transition-shadow placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/15"
          />
        </div>

        <div className="grid gap-2">
          <label
            htmlFor="email"
            className="text-sm font-medium"
          >
            Email address
          </label>

          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="e.g. abebe@example.com"
            className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none transition-shadow placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/15"
          />

          <p className="text-xs leading-5 text-muted-foreground">
            This email address will be used to sign in to SKUDA.
          </p>
        </div>

        <div className="grid gap-2">
          <label
            htmlFor="password"
            className="text-sm font-medium"
          >
            Temporary password
          </label>

          <div className="relative">
            <input
              id="password"
              name="password"
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              required
              minLength={8}
              maxLength={128}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="h-10 w-full rounded-lg border border-input bg-background px-3 pr-11 text-sm outline-none transition-shadow placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/15"
            />

            <button
              type="button"
              onClick={() => setShowPassword((current) => !current)}
              className="absolute right-0 top-0 flex h-10 w-10 items-center justify-center text-muted-foreground transition-colors hover:text-foreground"
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? (
                <EyeOff className="size-4" />
              ) : (
                <Eye className="size-4" />
              )}
            </button>
          </div>

          <p className="text-xs leading-5 text-muted-foreground">
            Use a temporary password for local development. Production should
            use a secure invitation or first-login password-change flow.
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
            onClick={() => router.push("/platform/users")}
            disabled={isSubmitting}
            className="inline-flex h-10 items-center justify-center rounded-lg border border-border bg-background px-4 text-sm font-medium transition-colors hover:bg-muted disabled:pointer-events-none disabled:opacity-50"
          >
            Cancel
          </button>

          <button
            type="submit"
            disabled={isSubmitting}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 disabled:pointer-events-none disabled:opacity-60"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Creating...
              </>
            ) : (
              <>
                <UserPlus className="size-4" />
                Create user
              </>
            )}
          </button>
        </div>
      </div>
    </form>
  );
}
