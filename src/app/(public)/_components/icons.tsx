// Small line-art SVG icons, copied directly from the mockup canvas's inline `<svg>`
// markup (Main.dc.html's header logo + four service-card icons, the booking flow's
// back-chevron/checkmark, and the confirmation screen's checkmark/bell). Kept as plain
// React components (not an icon library) — the mockup itself hand-rolls each one inline,
// and pulling in a whole icon package for ~8 fixed glyphs would be its own kind of
// second-system creep.

import type { SVGProps } from "react";
import type { ServiceDisplayInfo } from "../_lib/serviceDisplay";

type IconProps = SVGProps<SVGSVGElement>;

const base = {
  fill: "none",
  stroke: "currentColor",
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

export function PawLogoIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" width={30} height={30} strokeWidth={1.6} {...base} {...props}>
      <circle cx="12" cy="15" r="4.2" />
      <circle cx="6" cy="7.5" r="1.8" />
      <circle cx="18" cy="7.5" r="1.8" />
      <circle cx="9.3" cy="4.5" r="1.6" />
      <circle cx="14.7" cy="4.5" r="1.6" />
    </svg>
  );
}

export function ChevronLeftIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" width={16} height={16} strokeWidth={2} {...base} {...props}>
      <path d="M15 18l-6-6 6-6" />
    </svg>
  );
}

export function CheckIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" width={14} height={14} strokeWidth={3} {...base} {...props}>
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

export function MailIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" width={18} height={18} strokeWidth={1.6} {...base} {...props}>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M3 7l9 6 9-6" />
    </svg>
  );
}

export function BellIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" width={18} height={18} strokeWidth={1.6} {...base} {...props}>
      <path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.7 21a2 2 0 0 1-3.4 0" />
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

function BathIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" width={26} height={26} strokeWidth={1.6} {...base} {...props}>
      <path d="M7 12c0-3 2.5-6 5-6s5 3 5 6-2 6-5 6-5-3-5-6Z" />
      <path d="M9 10c.5-1 1.5-1.5 3-1.5s2.5.5 3 1.5" />
    </svg>
  );
}

function GroomIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" width={26} height={26} strokeWidth={1.6} {...base} {...props}>
      <path d="M6 5c4 2 8 2 12 0M4 12c5 2.5 11 2.5 16 0M6 19c4 2 8 2 12 0" />
    </svg>
  );
}

function NailIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" width={26} height={26} strokeWidth={1.6} {...base} {...props}>
      <path d="M12 3v4M12 17v4M5 12H3M21 12h-2M7 7l-1.5-1.5M18.5 18.5 17 17M17 7l1.5-1.5M5.5 18.5 7 17" />
      <circle cx="12" cy="12" r="4" />
    </svg>
  );
}

function DeshedIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" width={26} height={26} strokeWidth={1.6} {...base} {...props}>
      <path d="M4 17c3-8 6-11 8-11s5 3 8 11" />
      <path d="M4 17h16" />
    </svg>
  );
}

function GenericServiceIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" width={26} height={26} strokeWidth={1.6} {...base} {...props}>
      <circle cx="7" cy="7" r="3" />
      <circle cx="7" cy="17" r="3" />
      <path d="M9.5 8.8 20 20M20 4 9.5 15.2" />
    </svg>
  );
}

const SERVICE_ICONS: Record<ServiceDisplayInfo["icon"], (props: IconProps) => React.JSX.Element> = {
  bath: BathIcon,
  groom: GroomIcon,
  nail: NailIcon,
  deshed: DeshedIcon,
  generic: GenericServiceIcon,
};

export function ServiceIcon({ icon, ...props }: { icon: ServiceDisplayInfo["icon"] } & IconProps) {
  const Icon = SERVICE_ICONS[icon];
  return <Icon {...props} />;
}
