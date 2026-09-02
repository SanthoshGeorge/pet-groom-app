"use client";

// `AdminCalendarPage` — built from `Admin-Calendar.dc.html` (mockup-covered screen). Sidebar/
// stat-strip/day-strip/agenda-row visual language matches the mockup pixel-for-pixel (colors,
// radii, spacing all read from that artboard's `:root`/inline styles, ported into
// `Calendar.module.css`/`admin-tokens.css`); a few pieces are real, working adaptations the
// static mockup didn't need to solve — documented inline at each spot:
//
// 1. DATA GAP (owner/pet names) — `GET /api/admin/appointments` (Step 13) returns
//    `AppointmentWithLineItems`: `ownerId`/`petId`/`serviceId` only, never denormalized
//    names (confirmed against `src/modules/booking/types.ts` and the Prisma repository —
//    neither ever joins in `Owner`/`Pet`). No admin endpoint exists to resolve an owner or
//    pet by id either (this step must not add one). So each row shows the booking reference
//    (a real, unique, phone-call-friendly identifier — BR-BOOK-8) and the resolved SERVICE
//    name(s) (services ARE resolvable, via the public `GET /api/services`) in place of the
//    mockup's "Biscuit (Golden Retriever) — Full Groom" / "Jamie Rivera · (555) 019-4482"
//    line. This is a real fidelity gap versus the mockup, caused by the upstream API shape,
//    not a shortcut taken here — see the Step 22 report for the full note.
// 2. Day strip extended to all 7 days (mockup shows Mon-Sat only) — nothing in this codebase
//    assumes the shop is closed Sunday (working hours are admin-configurable, SO-5), so
//    hiding Sunday from a real date-range control would silently drop real appointments from
//    view.
// 3. Week prev/next navigation (not in the static mockup, which only ever shows one week) —
//    added to satisfy the Step 22 task's "date-range controls" requirement using the same
//    visual language.
// 4. The mockup's dashed "4:00 PM — Open" gap row is not reproduced — it implies a full-day
//    slot grid, which requires a `serviceId` (`GET /api/availability` is per-service); the
//    agenda has no single service to compute that grid against. An empty-day state is shown
//    instead when a selected day has no appointments.
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { StatStrip } from "../../_components/StatStrip";
import { PlusIcon } from "../../_components/icons";
import {
  ApiError,
  fetchAppointments,
  fetchServices,
  markNoShow,
  type AppointmentWithLineItems,
  type Service,
} from "../../_lib/api";
import { addUTCDays, formatDateShort, formatDuration, formatTime, startOfWeekUTC, utcDayKey } from "../../_lib/format";
import styles from "./Calendar.module.css";

function createdByLabel(createdBy: AppointmentWithLineItems["createdBy"]): string {
  if (createdBy === "owner") return "added by you";
  if (createdBy === "account") return "booked online · account holder";
  return "booked online · guest";
}

