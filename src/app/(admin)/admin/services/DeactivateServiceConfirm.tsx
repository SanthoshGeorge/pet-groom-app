"use client";

// `DeactivateServiceConfirm` per frontend-components.md's spec — a confirm step before a
// destructive-feeling (reversible only by recreating the service, since no `reactivateService`
// method exists — see that doc's own note) action.
import type { Service } from "../../_lib/api";
import styles from "./Services.module.css";

export function DeactivateServiceConfirm({
  service,
  onConfirm,
  onCancel,
  confirming = false,
}: {
  service: Service;
  onConfirm: () => void;
  onCancel: () => void;
  confirming?: boolean;
}) {
  return (
    <div className={styles.confirmOverlay} data-testid="deactivate-service-confirm-overlay">
      <div className={styles.confirmCard} role="alertdialog" aria-labelledby="deactivate-service-confirm-title">
        <h2 id="deactivate-service-confirm-title" className={styles.confirmTitle}>
          Deactivate {service.name}?
        </h2>
        <p className={styles.confirmBody}>
          Customers won&apos;t be able to book this service anymore. Past and existing appointments that used it
          are unaffected. There&apos;s no built-in way to reactivate it later — you&apos;d need to add it again.
        </p>
        <div className={styles.confirmActions}>
          <button
            type="button"
            className={styles.secondaryButton}
            onClick={onCancel}
            disabled={confirming}
            data-testid="deactivate-service-confirm-cancel-button"
          >
            Cancel
          </button>
          <button
            type="button"
            className={styles.dangerButton}
            onClick={onConfirm}
            disabled={confirming}
            data-testid="deactivate-service-confirm-confirm-button"
          >
            {confirming ? "Deactivating…" : "Deactivate"}
          </button>
        </div>
      </div>
    </div>
  );
}
