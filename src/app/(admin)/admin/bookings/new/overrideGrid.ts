// Builds the New Booking slot grid — the mockup's "normal" (solid) vs "override-only"
// (dashed) slot treatment, computed for real rather than hand-placed like the static
// artboard. `GET /api/availability` (reused here, see `_lib/api.ts`'s `fetchSlots`) already
// gives the real, authoritative "normal hours/buffer/time-off" slots for the chosen
// service+day — those become the grid's normal entries. There is no endpoint that returns
// "every slot ignoring those rules" (an override, by definition, isn't in that list), so the
// extra override-only candidates shown when the toggle is on are generated client-side: a
// fixed half-hour grid across a generous shop-day window, minus whatever's already covered
// by the real normal-slot list. This is a client-side *display* convenience only — it does
// not decide whether a click actually succeeds as an override; `POST /api/admin/bookings`
// (`booking.createOverrideBooking` -> `availability.forceClaimSlot`) makes that call
// authoritatively server-side (BR-AVAIL-10), same as it would for any slot picked here.
import { addUTCDays } from "../../../_lib/format";
import type { Slot } from "../../../_lib/api";

const OVERRIDE_CANDIDATE_INTERVAL_MINUTES = 30;
/** A generous window (7 AM to 9 PM) — wide enough to cover early/late override bookings without an unreasonably long grid. */
const WINDOW_START_HOUR = 7;
const WINDOW_END_HOUR = 21;

export interface GridSlot {
  start: Date;
  /** false = a real slot from `GET /api/availability` (normal hours/buffer/time-off all clear). */
  isOverrideOnly: boolean;
}

export function buildOverrideCandidates(day: Date): Date[] {
  const dayStart = new Date(Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate()));
  const candidates: Date[] = [];
  for (
    let minutes = WINDOW_START_HOUR * 60;
    minutes < WINDOW_END_HOUR * 60;
    minutes += OVERRIDE_CANDIDATE_INTERVAL_MINUTES
  ) {
    candidates.push(new Date(dayStart.getTime() + minutes * 60_000));
  }
  return candidates;
}

/** Merges real normal slots with (when requested) generated override-only candidates, deduped by start time, sorted. */
export function buildSlotGrid(day: Date, normalSlots: Slot[], includeOverrideCandidates: boolean): GridSlot[] {
  const byTime = new Map<number, GridSlot>();
  for (const slot of normalSlots) {
    byTime.set(slot.start.getTime(), { start: slot.start, isOverrideOnly: false });
  }
  if (includeOverrideCandidates) {
    for (const start of buildOverrideCandidates(day)) {
      if (!byTime.has(start.getTime())) {
        byTime.set(start.getTime(), { start, isOverrideOnly: true });
      }
    }
  }
  return Array.from(byTime.values()).sort((a, b) => a.start.getTime() - b.start.getTime());
}

/** Re-exported for callers that only need "tomorrow"/day-window math alongside this file's grid helpers. */
export { addUTCDays };
