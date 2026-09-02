// Input validation for the reporting module. Mirrors the other modules' `validation.ts`
// pattern (e.g. booking/validation.ts, availability/validation.ts) — one small file of
// pure functions, called at the top of each service.ts method.

import { InvalidReportPeriodError } from "./errors";
import type { ReportPeriod } from "./types";

const VALID_PERIODS: readonly ReportPeriod[] = ["ThisWeek", "ThisMonth"];

/** BR-REPORT-1 — "exactly two period values"; rejects anything else (e.g. a bad/unvalidated API query param). */
export function validateReportPeriod(period: string): asserts period is ReportPeriod {
  if (!VALID_PERIODS.includes(period as ReportPeriod)) {
    throw new InvalidReportPeriodError(period);
  }
}
