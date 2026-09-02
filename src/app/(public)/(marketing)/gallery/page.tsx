// Photo gallery (FR-12: "a photo gallery"). No mockup screen exists for this page — only
// Main.dc.html's 4-photo "Recent Grooms" teaser, which this page extends into a full grid
// using the exact same `.photo-placeholder` visual language (no real photography exists
// anywhere in `public/`, so a placeholder grid is used throughout rather than sourcing
// stand-in stock photos).
import Link from "next/link";
import { PhotoPlaceholder } from "../../_components/PhotoPlaceholder";
import styles from "./Gallery.module.css";

export const metadata = {
  title: "Gallery — Happy Tails Grooming",
};

const PLACEHOLDER_COUNT = 8;

export default function GalleryPage() {
  return (
    <div className={styles.page}>
      <h1 className={styles.title}>Recent Grooms</h1>
      <p className={styles.subtitle}>
        A look at some of the pups we&apos;ve groomed recently. Real photos coming soon — for now, here&apos;s a
        preview of the gallery layout.
      </p>
      <div className={styles.grid} data-testid="gallery-photo-grid">
        {Array.from({ length: PLACEHOLDER_COUNT }, (_, index) => (
          <PhotoPlaceholder key={index} label="Photo" className={styles.photo} />
        ))}
      </div>
      <div className={styles.ctaRow}>
        <Link href="/book" className={styles.bookButton} data-testid="gallery-page-book-button">
          Book an Appointment
        </Link>
      </div>
    </div>
  );
}
