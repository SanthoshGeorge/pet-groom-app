"use client";

// `AdminReportsPage` (SO-6, BR-REPORT-1..4). NO MOCKUP COVERS THIS SCREEN —
// frontend-components.md's scope is auth/customer/catalog only, but per the Step 22 task's
// note it "may reference the mockup's existing stat-strip pattern"; `Admin-Calendar.dc.html`
// does have exactly that pattern (its THIS WEEK / NO-SHOWS THIS WEEK / TODAY tile row), so
// this page reuses it via the shared `StatStrip` component (`../_components/StatStrip`)
// rather than inventing a different visual for the same "a few key numbers" need.
// BR-REPORT-1: exactly two preset periods, no custom range — a two-tab toggle, not a date
// picker.
import { useEffect, useState } from "react";
import { StatStrip } from "../../_components/StatStrip";
import { ApiError, fetchReportSummary, type AppointmentSummary, type ReportPeriod } from "../../_lib/api";
import styles from "./Reports.module.css";

const PERIODS: { value: ReportPeriod; label: string }[] = [
  { value: "ThisWeek", label: "This Week" },
  { value: "ThisMonth", label: "This Month" },
];

export function AdminReportsPage() {
  const [period, setPeriod] = useState<ReportPeriod>("ThisWeek");
  const [summary, setSummary] = useState<AppointmentSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // No synchronous `setLoading(true)`/`setError(null)` at the top of this effect — see
  // `AdminCalendarPage`'s `load` for why (the `react-hooks/set-state-in-effect` rule); every
  // update below runs inside `.then`/`.catch` instead. `loading`'s initial `true` value
  // covers the first paint; switching tabs after that swaps the stat strip in place once the
  // new period's data arrives, rather than flashing a loading state.
  useEffect(() => {
    let cancelled = false;
    fetchReportSummary(period)
      .then((result) => {
        if (cancelled) return;
        setSummary(result);
        setError(null);
        setLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof ApiError ? err.message : "Couldn't load this report right now.");
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [period]);

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>Reports</h1>
      <p className={styles.subtitle}>Appointment volume and no-shows for the shop.</p>

      <div className={styles.tabs} role="tablist" aria-label="Report period">
        {PERIODS.map((p) => (
          <button
            key={p.value}
            type="button"
            role="tab"
            aria-selected={period === p.value}
            className={period === p.value ? `${styles.tab} ${styles.tabActive}` : styles.tab}
            onClick={() => setPeriod(p.value)}
            data-testid={`reports-period-tab-${p.value}`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {error ? (
        <p className={styles.error} data-testid="reports-load-error">
          {error}
        </p>
      ) : null}

      {loading ? (
        <p className={styles.loading} data-testid="reports-loading">
          Loading…
        </p>
      ) : summary ? (
        <>
          <StatStrip
            tiles={[
              {
                testId: "reports-stat-total-appointments",
                label: "Total Appointments",
                value: String(summary.totalAppointments),
              },
              { testId: "reports-stat-no-shows", label: "No-Shows", value: String(summary.noShowCount) },
            ]}
          />
          <p className={styles.note}>
            Total appointments counts every booking in the period regardless of status (including cancelled) —
            it&apos;s overall booking volume, not just completed visits.
          </p>
        </>
      ) : null}
    </div>
  );
}
