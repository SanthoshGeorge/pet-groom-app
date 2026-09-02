// Booking reference generation — BR-BOOK-8 (Q7=A).
//
// JUDGMENT CALL: "HTG" (Hometown Groomers?) is the same placeholder shop-initials prefix
// the domain-entities.md example (`HTG-4821`) and NFR-2 already use — kept literally, per
// business-rules.md's own note that this is "placeholder pending real branding." The
// 4-digit numeric suffix matches that example's exact shape.

import { randomInt } from "node:crypto";

const PREFIX = "HTG";
const SUFFIX_LENGTH = 4;

export function generateBookingReference(): string {
  let suffix = "";
  for (let i = 0; i < SUFFIX_LENGTH; i++) {
    suffix += String(randomInt(10));
  }
  return `${PREFIX}-${suffix}`;
}
