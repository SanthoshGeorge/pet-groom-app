// reporting module error types — thrown by service.ts, mapped to HTTP responses by the
// API layer (Code Generation Step 13, out of scope here).

/** BR-REPORT-1 — `period` must be exactly `"ThisWeek"` or `"ThisMonth"`. Guards against a malformed runtime value (e.g. an unvalidated API query param) reaching the service — the `ReportPeriod` union alone only protects compile-time callers. */
export class InvalidReportPeriodError extends Error {
  constructor(period: string) {
    super(`Invalid report period: ${period}`);
    this.name = "InvalidReportPeriodError";
  }
}
