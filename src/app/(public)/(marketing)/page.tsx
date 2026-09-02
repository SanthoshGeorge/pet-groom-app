// Home / landing page — Main.dc.html, matched pixel-and-copy-faithfully: hero (badge,
// headline, subhead, two CTAs, photo placeholder), "Our Services" teaser (real data via
// `ServicesList`, capped at 4 like the mockup's 4 hardcoded cards), and "Recent Grooms"
// gallery teaser (static placeholders — no sample photos exist in `public/`). Header/footer
// come from the `(marketing)` layout.
import Link from "next/link";
import { PhotoPlaceholder } from "../_components/PhotoPlaceholder";
import { ServicesList } from "../_components/ServicesList";
import styles from "./Home.module.css";

export default function HomePage() {
  return (
    <>
      <section className={styles.hero}>
        <div className={styles.heroCopy}>
          <span className={styles.badge}>DOG GROOMING, DONE RIGHT</span>
          <h1 className={styles.heroTitle}>Grooming your dog will actually enjoy.</h1>
          <p className={styles.heroSubtitle}>
            See real open appointment times and book online in a couple of minutes — no account required, no phone
            calls needed.
          </p>
          <div className={styles.heroActions}>
            <Link href="/book" className={styles.btnPrimary} data-testid="home-hero-book-button">
              Book an Appointment
            </Link>
            <Link href="/services" className={styles.btnSecondary} data-testid="home-hero-services-button">
              See Services &amp; Prices
            </Link>
          </div>
        </div>
        <PhotoPlaceholder label="Photo of a freshly groomed dog" className={styles.heroPhoto} />
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHeading}>
          <h2 className={styles.sectionTitle}>Our Services</h2>
          <Link href="/services" className={styles.sectionLink} data-testid="home-services-teaser-view-all-link">
            View full price list →
          </Link>
        </div>
        <ServicesList limit={4} />
      </section>

      <section className={styles.gallerySection}>
        <div className={styles.sectionHeading}>
          <h2 className={styles.sectionTitle}>Recent Grooms</h2>
          <Link href="/gallery" className={styles.sectionLink} data-testid="home-gallery-teaser-view-all-link">
            View gallery →
          </Link>
        </div>
        <div className={styles.galleryGrid}>
          <PhotoPlaceholder label="Photo" className={styles.galleryPhoto} />
          <PhotoPlaceholder label="Photo" className={styles.galleryPhoto} />
          <PhotoPlaceholder label="Photo" className={styles.galleryPhoto} />
          <PhotoPlaceholder label="Photo" className={styles.galleryPhoto} />
        </div>
      </section>
    </>
  );
}
