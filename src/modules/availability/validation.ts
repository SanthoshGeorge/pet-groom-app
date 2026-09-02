// Manual, per-function input validation — no schema-validation library, per
// nfr-design-patterns.md's Security Patterns ("Input validation: manual, per-route
// (Q5=B)"). Applied here at the business-logic layer so BR-AVAIL-7/8 are enforced as
// real logic regardless of what a later route layer does.

import { AvailabilityValidationError } from "./errors";
import type { DayOfWeek, TimeOffCreateInput, WorkingHoursRuleInput } from "./types";

const ALL_DAYS: readonly DayOfWeek[] = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

function parseTimeOrThrow(dayOfWeek: DayOfWeek, field: "openTime" | "closeTime", value: string): number {
  const match = TIME_RE.exec(value);
  if (!match) {
    throw new AvailabilityValidationError(
      `${dayOfWeek}: ${field} must be a valid "HH:mm" 24-hour time, got "${value}"`,
    );
  }
  return Number(match[1]) * 60 + Number(match[2]);
}

/** BR-AVAIL-7 — exactly one rule per day of week, all 7 present; open days need a valid openTime < closeTime. */
export function validateWorkingHoursSchedule(schedule: WorkingHoursRuleInput[]): void {
  if (schedule.length !== 7) {
    throw new AvailabilityValidationError("exactly 7 WorkingHoursRule entries are required, one per day of week");
  }

  const seen = new Set<DayOfWeek>();
  for (const rule of schedule) {
    if (seen.has(rule.dayOfWeek)) {
      throw new AvailabilityValidationError(`duplicate WorkingHoursRule for ${rule.dayOfWeek}`);
    }
    seen.add(rule.dayOfWeek);

    if (rule.isOpen) {
      if (!rule.openTime || !rule.closeTime) {
        throw new AvailabilityValidationError(
          `${rule.dayOfWeek}: openTime and closeTime are required when isOpen is true`,
        );
      }
      const openMinutes = parseTimeOrThrow(rule.dayOfWeek, "openTime", rule.openTime);
      const closeMinutes = parseTimeOrThrow(rule.dayOfWeek, "closeTime", rule.closeTime);
      if (openMinutes >= closeMinutes) {
        throw new AvailabilityValidationError(`${rule.dayOfWeek}: openTime must be before closeTime`);
      }
    }
  }

  for (const day of ALL_DAYS) {
    if (!seen.has(day)) {
      throw new AvailabilityValidationError(`missing WorkingHoursRule for ${day}`);
    }
  }
}

/** BR-AVAIL-8 — startDate/endDate required, inclusive range, startDate on or before endDate. */
export function validateTimeOffInput(input: TimeOffCreateInput): void {
  if (!input.startDate || !input.endDate) {
    throw new AvailabilityValidationError("startDate and endDate are required");
  }
  if (input.startDate.getTime() > input.endDate.getTime()) {
    throw new AvailabilityValidationError("startDate must be on or before endDate");
  }
}

export function validateSlotRequest(slot: { start: Date; durationMinutes: number }): void {
  if (!slot.start || Number.isNaN(slot.start.getTime())) {
    throw new AvailabilityValidationError("a valid start time is required");
  }
  if (!Number.isInteger(slot.durationMinutes) || slot.durationMinutes <= 0) {
    throw new AvailabilityValidationError("durationMinutes must be a positive integer");
  }
}

export function validateDateRange(range: { start: Date; end: Date }): void {
  if (!range.start || !range.end || Number.isNaN(range.start.getTime()) || Number.isNaN(range.end.getTime())) {
    throw new AvailabilityValidationError("a valid start and end are required");
  }
}
