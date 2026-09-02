// The page-level "Continue"/"Confirm Booking" button — Public-Booking.dc.html and
// Public-Details.dc.html both place this button OUTSIDE the step cards, right-aligned,
// as the very last element on the page (`disabled` until the current step is valid).
import styles from "./WizardFooter.module.css";

export function WizardFooter({
  label,
  disabled,
  submitting,
  error,
  onClick,
  testId,
}: {
  label: string;
  disabled: boolean;
  submitting?: boolean;
  error?: string | null;
  onClick: () => void;
  testId: string;
}) {
  return (
    <div className={styles.footer}>
      {error ? <p className={styles.error}>{error}</p> : null}
      <button
        type="button"
        className={styles.continueButton}
        disabled={disabled || submitting}
        onClick={onClick}
        data-testid={testId}
      >
        {submitting ? "Please wait…" : label}
      </button>
    </div>
  );
}
