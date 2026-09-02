// The `Service` domain entity (src/modules/catalog/types.ts) is deliberately minimal —
// `name`/`price`/`durationMinutes`/`active` only, per BR-CAT-5 (no icon or marketing-copy
// field exists, and none was added here — that would be a business-logic-layer change,
// out of scope for a frontend-pages step). The mockup's four service cards each show a
// short description and a distinct line-art icon; since the real catalog is admin-managed
// and can contain services the mockup never anticipated, this file supplies best-effort
// display copy/icon keyed by the mockup's own four service names (exact matches get the
// mockup's exact copy/icon; anything else falls back to a generic description and a
// generic scissors icon) rather than leaving unrecognized services with no description at
// all.
//
// JUDGMENT CALL, called out per the task's report requirement: this mapping is a Step 20
// presentation-layer convenience, not part of the approved data model.

export interface ServiceDisplayInfo {
  description: string;
  icon: "bath" | "groom" | "nail" | "deshed" | "generic";
}

const KNOWN_SERVICES: Record<string, ServiceDisplayInfo> = {
  "bath & brush": { description: "Shampoo, blow-dry, and a full brush-out.", icon: "bath" },
  "full groom": { description: "Bath, haircut, nail trim, ear cleaning.", icon: "groom" },
  "nail trim": { description: "Quick trim and file, on its own.", icon: "nail" },
  "de-shed treatment": { description: "Deep de-shedding for heavy coats.", icon: "deshed" },
};

export function getServiceDisplayInfo(serviceName: string): ServiceDisplayInfo {
  const known = KNOWN_SERVICES[serviceName.trim().toLowerCase()];
  if (known) return known;
  return { description: "Professional grooming care for your dog.", icon: "generic" };
}
