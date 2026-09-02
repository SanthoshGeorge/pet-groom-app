"use client";

// `ResetPasswordForm` per frontend-components.md's spec. NO MOCKUP COVERS THIS SCREEN — see
// AuthCard.module.css's header comment. `token` comes from the emailed link's URL
// (`/reset-password?token=...`) — read server-side by `page.tsx` and passed down as the
// spec's documented `token` prop, same pattern `/login`'s `redirectTo` and
// `/manage-booking`'s `?ref=` already use.
//
// BR-AUTH-3 compliance: `resetPassword` throws the SAME generic "This password reset link
// is invalid or has expired" message whether the token is malformed, expired, unknown, or
// already used (auth/errors.ts's `InvalidResetTokenError`) — rendered verbatim, no added
// branching. On success, the user is prompted to log in again rather than being logged in
// automatically (the route itself sets no session cookie — BR-AUTH-3's "all prior sessions
// invalidated" applies here too).
import { useState, type FormEvent } from "react";
import Link from "next/link";
import { ApiError, resetPassword } from "../../_lib/api";
import styles from "../_auth/AuthCard.module.css";

export function ResetPasswordForm({ token }: { token: string }) {
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const missingToken = !token;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (missingToken) {
      setError("This reset link is missing or invalid. Request a new one.");
      return;
    }
    if (newPassword.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Passwords don't match.");
      return;
    }
    setSubmitting(true);
    try {
      await resetPassword(token, newPassword);
      setSuccess(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong resetting your password.");
    } finally {
      setSubmitting(false);
    }
  }

  if (success) {
    return (
      <div className={styles.page}>
        <h1 className={styles.title}>Password Reset</h1>
        <div className={styles.card}>
          <p className={styles.success} data-testid="reset-password-form-confirmation">
            Your password has been reset. Please log in with your new password.
          </p>
          <Link href="/login" className={`${styles.submitButton} ${styles.linkButton}`} data-testid="reset-password-form-login-link">
            Log In
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>Reset Password</h1>
      <p className={styles.subtitle}>Choose a new password for your account.</p>
      <form className={styles.card} onSubmit={handleSubmit} noValidate>
        {missingToken ? (
          <p className={styles.error} data-testid="reset-password-form-missing-token">
            This reset link is missing or invalid.{" "}
            <Link href="/forgot-password" data-testid="reset-password-form-request-new-link">
              Request a new one
            </Link>
            .
          </p>
        ) : null}
        {error ? (
          <p className={styles.error} data-testid="reset-password-form-error">
            {error}
          </p>
        ) : null}
        <div className={styles.fieldGroup}>
          <label className={styles.label} htmlFor="reset-password-new">
            New password
          </label>
          <input
            id="reset-password-new"
            className={styles.field}
            type="password"
            autoComplete="new-password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            data-testid="reset-password-form-new-password-input"
          />
        </div>
        <div className={styles.fieldGroup}>
          <label className={styles.label} htmlFor="reset-password-confirm">
            Confirm new password
          </label>
          <input
            id="reset-password-confirm"
            className={styles.field}
            type="password"
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            data-testid="reset-password-form-confirm-password-input"
          />
        </div>
        <p className={styles.hint}>Must be at least 8 characters.</p>
        <button
          type="submit"
          className={styles.submitButton}
          disabled={submitting || missingToken}
          data-testid="reset-password-form-submit-button"
        >
          {submitting ? "Resetting…" : "Reset Password"}
        </button>
      </form>
    </div>
  );
}
