// Site footer — Main.dc.html's footer, copied verbatim (including its placeholder
// hours/address/phone, which the mockup itself flags as "swapped for the real shop's
// branding once provided (NFR-2)" — no real shop-info API exists yet to source these from,
// so this deliberately keeps the mockup's own placeholder copy rather than inventing
// real-looking values).
import styles from "./SiteFooter.module.css";

export function SiteFooter() {
  return (
    <footer className={styles.footer}>
      <div className={styles.brandCol}>
        <span className={styles.brandName}>Happy Tails Grooming</span>
        <p className={styles.blurb}>
          Placeholder name &amp; styling — swapped for the real shop&apos;s branding once provided (NFR-2).
        </p>
      </div>
      <div className={styles.col}>
        <strong className={styles.colTitle}>HOURS</strong>
        <span>[SHOP HOURS]</span>
      </div>
      <div className={styles.col}>
        <strong className={styles.colTitle}>CONTACT</strong>
        <span>[ADDRESS]</span>
        <span>[PHONE NUMBER]</span>
      </div>
    </footer>
  );
}
