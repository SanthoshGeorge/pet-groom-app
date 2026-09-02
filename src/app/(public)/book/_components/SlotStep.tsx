"use client";

// Step 2 — "choose an open slot", Public-Booking.dc.html matched pixel-and-copy-faithfully:
// a 5-day date strip, a time-slot grid for the selected day, and the same helper line
// underneath (adapted — see note below). Real data via `GET /api/availability` (Step 12),
// not the mockup's hardcoded slots.
//
// ADAPTATION FROM THE MOCKUP: the mockup renders some slots with a `.taken` (struck-through,
// grayed) style to illustrate unavailable times. `GET /api/availability` only ever returns
// OPEN slots (booked/closed times are simply absent from the response, not returned with a
// "taken" flag) — there is no data this page could use to render a specific taken slot as a
// disabled button. So only open, clickable slots are rendered, and the mockup's helper
// sentence is adapted from "Grayed-out times are already booked..." to "Only open times are
// shown below..." to stay accurate to what's actually on screen, while keeping the same
// reassuring intent as the mockup's original copy.
import { useEffect, useMemo, useState } from "react";
import type { Service, Slot } from "../../_lib/api";
import { ApiError, fetchAvailability } from "../../_lib/api";
import {
  addUTCDays,
  formatDateLabelUpper,
  formatDayNumber,
  formatTime,
  formatWeekdayShort,
  startOfUTCDay,
  utcDayKey,
} from "../../_lib/format";
import { ActiveStepCard } from "./StepCards";
import styles from "./SlotStep.module.css";

// Mirrors `ADVANCE_BOOKING_DAYS` (src/modules/availability/config.ts, BR-AVAIL-4) — kept as
// a local constant rather than a runtime import of `@/modules/availability` so this client
// component doesn't pull the availability module's business-logic code into the browser
// bundle just for one number; the server clamps to the real value regardless (time.ts's
// `clampDateRange`), so a mismatch here would only ever affect this UI's paging bounds, not
// what's actually bookable.
const ADVANCE_BOOKING_DAYS = 14;
const DAYS_PER_PAGE = 5;

