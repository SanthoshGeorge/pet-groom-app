// Small line-art SVG icons, copied directly from the mockup canvas's inline `<svg>` markup
// (`Admin-Calendar.dc.html` / `Admin-NewBooking.dc.html` — both artboards use the identical
// sidebar-nav/logo/plus/chevron glyphs). Mirrors `(public)/_components/icons.tsx`'s own
// "plain React components, not an icon library" approach for the same reason that file gives.

import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

const base = {
  fill: "none",
  stroke: "currentColor",
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

export function PawLogoIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" width={24} height={24} strokeWidth={1.6} {...base} {...props}>
      <circle cx="12" cy="15" r="4.2" />
      <circle cx="6" cy="7.5" r="1.8" />
      <circle cx="18" cy="7.5" r="1.8" />
      <circle cx="9.3" cy="4.5" r="1.6" />
      <circle cx="14.7" cy="4.5" r="1.6" />
    </svg>
  );
}

export function CalendarIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" width={18} height={18} strokeWidth={1.8} {...base} {...props}>
      <rect x="3" y="4" width="18" height="17" rx="2" />
      <path d="M3 9h18M8 3v4M16 3v4" />
    </svg>
  );
}

export function ServicesIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" width={18} height={18} strokeWidth={1.8} {...base} {...props}>
      <path d="M4 5c4 2 8 2 12 0M4 12c5 2.5 11 2.5 16 0M4 19c4 2 8 2 12 0" />
    </svg>
  );
}

export function HoursIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" width={18} height={18} strokeWidth={1.8} {...base} {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3.5 2" />
    </svg>
  );
}

export function ReportsIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" width={18} height={18} strokeWidth={1.8} {...base} {...props}>
      <path d="M4 19V10M12 19V5M20 19v-7" />
    </svg>
  );
}

export function LogoutIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" width={18} height={18} strokeWidth={1.8} {...base} {...props}>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
    </svg>
  );
}

export function PlusIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" width={16} height={16} strokeWidth={2.2} {...base} {...props}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

export function ChevronLeftIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" width={14} height={14} strokeWidth={2.4} {...base} {...props}>
      <path d="M15 18l-6-6 6-6" />
    </svg>
  );
}

export function SearchIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" width={16} height={16} strokeWidth={2} {...base} {...props}>
      <circle cx="11" cy="11" r="7" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  );
}
