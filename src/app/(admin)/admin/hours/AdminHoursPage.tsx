"use client";

// `AdminHoursPage` — working hours (BR-AVAIL-7) + time off (BR-AVAIL-8) management. NO
// MOCKUP COVERS THIS SCREEN, and frontend-components.md doesn't spec it either (its scope is
// explicitly "auth / customer / catalog" — see that file's own header). This is the Step 22
// task's own "if frontend-components.md doesn't spec a dedicated screen, a simple
// settings-style page is fine" fallback, built to match the mocked-up admin screens' shared
// visual language (`admin-tokens.css`, card shapes) rather than any pixel reference.
//
// WRITE-ONLY, BY NECESSITY: no `GET /api/admin/hours` or `GET /api/admin/time-off` route
// exists anywhere in this codebase — confirmed by `(public)/(marketing)/about/page.tsx`'s own
// header comment ("the only working-hours data in this codebase is admin-only, `POST
// /api/admin/hours`, with no [way to read it back]"), and no time-off listing method exists
// on `AvailabilityService` either. So this page cannot show the shop's *current* hours or
// existing time-off blocks — there's nothing to fetch. It's a form for SETTING a fresh weekly
// schedule (all 7 days, defaulted to a reasonable 9-5/closed-Sunday starting point the admin
// is expected to adjust) and ADDING a time-off block, each wired to its real POST route,
// each surfacing BR-AVAIL-9's "N existing appointments were flagged for review" result.
import { useState, type FormEvent } from "react";
import { ApiError, addTimeOff, setWorkingHours, type DayOfWeek, type WorkingHoursRuleInput } from "../../_lib/api";
import styles from "./Hours.module.css";

const DAYS: readonly DayOfWeek[] = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const DAY_LABELS: Record<DayOfWeek, string> = {
  Mon: "Monday",
  Tue: "Tuesday",
  Wed: "Wednesday",
  Thu: "Thursday",
  Fri: "Friday",
  Sat: "Saturday",
  Sun: "Sunday",
};

function defaultSchedule(): Record<DayOfWeek, { isOpen: boolean; openTime: string; closeTime: string }> {
  const entries = DAYS.map((day) => [
    day,
    { isOpen: day !== "Sun", openTime: "09:00", closeTime: "17:00" },
  ] as const);
  return Object.fromEntries(entries) as Record<DayOfWeek, { isOpen: boolean; openTime: string; closeTime: string }>;
}