export function AdminCalendarPage() {
  const [weekStart, setWeekStart] = useState<Date>(() => startOfWeekUTC(new Date()));
  const [selectedDayKey, setSelectedDayKey] = useState<string>(() => utcDayKey(new Date()));
  const [appointments, setAppointments] = useState<AppointmentWithLineItems[]>([]);
  const [services, setServices] = useState<Record<string, Service>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [noShowPendingId, setNoShowPendingId] = useState<string | null>(null);
  const [noShowError, setNoShowError] = useState<string | null>(null);

  const weekEnd = useMemo(() => addUTCDays(weekStart, 7), [weekStart]);
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addUTCDays(weekStart, i)), [weekStart]);
  const todayKey = useMemo(() => utcDayKey(new Date()), []);

  // No synchronous `setLoading(true)`/`setError(null)` before the fetch here — the
  // `react-hooks/set-state-in-effect` rule (this codebase's ESLint config, per
  // `eslint-config-next`) disallows a setState call that runs synchronously as part of the
  // effect's own execution; every state update below happens inside a `.then`/`.catch`
  // callback instead (genuinely asynchronous, same pattern `(public)/(marketing)/account/
  // pets/AccountPetsPage.tsx` already uses). `loading`'s initial `true` value covers the
  // first paint; a week/day navigation after that swaps the agenda in place once the new
  // data arrives, without a loading flash — an accepted, minor UX simplification the lint
  // rule's constraint drives, not a bug.
  const load = useCallback(() => {
    Promise.all([fetchAppointments(weekStart, weekEnd), fetchServices()])
      .then(([appts, svcs]) => {
        setAppointments(appts);
        setServices(Object.fromEntries(svcs.map((s) => [s.id, s])));
        setError(null);
        setLoading(false);
      })
      .catch((err) => {
        setError(err instanceof ApiError ? err.message : "Couldn't load the calendar right now.");
        setLoading(false);
      });
  }, [weekStart, weekEnd]);

  useEffect(() => {
    load();
  }, [load]);

  const countsByDay = useMemo(() => {
    const counts = new Map<string, number>();
    for (const appt of appointments) {
      const key = utcDayKey(appt.slotStart);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return counts;
  }, [appointments]);

  const noShowsThisWeek = appointments.filter((a) => a.status === "NoShow").length;
  const selectedDayAppointments = appointments
    .filter((a) => utcDayKey(a.slotStart) === selectedDayKey)
    .sort((a, b) => a.slotStart.getTime() - b.slotStart.getTime());
  const selectedDate = days.find((d) => utcDayKey(d) === selectedDayKey) ?? new Date(selectedDayKey);

  async function handleMarkNoShow(appointmentId: string) {
    setNoShowPendingId(appointmentId);
    setNoShowError(null);
    try {
      const updated = await markNoShow(appointmentId);
      setAppointments((prev) => prev.map((a) => (a.id === appointmentId ? updated : a)));
    } catch (err) {
      setNoShowError(err instanceof ApiError ? err.message : "Couldn't mark this appointment as a no-show.");
    } finally {
      setNoShowPendingId(null);
    }
  }

  function serviceNames(appt: AppointmentWithLineItems): string {
    return appt.lineItems.map((li) => services[li.serviceId]?.name ?? "Service").join(", ") || "—";
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>Calendar</h1>
        <Link href="/admin/bookings/new" className={styles.newBookingButton} data-testid="calendar-new-booking-link">
          <PlusIcon />
          New Booking
        </Link>
      </div>

      <StatStrip
        tiles={[
          { testId: "calendar-stat-this-week", label: "This Week", value: `${appointments.length} appointments` },
          { testId: "calendar-stat-no-shows", label: "No-Shows This Week", value: String(noShowsThisWeek) },
          {
            testId: "calendar-stat-selected-day",
            label: selectedDayKey === todayKey ? "Today" : formatDateShort(selectedDate),
            value: `${selectedDayAppointments.length} appointments`,
          },
        ]}
      />

      {error ? (
        <p className={styles.error} data-testid="calendar-load-error">
          {error}
        </p>
      ) : null}

      <div className={styles.weekNav}>
        <span className={styles.weekLabel}>
          Week of {formatDateShort(weekStart)} – {formatDateShort(addUTCDays(weekStart, 6))}
        </span>
        <div className={styles.weekNavButtons}>
          <button
            type="button"
            className={styles.weekNavButton}
            onClick={() => setWeekStart((prev) => addUTCDays(prev, -7))}
            data-testid="calendar-prev-week-button"
          >
            ← Previous week
          </button>
          <button
            type="button"
            className={styles.weekNavButton}
            onClick={() => setWeekStart((prev) => addUTCDays(prev, 7))}
            data-testid="calendar-next-week-button"
          >
            Next week →
          </button>
        </div>
      </div>

      <div className={styles.dayStrip}>
        {days.map((day) => {
          const key = utcDayKey(day);
          const active = key === selectedDayKey;
          return (
            <button
              key={key}
              type="button"
              className={active ? `${styles.dayPill} ${styles.dayPillActive}` : styles.dayPill}
              onClick={() => setSelectedDayKey(key)}
              data-testid={`calendar-day-pill-${key}`}
            >
              {formatDateShort(day)}
              <span className={styles.dayPillCount}>{countsByDay.get(key) ?? 0}</span>
            </button>
          );
        })}
      </div>

      {noShowError ? (
        <p className={styles.error} data-testid="calendar-no-show-error">
          {noShowError}
        </p>
      ) : null}

      {loading ? (
        <p className={styles.loading} data-testid="calendar-loading">
          Loading…
        </p>
      ) : (
        <div className={styles.agenda} data-testid="calendar-agenda">
          {selectedDayAppointments.length === 0 ? (
            <div className={styles.emptyRow} data-testid="calendar-empty-day">
              No appointments scheduled for {formatDateShort(selectedDate)}.
            </div>
          ) : (
            selectedDayAppointments.map((appt) => {
              const totalDuration = appt.lineItems.reduce((sum, li) => sum + li.durationSnapshotMinutes, 0);
              return (
                <div
                  key={appt.id}
                  className={appt.flaggedForReview ? `${styles.row} ${styles.rowFlagged}` : styles.row}
                  data-testid={`calendar-appointment-row-${appt.id}`}
                >
                  <div className={styles.rowTime}>{formatTime(appt.slotStart)}</div>
                  <div className={styles.rowBody}>
                    <div className={styles.rowTitle}>
                      {appt.bookingReference} — {serviceNames(appt)}
                    </div>
                    <div className={styles.rowSubtitle}>{createdByLabel(appt.createdBy)}</div>
                  </div>
                  <div className={styles.rowMeta}>
                    {appt.isOverride ? <span className={`${styles.badge} ${styles.badgeOverride}`}>OVERRIDE</span> : null}
                    {appt.hasConflict ? <span className={`${styles.badge} ${styles.badgeConflict}`}>CONFLICT</span> : null}
                    {appt.flaggedForReview ? (
                      <span className={`${styles.badge} ${styles.badgeFlagged}`}>FLAGGED FOR REVIEW</span>
                    ) : null}
                    {appt.notificationFailed ? (
                      <span className={`${styles.badge} ${styles.badgeNotificationFailed}`}>NOTIFICATION FAILED</span>
                    ) : null}
                    {appt.status !== "Booked" && appt.status !== "Completed" ? (
                      <span className={`${styles.badge} ${styles.badgeStatus}`}>{appt.status.toUpperCase()}</span>
                    ) : null}
                    <span className={styles.rowDuration}>{formatDuration(totalDuration)}</span>
                    {appt.status === "Completed" ? (
                      <button
                        type="button"
                        className={styles.noShowButton}
                        onClick={() => handleMarkNoShow(appt.id)}
                        disabled={noShowPendingId === appt.id}
                        data-testid={`calendar-mark-no-show-button-${appt.id}`}
                      >
                        {noShowPendingId === appt.id ? "Marking…" : "Mark No-Show"}
                      </button>
                    ) : null}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
