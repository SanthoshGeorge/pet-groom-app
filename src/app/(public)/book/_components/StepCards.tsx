// Shared step-card chrome for the booking wizard — done / active / locked, matching
// Public-Booking.dc.html and Public-Details.dc.html's three step states exactly.
import type { ReactNode } from "react";
import { CheckIcon } from "../../_components/icons";
import styles from "./StepCards.module.css";

/** Full-size "done" row (step 1, while step 2 is active) — with a "Change" action. */
export function DoneStepRow({
  label,
  value,
  onChange,
  testId,
}: {
  label: string;
  value: ReactNode;
  onChange: () => void;
  testId: string;
}) {
  return (
    <div className={styles.doneRow}>
      <div className={`${styles.badge} ${styles.badgeDone}`}>
        <CheckIcon />
      </div>
      <div className={styles.doneBody}>
        <div className={styles.doneLabel}>{label}</div>
        <div className={styles.doneValue}>{value}</div>
      </div>
      <button type="button" className={styles.changeLink} onClick={onChange} data-testid={testId}>
        Change
      </button>
    </div>
  );
}

/** Compact "done" chip (steps 1 & 2, once step 3 is active) — no "Change" action, matches Public-Details.dc.html. */
export function DoneStepChip({ value }: { value: ReactNode }) {
  return (
    <div className={styles.doneChip}>
      <div className={`${styles.badge} ${styles.badgeSmall} ${styles.badgeDone}`}>
        <CheckIcon width={12} height={12} />
      </div>
      <div className={styles.doneChipValue}>{value}</div>
    </div>
  );
}

export function DoneChipRow({ children }: { children: ReactNode }) {
  return <div className={styles.chipRow}>{children}</div>;
}

/** Grayed-out, non-interactive "locked" row for a step not yet reached. */
export function LockedStepRow({ stepNumber, label, value }: { stepNumber: number; label: string; value: ReactNode }) {
  return (
    <div className={styles.lockedRow}>
      <div className={`${styles.badge} ${styles.badgeLocked}`}>{stepNumber}</div>
      <div className={styles.lockedBody}>
        <div className={styles.lockedLabel}>{label}</div>
        <div className={styles.lockedValue}>{value}</div>
      </div>
    </div>
  );
}

/** The current, interactive step's card. */
export function ActiveStepCard({
  stepNumber,
  label,
  title,
  children,
}: {
  stepNumber: number;
  label: string;
  title: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className={styles.activeCard}>
      <div className={styles.activeHeader}>
        <div className={`${styles.badge} ${styles.badgeActive}`}>{stepNumber}</div>
        <div>
          <div className={styles.activeLabel}>{label}</div>
          <div className={styles.activeTitle}>{title}</div>
        </div>
      </div>
      {children}
    </div>
  );
}
