// Service menu (FR-12: "a service menu with prices"). No mockup covers this screen — the
// mockup canvas only shows a 4-card *teaser* on Main.dc.html, not a dedicated full-menu
// page. Built from that same teaser's card visual language (via the shared `ServiceCard`)
// plus general judgment for a small local-business price list, listing every bookable
// service (no cap), each with a "Book this service →" shortcut into `/book`.
import Link from "next/link";
import { ServicesList } from "../../_components/ServicesList";
import styles from "./Services.module.css";

export const metadata = {
  title: "Services & Prices — Happy Tails Grooming",
};

export default function ServicesPage() {
  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Services &amp; Prices</h1>
          <p className={styles.subtitle}>
            Every service below is bookable online — pick one to see open times, or browse the full list first.
          </p>
        </div>
        <Link href="/book" className={styles.bookAllButton} data-testid="services-page-book-button">
          Book an Appointment
        </Link>
      </div>

      <ServicesList showBookLinks />

      <p className={styles.note}>Prices and durations may change over time — your confirmed price is locked in at booking.</p>
    </div>
  );
}
