// Diagonal-stripe placeholder box — Main.dc.html's `.photo-placeholder` pattern (the
// mockup's own stand-in for real photography, per NFR-2's "placeholder... swapped once
// provided"). No sample images exist anywhere in `public/`, so this same placeholder is
// reused on the home page's hero/gallery-teaser and the standalone `/gallery` page
// (neither of which has real photos to source).
import type { CSSProperties, ReactNode } from "react";
import styles from "./PhotoPlaceholder.module.css";

export function PhotoPlaceholder({
  label,
  className,
  style,
}: {
  label: ReactNode;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <div className={[styles.placeholder, className].filter(Boolean).join(" ")} style={style}>
      <span>{label}</span>
    </div>
  );
}
