// `ServiceRow` per frontend-components.md's spec — "table-style like the Admin Calendar
// mockup's agenda list" (no mockup covers this screen; the row's own visual language is
// this pass's own, matching the mocked-up admin screens' agenda-row shape). Shows the
// "inactive" badge described there, mirroring the mockup's override-badge pattern.
import { formatDuration, formatMoney } from "../../_lib/format";
import type { Service } from "../../_lib/api";
import styles from "./Services.module.css";

export function ServiceRow({
  service,
  onEdit,
  onDeactivate,
}: {
  service: Service;
  onEdit: () => void;
  onDeactivate: () => void;
}) {
  return (
    <div className={service.active ? styles.row : `${styles.row} ${styles.rowInactive}`} data-testid={`service-row-${service.id}`}>
      <div className={styles.rowBody}>
        <div className={styles.rowTitle}>
          {service.name}
          {!service.active ? <span className={styles.badge}>INACTIVE</span> : null}
        </div>
        <div className={styles.rowSubtitle}>
          {formatMoney(service.price)} · {formatDuration(service.durationMinutes)}
        </div>
      </div>
      <div className={styles.rowActions}>
        <button
          type="button"
          className={styles.secondaryButton}
          onClick={onEdit}
          data-testid={`service-row-edit-button-${service.id}`}
        >
          Edit
        </button>
        {service.active ? (
          <button
            type="button"
            className={styles.dangerButton}
            onClick={onDeactivate}
            data-testid={`service-row-deactivate-button-${service.id}`}
          >
            Deactivate
          </button>
        ) : null}
      </div>
    </div>
  );
}