export function SlotStep({
  service,
  selectedSlot,
  onSelect,
}: {
  service: Service;
  selectedSlot: Slot | null;
  onSelect: (slot: Slot) => void;
}) {
  const [slots, setSlots] = useState<Slot[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [windowStart, setWindowStart] = useState(0);
  const [selectedDateKey, setSelectedDateKey] = useState<string | null>(null);

  // Runs once on mount. `SlotStep` is remounted fresh (via `key={service.id}` in
  // `BookingWizard`) whenever the selected service changes, so there's no live "service
  // changed under an already-mounted SlotStep" case to reset state for here — every
  // mount's `service` is fixed for its whole lifetime.
  useEffect(() => {
    let cancelled = false;
    const today = startOfUTCDay(new Date());
    const end = addUTCDays(today, ADVANCE_BOOKING_DAYS);
    fetchAvailability(service.id, today, end)
      .then((result) => {
        if (cancelled) return;
        const parsed = result.map((slot) => ({ ...slot, start: new Date(slot.start), end: new Date(slot.end) }));
        setSlots(parsed);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof ApiError ? err.message : "Couldn't load open times right now.");
      });
    return () => {
      cancelled = true;
    };
  }, [service.id]);

  const slotsByDay = useMemo(() => {
    const map = new Map<string, Slot[]>();
    for (const slot of slots ?? []) {
      const key = utcDayKey(slot.start);
      const existing = map.get(key);
      if (existing) existing.push(slot);
      else map.set(key, [slot]);
    }
    for (const list of map.values()) list.sort((a, b) => a.start.getTime() - b.start.getTime());
    return map;
  }, [slots]);

  const today = useMemo(() => startOfUTCDay(new Date()), []);
  const days = useMemo(
    () => Array.from({ length: DAYS_PER_PAGE }, (_, i) => addUTCDays(today, windowStart + i)),
    [today, windowStart],
  );

  // Default date: the first day-in-view with open slots (falling back to the window's
  // first day) — derived at render time rather than pushed into state via an effect, so
  // paging or a fresh slots response updates the default immediately with no extra
  // render pass. Once the visitor explicitly clicks a date, `selectedDateKey` is set and
  // takes over from this default for good (it's never cleared back to null).
  const autoDateKey = useMemo(() => {
    if (!slots) return null;
    const firstWithSlots = days.find((day) => (slotsByDay.get(utcDayKey(day))?.length ?? 0) > 0);
    return utcDayKey(firstWithSlots ?? days[0]);
  }, [slots, days, slotsByDay]);

  const effectiveDateKey = selectedDateKey ?? autoDateKey;
  const selectedDate = effectiveDateKey ? new Date(`${effectiveDateKey}T00:00:00.000Z`) : null;
  const timesForSelectedDay = effectiveDateKey ? (slotsByDay.get(effectiveDateKey) ?? []) : [];

  const canGoPrev = windowStart > 0;
  const canGoNext = windowStart + DAYS_PER_PAGE < ADVANCE_BOOKING_DAYS;

  return (
    <ActiveStepCard stepNumber={2} label="DATE & TIME" title="Choose an open slot">
      {error ? <p className={styles.error}>{error}</p> : null}
      {!error && !slots ? <p className={styles.status}>Loading open times…</p> : null}

      {slots ? (
        <>
          <div className={styles.dateStripRow}>
            <button
              type="button"
              className={styles.pageButton}
              disabled={!canGoPrev}
              onClick={() => setWindowStart((w) => Math.max(0, w - DAYS_PER_PAGE))}
              aria-label="Earlier days"
              data-testid="slot-step-prev-days-button"
            >
              ‹
            </button>
            <div className={styles.dateStrip}>
              {days.map((day) => {
                const key = utcDayKey(day);
                const hasSlots = (slotsByDay.get(key)?.length ?? 0) > 0;
                const isSelected = key === effectiveDateKey;
                return (
                  <button
                    type="button"
                    key={key}
                    className={`${styles.dateCell} ${isSelected ? styles.dateCellSelected : ""}`}
                    onClick={() => setSelectedDateKey(key)}
                    data-testid={`slot-step-date-${key}`}
                  >
                    {formatWeekdayShort(day)}
                    <br />
                    <strong className={styles.dateNumber}>{formatDayNumber(day)}</strong>
                    {!hasSlots ? <span className={styles.dateEmptyDot} aria-hidden="true" /> : null}
                  </button>
                );
              })}
            </div>
            <button
              type="button"
              className={styles.pageButton}
              disabled={!canGoNext}
              onClick={() => setWindowStart((w) => Math.min(ADVANCE_BOOKING_DAYS - DAYS_PER_PAGE, w + DAYS_PER_PAGE))}
              aria-label="Later days"
              data-testid="slot-step-next-days-button"
            >
              ›
            </button>
          </div>

          {selectedDate ? <div className={styles.sectionLabel}>{formatDateLabelUpper(selectedDate)}</div> : null}

          {timesForSelectedDay.length === 0 ? (
            <p className={styles.status}>No open times on this day — try another date.</p>
          ) : (
            <div className={styles.slotGrid}>
              {timesForSelectedDay.map((slot) => {
                const isSelected = selectedSlot?.start.getTime() === slot.start.getTime();
                return (
                  <button
                    type="button"
                    key={slot.start.toISOString()}
                    className={`${styles.slot} ${isSelected ? styles.slotSelected : ""}`}
                    onClick={() => onSelect(slot)}
                    data-testid={`slot-step-slot-${slot.start.toISOString()}`}
                  >
                    {formatTime(slot.start)}
                  </button>
                );
              })}
            </div>
          )}
          <p className={styles.helperText}>
            Only open times are shown below — already-booked times, or times too close to another appointment,
            won&apos;t appear.
          </p>
        </>
      ) : null}
    </ActiveStepCard>
  );
}
