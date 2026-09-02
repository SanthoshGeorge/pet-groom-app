"use client";

// `ForgotPasswordForm` per frontend-components.md's spec. NO MOCKUP COVERS THIS SCREEN — see
// AuthCard.module.css's header comment.
//
// BR-AUTH-3 compliance: `requestPasswordReset` (src/app/(public)/_lib/api.ts, calling
// `POST /api/auth/forgot-password`) returns the exact same response whether or not the email
// matches an account (the route never inspects the result further — see that route's own
// header comment on the known "no email actually sent yet" backend gap, which is invisible
// to this component: it renders the same success state either way, same as the real
// eventual behavior once an EmailSender is wired). This form shows exactly one confirmation
// state (`submitted`) and never branches on whether the email was "found."
import { useState, type FormEvent } from "react";
import Link from "next/link";
import { ApiError, requestPasswordReset } from "../../_lib/api";
import styles from "../_auth/AuthCard.module.css";

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!email.trim()) {
      setError("Enter your email address.");
      return;
    }
    setSubmitting(true);
    try {
      await requestPasswordReset(email.trim());
      setSubmitted(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <div className={styles.page}>
        <h1 className={styles.title}>Check Your Email</h1>
        <div className={styles.card}>
          <p className={styles.success} data-testid="forgot-password-form-confirmation">
            If an account exists for that email, we&apos;ve sent a link to reset your password.
          </p>
          <Link href="/login" className={`${styles.submitButton} ${styles.linkButton}`} data-testid="forgot-password-form-back-to-login-link">
            Back to Log In
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>Forgot Password</h1>
      <p className={styles.subtitle}>
        Enter the email on your account and we&apos;ll send you a link to reset your password.
      </p>
      <form className={styles.card} onSubmit={handleSubmit} noValidate>
        {error ? (
          <p className={styles.error} data-testid="forgot-password-form-error">
            {error}
          </p>
        ) : null}
        <div className={styles.fieldGroup}>
          <label className={styles.label} htmlFor="forgot-password-email">
            Email
          </label>
          <input
            id="forgot-password-email"
            className={styles.field}
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            data-testid="forgot-password-form-email-input"
          />
        </div>
        <button type="submit" className={styles.submitButton} disabled={submitting} data-testid="forgot-password-form-submit-button">
          {submitting ? "Sending…" : "Send Reset Link"}
        </button>
        <p className={styles.smallNote}>
          Remembered it?{" "}
          <Link href="/login" data-testid="forgot-password-form-login-link">
            Log in
          </Link>
        </p>
      </form>
    </div>
  );
}
