// Main site header — Main.dc.html's header, rebuilt as real navigation (the mockup's
// `<a href="#">`s become real `<Link>`s; "Book Now" links to the real booking flow).
//
// `HeaderAuthLinks` (Step 21) adds login-state awareness the mockup never depicted — see its
// own header comment for why it's a client component rendered here rather than making this
// whole header one.
import Link from "next/link";
import { PawLogoIcon } from "./icons";
import { HeaderAuthLinks } from "./HeaderAuthLinks";
import styles from "./SiteHeader.module.css";

export function SiteHeader() {
  return (
    <header className={styles.header}>
      <Link href="/" className={styles.brand} data-testid="site-header-logo-link">
        <PawLogoIcon className={styles.brandIcon} />
        <span className={styles.brandName}>Happy Tails Grooming</span>
      </Link>
      <nav className={styles.nav}>
        <Link href="/services" className={styles.navLink} data-testid="site-header-services-link">
          Services
        </Link>
        <Link href="/gallery" className={styles.navLink} data-testid="site-header-gallery-link">
          Gallery
        </Link>
        <Link href="/about" className={styles.navLink} data-testid="site-header-about-link">
          About &amp; Hours
        </Link>
        <HeaderAuthLinks />
        <Link href="/book" className={styles.bookButton} data-testid="site-header-book-now-button">
          Book Now
        </Link>
      </nav>
    </header>
  );
}
