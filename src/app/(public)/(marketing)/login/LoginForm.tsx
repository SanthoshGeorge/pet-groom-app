"use client";

// `LoginForm` per frontend-components.md's spec. NO MOCKUP COVERS THIS SCREEN — built from
// the spec's props/state/interaction list, not a pixel reference (see AuthCard.module.css's
// header comment).
//
// BR-AUTH-3 compliance: `login` (src/app/(public)/_lib/api.ts) throws the SAME generic
// "Invalid email or password" message whether the email is unknown or the password is
// wrong (auth/errors.ts's `InvalidCredentialsError`). This component renders that message
// verbatim (`err.message`) and adds no branching of its own that could leak which
// precondition failed.
import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ApiError, login } from "../../_lib/api";
import styles from "../_auth/AuthCard.module.css";

export function LoginForm({ redirectTo = "/account/pets" }: { redirectTo?: string }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!email.trim() || !password) {
      setError("Enter your email and password.");
      return;
    }
    setSubmitting(true);
    try {
      await login({ email: email.trim(), password });
      router.push(redirectTo);
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong logging you in.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>Log In</h1>
      <p className={styles.subtitle}>Welcome back — log in to manage your pets and bookings.</p>
      <form className={styles.card} onSubmit={handleSubmit} noValidate>
        {error ? (
          <p className={styles.error} data-testid="login-form-error">
            {error}
          </p>
        ) : null}
        <div className={styles.fieldGroup}>
          <label className={styles.label} htmlFor="login-email">
            Email
          </label>
          <input
            id="login-email"
            className={styles.field}
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            data-testid="login-form-email-input"
          />
        </div>
        <div className={styles.fieldGroup}>
          <label className={styles.label} htmlFor="login-password">
            Password
          </label>
          <input
            id="login-password"
            className={styles.field}
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            data-testid="login-form-password-input"
          />
        </div>
        <div className={styles.linkRow}>
          <Link href="/forgot-password" className={styles.link} data-testid="login-form-forgot-password-link">
            Forgot password?
          </Link>
        </div>
        <button type="submit" className={styles.submitButton} disabled={submitting} data-testid="login-form-submit-button">
          {submitting ? "Logging in…" : "Log In"}
        </button>
        <p className={styles.smallNote}>
          Don&apos;t have an account?{" "}
          <Link href="/signup" data-testid="login-form-signup-link">
            Sign up
          </Link>
        </p>
      </form>
    </div>
  );
}
