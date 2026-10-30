"use client";

import { FormEvent, useState } from "react";
import { ArrowRight, Eye, EyeOff, Loader2, LockKeyhole, Mail } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isSubmitting) {
      return;
    }

    setError("");
    setIsSubmitting(true);

    try {
      const result = await authClient.signIn.email({
        email: email.trim(),
        password,
        rememberMe,
      });

      if (result.error) {
        setError(
          result.error.message ||
            "Unable to sign in. Please check your credentials.",
        );
        return;
      }

      const platformResponse = await fetch("/api/platform/me", {
        method: "GET",
        cache: "no-store",
      });

      if (platformResponse.ok) {
        router.push("/platform");
      } else {
        router.push("/");
      }
      router.refresh();
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-muted/30">
      <div className="grid min-h-screen lg:grid-cols-[1.05fr_0.95fr]">
        <section className="relative hidden overflow-hidden bg-primary px-12 py-12 text-primary-foreground lg:flex lg:flex-col">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.14),transparent_38%)]" />

          <div className="relative">
            <Link href="/" className="inline-flex items-center gap-2.5">
              <span className="flex size-9 items-center justify-center rounded-xl bg-primary-foreground text-sm font-bold text-primary shadow-sm">
                S
              </span>
              <span className="text-lg font-semibold tracking-tight">
                SKUDA
              </span>
            </Link>
          </div>

          <div className="relative mt-auto max-w-xl pb-8">
            <p className="mb-4 text-sm font-medium uppercase tracking-[0.16em] text-primary-foreground/65">
              School operations platform
            </p>

            <h1 className="max-w-lg text-4xl font-semibold tracking-tight xl:text-5xl">
              Everything your school needs, in one workspace.
            </h1>

            <p className="mt-6 max-w-lg text-base leading-7 text-primary-foreground/75">
              Manage students, academics, attendance, staff, timetables, and
              reporting from a single professional workspace.
            </p>
          </div>

          <p className="relative mt-8 text-xs text-primary-foreground/50">
            Secure access to your SKUDA workspace
          </p>
        </section>

        <section className="flex min-h-screen items-center justify-center px-6 py-10 sm:px-10">
          <div className="w-full max-w-md">
            <div className="mb-8 lg:hidden">
              <Link href="/" className="inline-flex items-center gap-2.5">
                <span className="flex size-9 items-center justify-center rounded-xl bg-primary text-sm font-bold text-primary-foreground shadow-sm">
                  S
                </span>
                <span className="text-lg font-semibold tracking-tight">
                  SKUDA
                </span>
              </Link>
            </div>

            <div className="mb-8">
              <h2 className="text-2xl font-semibold tracking-tight">
                Welcome back
              </h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Sign in to continue to your SKUDA workspace.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <label htmlFor="email" className="text-sm font-medium">
                  Email address
                </label>

                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />

                  <input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="you@school.edu"
                    className="h-11 w-full rounded-lg border border-input bg-background pl-10 pr-3 text-sm outline-none transition-colors placeholder:text-muted-foreground/60 focus:border-ring focus:ring-2 focus:ring-ring/20"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between gap-4">
                  <label htmlFor="password" className="text-sm font-medium">
                    Password
                  </label>

                  <span className="text-right text-xs text-muted-foreground">
                    Contact your administrator if you need help.
                  </span>
                </div>

                <div className="relative">
                  <LockKeyhole className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />

                  <input
                    id="password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="Enter your password"
                    className="h-11 w-full rounded-lg border border-input bg-background pl-10 pr-11 text-sm outline-none transition-colors placeholder:text-muted-foreground/60 focus:border-ring focus:ring-2 focus:ring-ring/20"
                  />

                  <button
                    type="button"
                    onClick={() => setShowPassword((visible) => !visible)}
                    className="absolute right-2 top-1/2 flex size-7 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? (
                      <EyeOff className="size-4" />
                    ) : (
                      <Eye className="size-4" />
                    )}
                  </button>
                </div>
              </div>

              <label className="flex cursor-pointer items-center gap-2.5">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(event) => setRememberMe(event.target.checked)}
                  className="size-4 rounded border-input accent-primary"
                />
                <span className="text-sm text-muted-foreground">
                  Keep me signed in
                </span>
              </label>

              {error ? (
                <div
                  role="alert"
                  className="rounded-lg border border-destructive/20 bg-destructive/5 px-3.5 py-3 text-sm text-destructive"
                >
                  {error}
                </div>
              ) : null}

              <button
                type="submit"
                disabled={isSubmitting}
                className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 disabled:pointer-events-none disabled:opacity-60"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Signing in...
                  </>
                ) : (
                  <>
                    Sign in
                    <ArrowRight className="size-4" />
                  </>
                )}
              </button>
            </form>

            <p className="mt-8 text-center text-xs leading-5 text-muted-foreground">
              By signing in, you agree to use SKUDA in accordance with your
              school&apos;s access policies.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