export function AdminHoursPage() {
  const [schedule, setSchedule] = useState(defaultSchedule);
  const [hoursSubmitting, setHoursSubmitting] = useState(false);
  const [hoursError, setHoursError] = useState<string | null>(null);
  const [hoursResult, setHoursResult] = useState<number | null>(null);

  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [reason, setReason] = useState("");
  const [timeOffSubmitting, setTimeOffSubmitting] = useState(false);
  const [timeOffError, setTimeOffError] = useState<string | null>(null);
  const [timeOffResult, setTimeOffResult] = useState<number | null>(null);

  function updateDay(day: DayOfWeek, fields: Partial<{ isOpen: boolean; openTime: string; closeTime: string }>) {
    setSchedule((prev) => ({ ...prev, [day]: { ...prev[day], ...fields } }));
  }

  async function handleHoursSubmit(e: FormEvent) {
    e.preventDefault();
    setHoursError(null);
    setHoursResult(null);

    const payload: WorkingHoursRuleInput[] = DAYS.map((day) => {
      const entry = schedule[day];
      return {
        dayOfWeek: day,
        isOpen: entry.isOpen,
        openTime: entry.isOpen ? entry.openTime : null,
        closeTime: entry.isOpen ? entry.closeTime : null,
      };
    });

    setHoursSubmitting(true);
    try {
      const { affectedAppointmentIds } = await setWorkingHours(payload);
      setHoursResult(affectedAppointmentIds.length);
    } catch (err) {
      setHoursError(err instanceof ApiError ? err.message : "Couldn't save working hours.");
    } finally {
      setHoursSubmitting(false);
    }
  }

  async function handleTimeOffSubmit(e: FormEvent) {
    e.preventDefault();
    setTimeOffError(null);
    setTimeOffResult(null);

    if (!startDate || !endDate) {
      setTimeOffError("Start and end dates are required.");
      return;
    }

    setTimeOffSubmitting(true);
    try {
      const { affectedAppointmentIds } = await addTimeOff({ startDate, endDate, reason: reason.trim() || null });
      setTimeOffResult(affectedAppointmentIds.length);
      setStartDate("");
      setEndDate("");
      setReason("");
    } catch (err) {
      setTimeOffError(err instanceof ApiError ? err.message : "Couldn't add this time-off block.");
    } finally {
      setTimeOffSubmitting(false);
    }
  }

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>Working Hours</h1>
      <p className={styles.subtitle}>
        Set the shop&apos;s regular weekly schedule and block off days you&apos;re closed.
      </p>

      <form className={styles.card} onSubmit={handleHoursSubmit} data-testid="hours-form">
        <div className={styles.cardTitle}>Weekly Schedule</div>
        <p className={styles.cardNote}>
          This form doesn&apos;t pre-fill the shop&apos;s current hours (there&apos;s no way to read them back) —
          review every day below before saving; saving replaces the full week at once.
        </p>

        {hoursError ? (
          <p className={styles.error} data-testid="hours-form-error">
            {hoursError}
          </p>
        ) : null}
        {hoursResult !== null ? (
          hoursResult > 0 ? (
            <p className={styles.warnNote} data-testid="hours-form-success">
              Saved. {hoursResult} existing appointment{hoursResult === 1 ? "" : "s"} fall outside the new hours and{" "}
              {hoursResult === 1 ? "has" : "have"} been flagged for review on the calendar.
            </p>
          ) : (
            <p className={styles.success} data-testid="hours-form-success">
              Saved — no existing appointments were affected.
            </p>
          )
        ) : null}

        {DAYS.map((day) => {
          const entry = schedule[day];
          return (
            <div className={styles.dayRow} key={day}>
              <span className={styles.dayLabel}>{DAY_LABELS[day]}</span>
              <label className={styles.dayOpenToggle}>
                <input
                  type="checkbox"
                  checked={entry.isOpen}
                  onChange={(e) => updateDay(day, { isOpen: e.target.checked })}
                  data-testid={`hours-day-${day}-open-checkbox`}
                />
                Open
              </label>
              <input
                type="time"
                className={styles.field}
                value={entry.openTime}
                disabled={!entry.isOpen}
                onChange={(e) => updateDay(day, { openTime: e.target.value })}
                data-testid={`hours-day-${day}-open-time-input`}
              />
              <input
                type="time"
                className={styles.field}
                value={entry.closeTime}
                disabled={!entry.isOpen}
                onChange={(e) => updateDay(day, { closeTime: e.target.value })}
                data-testid={`hours-day-${day}-close-time-input`}
              />
            </div>
          );
        })}

        <div className={`${styles.actions} ${styles.actionsSpaced}`}>
          <button type="submit" className={styles.primaryButton} disabled={hoursSubmitting} data-testid="hours-form-submit-button">
            {hoursSubmitting ? "Saving…" : "Save Weekly Schedule"}
          </button>
        </div>
      </form>

      <form className={styles.card} onSubmit={handleTimeOffSubmit} data-testid="time-off-form">
        <div className={styles.cardTitle}>Add Time Off</div>
        <p className={styles.cardNote}>Whole calendar days only — blocks new bookings for the range.</p>

        {timeOffError ? (
          <p className={styles.error} data-testid="time-off-form-error">
            {timeOffError}
          </p>
        ) : null}
        {timeOffResult !== null ? (
          timeOffResult > 0 ? (
            <p className={styles.warnNote} data-testid="time-off-form-success">
              Added. {timeOffResult} existing appointment{timeOffResult === 1 ? "" : "s"} fall inside this block and{" "}
              {timeOffResult === 1 ? "has" : "have"} been flagged for review on the calendar.
            </p>
          ) : (
            <p className={styles.success} data-testid="time-off-form-success">
              Added — no existing appointments were affected.
            </p>
          )
        ) : null}

        <div className={styles.formGrid}>
          <div>
            <label className={styles.fieldLabel} htmlFor="time-off-start">
              Start date
            </label>
            <input
              id="time-off-start"
              type="date"
              className={styles.field}
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              data-testid="time-off-start-date-input"
            />
          </div>
          <div>
            <label className={styles.fieldLabel} htmlFor="time-off-end">
              End date
            </label>
            <input
              id="time-off-end"
              type="date"
              className={styles.field}
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              data-testid="time-off-end-date-input"
            />
          </div>
          <div>
            <label className={styles.fieldLabel} htmlFor="time-off-reason">
              Reason (optional)
            </label>
            <input
              id="time-off-reason"
              className={styles.field}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              data-testid="time-off-reason-input"
            />
          </div>
        </div>

        <div className={styles.actions}>
          <button
            type="submit"
            className={styles.primaryButton}
            disabled={timeOffSubmitting}
            data-testid="time-off-form-submit-button"
          >
            {timeOffSubmitting ? "Adding…" : "Add Time Off"}
          </button>
        </div>
      </form>
    </div>
  );
}
