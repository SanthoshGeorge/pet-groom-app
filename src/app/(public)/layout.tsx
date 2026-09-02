// Public site route group (customer-facing: browse, book, manage own appointment).
// Pages built out in Code Generation Phase H (Steps 20-21).
//
// This layout is the one place the whole public site's design tokens/fonts are wired in
// (`public-tokens.css` + the Karla/Lora font stack) — every page under `(public)/`,
// whether it's a chrome'd marketing page (home/services/gallery/about, via the nested
// `(marketing)` layout) or a chrome-less booking-flow screen (`/book`,
// `/manage-booking`'s own top bar), shares this same background/typography per the
// approved mockup canvas.
import "./public-tokens.css";
import styles from "./PublicShell.module.css";

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return <div className={styles.shell}>{children}</div>;
}
