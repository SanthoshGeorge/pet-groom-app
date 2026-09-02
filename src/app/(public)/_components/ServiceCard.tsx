// One service card — Main.dc.html's "Our Services" preview card, reused verbatim (same
// markup/classes) by both the home-page teaser and the full `/services` menu, since the
// mockup only shows this one card style. `showBookLink` adds a small "Book this →" link
// (not in the mockup, which has no per-card CTA — a Step 20 addition so the service menu
// page, which has no mockup of its own, can jump straight into the booking flow with the
// service pre-selected) — used only on `/services`, not the home teaser.
import Link from "next/link";
import type { Service } from "../_lib/api";
import { formatDuration, formatMoney } from "../_lib/format";
import { getServiceDisplayInfo } from "../_lib/serviceDisplay";
import { ServiceIcon } from "./icons";
import styles from "./ServiceCard.module.css";

export function ServiceCard({ service, showBookLink = false }: { service: Service; showBookLink?: boolean }) {
  const { description, icon } = getServiceDisplayInfo(service.name);
  return (
    <div className={styles.card}>
      <ServiceIcon icon={icon} className={styles.icon} />
      <h3 className={styles.name}>{service.name}</h3>
      <p className={styles.description}>{description}</p>
      <div className={styles.meta}>
        <span>{formatMoney(service.price)}</span>
        <span className={styles.duration}>{formatDuration(service.durationMinutes)}</span>
      </div>
      {showBookLink ? (
        <Link
          href={`/book?serviceId=${service.id}`}
          className={styles.bookLink}
          data-testid={`service-card-book-link-${service.id}`}
        >
          Book this service →
        </Link>
      ) : null}
    </div>
  );
}
