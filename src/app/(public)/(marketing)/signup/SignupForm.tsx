"use client";

// `SignupForm` per frontend-components.md's spec. NO MOCKUP COVERS THIS SCREEN — see
// AuthCard.module.css's header comment.
//
// JUDGMENT CALL: the spec's state list only names `email`, `password`, `confirmPassword`,
// `submitting`, `error` — but its own Interaction line calls `auth.registerAccount(email,
// password, ...)` and the real endpoint (`POST /api/auth/register`) requires `name` and
// `phone` too (they're `ContactInfo`, per BR-CUST-1/4 — an account always resolves to an
// `Owner`, which needs a name/phone). The spec's "..." is read as shorthand for that
// omitted `ContactInfo`, not as "these fields don't exist" — so `name`/`phone` state and
// inputs are added here; flagged in the Step 21 report as a spec gap, not a silent addition.
import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ApiError, registerAccount } from "../../_lib/api";
import styles from "../_auth/AuthCard.module.css";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Contact info carried over right after a guest booking, per the spec's `prefill` prop — no
 * caller passes this yet (Step 20's confirmation screen has no "create an account" CTA), but
 * the prop is implemented as specified via `?name=&phone=&email=`, read by `page.tsx`. */
export interface SignupPrefill {
  name?: string;
  phone?: string;
  email?: string;
}

export function SignupForm({ prefill }: { prefill?: SignupPrefill }) {
  const router = useRouter();
  const [name, setName] = useState(prefill?.name ?? "");
  const [phone, setPhone] = useState(prefill?.phone ?? "");
  const [email, setEmail] = useState(prefill?.email ?? "");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError("Enter your name.");
      return;
    }
    if (!phone.trim()) {
      setError("Enter your phone number.");
      return;
    }
    if (!EMAIL_RE.test(email.trim())) {
      setError("Enter a valid email address.");
      return;
    }
    // Client-side mirror of auth/validation.ts's `validatePassword` (8-char minimum) — the
    // server re-checks this regardless; this is UX-only, not the real enforcement.
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords don't match.");
      return;
    }

    setSubmitting(true);
    try {
      await registerAccount({ email: email.trim(), password, name: name.trim(), phone: phone.trim() });
      // BR-AUTH-2/Flow 2 — registering logs the account in immediately.
      router.push("/account/pets");
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong creating your account.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>Create an Account</h1>
      <p className={styles.subtitle}>Save your pets&apos; details and see your booking history next time.</p>
      <form className={styles.card} onSubmit={handleSubmit} noValidate>
        {error ? (
          <p className={styles.error} data-testid="signup-form-error">
            {error}
          </p>
        ) : null}
        <div className={styles.fieldGroup}>
          <label className={styles.label} htmlFor="signup-name">
            Your name
          </label>
          <input
            id="signup-name"
            className={styles.field}
            autoComplete="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            data-testid="signup-form-name-input"
          />
        </div>
        <div className={styles.fieldGroup}>
          <label className={styles.label} htmlFor="signup-phone">
            Phone number
          </label>
          <input
            id="signup-phone"
            className={styles.field}
            type="tel"
            autoComplete="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            data-testid="signup-form-phone-input"
          />
        </div>
        <div className={styles.fieldGroup}>
          <label className={styles.label} htmlFor="signup-email">
            Email
          </label>
          <input
            id="signup-email"
            className={styles.field}
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            data-testid="signup-form-email-input"
          />
        </div>
        <div className={styles.fieldGroup}>
          <label className={styles.label} htmlFor="signup-password">
            Password
          </label>
          <input
            id="signup-password"
            className={styles.field}
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            data-testid="signup-form-password-input"
          />
        </div>
        <div className={styles.fieldGroup}>
          <label className={styles.label} htmlFor="signup-confirm-password">
            Confirm password
          </label>
          <input
            id="signup-confirm-password"
            className={styles.field}
            type="password"
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            data-testid="signup-form-confirm-password-input"
          />
        </div>
        <p className={styles.hint}>Must be at least 8 characters.</p>
        <button type="submit" className={styles.submitButton} disabled={submitting} data-testid="signup-form-submit-button">
          {submitting ? "Creating account…" : "Create Account"}
        </button>
        <p className={styles.smallNote}>
          Already have an account?{" "}
          <Link href="/login" data-testid="signup-form-login-link">
            Log in
          </Link>
        </p>
      </form>
    </div>
  );
}
