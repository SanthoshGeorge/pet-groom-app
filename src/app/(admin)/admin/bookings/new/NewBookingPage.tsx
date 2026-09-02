"use client";

// `NewBookingPage` — built from `Admin-NewBooking.dc.html` (mockup-covered screen: card
// layout/labels/override toggle/slot styling/button row all read from that artboard,
// ported into `NewBooking.module.css`/`admin-tokens.css`). Two real, working adaptations the
// static mockup didn't need to solve, documented at each spot below:
//
// 1. "Find or add a customer" — the mockup shows a live customer-name search with a result
//    list and a SELECTED badge. No search/list-customers endpoint exists anywhere in this
//    codebase (`src/app/api/admin/**` has no such route, and Step 22 must not add one), so
//    that exact interaction can't be built. Instead this uses the one thing the real API
//    already does well: `POST /api/admin/bookings`'s `contact` path resolves through
//    `customer.createOrFindOwner` (BR-CUST-1/2/3) — matching by email, then phone — so typing
//    a matching phone/email here transparently reuses the existing customer record
//    server-side, with no client-side search needed. The "find or add" framing survives; the
//    literal search-box UI does not — see the Step 22 report for the full note.
// 2. Service/Pet fields are live inputs (a service `<select>`, plus new-pet name/breed/size
//    fields), not the mockup's two read-only `<input readonly>` values — those imply a prior
//    step (picking an existing customer's existing pet) that Step 1 above establishes isn't
//    buildable against the real API. Every pet booked here is created via `newPet` (the
//    admin describes the pet fresh) since there's no way to browse an existing customer's
//    saved pets without a customer-lookup endpoint either.
//
// Slot grid (normal vs. override-only) is REAL, not mocked: see ./overrideGrid.ts's header
// comment for exactly how the mockup's dashed/solid slot distinction is computed against the
// live `GET /api/availability` data.
import { useEffect, useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeftIcon } from "../../../_components/icons";
import {
  ApiError,
  createAdminBooking,
  fetchServices,
  fetchSlots,
  type AppointmentWithLineItems,
  type PetSize,
  type Service,
  type Slot,
} from "../../../_lib/api";
import { formatDateLong, formatDuration, formatMoney, formatTime, startOfUTCDay } from "../../../_lib/format";
import { buildSlotGrid, type GridSlot } from "./overrideGrid";
import styles from "./NewBooking.module.css";

const PET_SIZES: readonly PetSize[] = ["Small", "Medium", "Large", "XL"];

function todayDateInputValue(): string {
  return new Date().toISOString().slice(0, 10);
}

export function NewBookingPage() {
  const router = useRouter();

  const [contactName, setContactName] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [contactEmail, setContactEmail] = useState("");

  const [services, setServices] = useState<Service[]>([]);
  const [servicesError, setServicesError] = useState<string | null>(null);
  const [serviceId, setServiceId] = useState("");

  const [petName, setPetName] = useState("");
  const [petBreed, setPetBreed] = useState("");
  const [petSize, setPetSize] = useState<PetSize>("Medium");

  const [dateValue, setDateValue] = useState(todayDateInputValue);
  const [overrideOn, setOverrideOn] = useState(false);
  const [normalSlots, setNormalSlots] = useState<Slot[]>([]);
  const [slotsError, setSlotsError] = useState<string | null>(null);
  const [selectedSlotStart, setSelectedSlotStart] = useState<number | null>(null);

  const [visitNotes, setVisitNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [created, setCreated] = useState<AppointmentWithLineItems | null>(null);

  const selectedDay = useMemo(() => startOfUTCDay(new Date(`${dateValue}T00:00:00.000Z`)), [dateValue]);
  const selectedService = services.find((s) => s.id === serviceId) ?? null;

  useEffect(() => {
    fetchServices()
      .then(setServices)
      .catch((err) => setServicesError(err instanceof ApiError ? err.message : "Couldn't load services."));
  }, []);

  // No synchronous `setSlotsLoading`/`setSlotsError`/`setSelectedSlotStart` reset at the top
  // of this effect — see `AdminCalendarPage`'s `load` for why
  // (`react-hooks/set-state-in-effect`). Every state update below runs inside `.then`/
  // `.catch` instead; there's no dedicated "loading" flag as a result (slot fetches are
  // fast, and the previous grid staying visible for a moment while a fresh one loads is a
  // harmless, accepted simplification, not a bug) — `!serviceId` skips the fetch entirely,
  // and `NewBookingPage`'s own "choose a service" message covers that state without needing
  // to clear `normalSlots` (unused while no service is selected, per the render branch
  // below).
  useEffect(() => {
    if (!serviceId) return;
    let cancelled = false;
    const dayEnd = new Date(selectedDay.getTime() + 24 * 60 * 60 * 1000);
    fetchSlots(serviceId, selectedDay, dayEnd)
      .then((slots) => {
        if (cancelled) return;
        setNormalSlots(slots);
        setSlotsError(null);
        setSelectedSlotStart(null);
      })
      .catch((err) => {
        if (cancelled) return;
        setSlotsError(err instanceof ApiError ? err.message : "Couldn't load availability for this day.");
      });
    return () => {
      cancelled = true;
    };
  }, [serviceId, selectedDay]);

  const gridSlots: GridSlot[] = useMemo(
    () => buildSlotGrid(selectedDay, normalSlots, overrideOn),
    [selectedDay, normalSlots, overrideOn],
  );

  function resetForm() {
    setContactName("");
    setContactPhone("");
    setContactEmail("");
    setServiceId("");
    setPetName("");
    setPetBreed("");
    setPetSize("Medium");
    setDateValue(todayDateInputValue());
    setOverrideOn(false);
    setSelectedSlotStart(null);
    setVisitNotes("");
    setCreated(null);
    setSubmitError(null);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitError(null);

    if (!contactName.trim() || !contactPhone.trim() || !contactEmail.trim()) {
      setSubmitError("Enter the customer's name, phone, and email.");
      return;
    }
    if (!serviceId) {
      setSubmitError("Choose a service.");
      return;
    }
    if (!petName.trim() || !petBreed.trim()) {
      setSubmitError("Enter the pet's name and breed.");
      return;
    }
    if (selectedSlotStart === null) {
      setSubmitError("Choose a time slot.");
      return;
    }

    setSubmitting(true);
    try {
      const appointment = await createAdminBooking({
        contact: { name: contactName.trim(), phone: contactPhone.trim(), email: contactEmail.trim() },
        pets: [
          {
            newPet: {
              name: petName.trim(),
              breed: petBreed.trim(),
              size: petSize,
            },
            serviceId,
          },
        ],
        slotStart: new Date(selectedSlotStart).toISOString(),
        visitNotes: visitNotes.trim() || null,
      });
      setCreated(appointment);
    } catch (err) {
      setSubmitError(err instanceof ApiError ? err.message : "Couldn't create this booking.");
    } finally {
      setSubmitting(false);
    }
  }

  if (created) {
    return (
      <div className={styles.page}>
        <Link href="/admin/calendar" className={styles.backLink} data-testid="new-booking-back-link">
          <ChevronLeftIcon />
          Back to Calendar
        </Link>
        <h1 className={styles.title}>New Booking — On Behalf of a Customer</h1>
        <div
          className={created.hasConflict ? `${styles.success} ${styles.successConflict}` : styles.success}
          data-testid="new-booking-success"
        >
          <div className={styles.successTitle}>
            {created.hasConflict ? "Booked — with a scheduling conflict" : "Booking confirmed"}
          </div>
          <div className={styles.successBody} data-testid="new-booking-success-body">
            {created.bookingReference} — {formatDateLong(created.slotStart)} at {formatTime(created.slotStart)}.
            {created.isOverride ? " This was booked outside normal hours/buffer (override)." : ""}
            {created.hasConflict
              ? " It overlaps another already-booked appointment — double-check the schedule."
              : ""}
          </div>
        </div>
        <div className={styles.actions}>
          <button
            type="button"
            className={styles.secondaryButton}
            onClick={resetForm}
            data-testid="new-booking-book-another-button"
          >
            Book Another
          </button>
          <button
            type="button"
            className={styles.primaryButton}
            onClick={() => router.push("/admin/calendar")}
            data-testid="new-booking-done-button"
          >
            Back to Calendar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <Link href="/admin/calendar" className={styles.backLink} data-testid="new-booking-back-link">
        <ChevronLeftIcon />
        Back to Calendar
      </Link>
      <h1 className={styles.title}>New Booking — On Behalf of a Customer</h1>

      <form onSubmit={handleSubmit} noValidate>
        <div className={styles.card}>
          <label className={styles.fieldLabel} htmlFor="new-booking-customer-name">
            Find or add a customer
          </label>
          <div className={styles.cardGrid3}>
            <div>
              <input
                id="new-booking-customer-name"
                className={styles.field}
                placeholder="Full name"
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
                data-testid="new-booking-customer-name-input"
              />
            </div>
            <div>
              <input
                className={styles.field}
                placeholder="Phone"
                type="tel"
                value={contactPhone}
                onChange={(e) => setContactPhone(e.target.value)}
                data-testid="new-booking-customer-phone-input"
              />
            </div>
            <div>
              <input
                className={styles.field}
                placeholder="Email"
                type="email"
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
                data-testid="new-booking-customer-email-input"
              />
            </div>
          </div>
          <p className={styles.matchNote}>
            If this phone or email matches an existing customer, their record is reused automatically —
            no duplicate customer is created.
          </p>
        </div>

        <div className={styles.card}>
          <div className={styles.cardGrid2}>
            <div>
              <label className={styles.fieldLabel} htmlFor="new-booking-service-select">
                Service
              </label>
              <select
                id="new-booking-service-select"
                className={styles.field}
                value={serviceId}
                onChange={(e) => setServiceId(e.target.value)}
                data-testid="new-booking-service-select"
              >
                <option value="">Choose a service…</option>
                {services.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} — {formatMoney(s.price)} · {formatDuration(s.durationMinutes)}
                  </option>
                ))}
              </select>
              {servicesError ? (
                <p className={styles.helperText} data-testid="new-booking-services-error">
                  {servicesError}
                </p>
              ) : selectedService ? (
                <p className={styles.helperText} data-testid="new-booking-selected-service-summary">
                  {selectedService.name} — {formatMoney(selectedService.price)} ·{" "}
                  {formatDuration(selectedService.durationMinutes)}
                </p>
              ) : null}
            </div>
            <div>
              <label className={styles.fieldLabel} htmlFor="new-booking-pet-name">
                Pet name
              </label>
              <input
                id="new-booking-pet-name"
                className={styles.field}
                value={petName}
                onChange={(e) => setPetName(e.target.value)}
                data-testid="new-booking-pet-name-input"
              />
            </div>
          </div>
          <div className={`${styles.cardGrid2} ${styles.cardGridSpaced}`}>
            <div>
              <label className={styles.fieldLabel} htmlFor="new-booking-pet-breed">
                Pet breed
              </label>
              <input
                id="new-booking-pet-breed"
                className={styles.field}
                value={petBreed}
                onChange={(e) => setPetBreed(e.target.value)}
                data-testid="new-booking-pet-breed-input"
              />
            </div>
            <div>
              <label className={styles.fieldLabel} htmlFor="new-booking-pet-size">
                Pet size
              </label>
              <select
                id="new-booking-pet-size"
                className={styles.field}
                value={petSize}
                onChange={(e) => setPetSize(e.target.value as PetSize)}
                data-testid="new-booking-pet-size-select"
              >
                {PET_SIZES.map((size) => (
                  <option key={size} value={size}>
                    {size}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className={styles.card}>
          <div className={styles.availabilityHeader}>
            <div>
              <div className={styles.availabilityHeading}>{formatDateLong(selectedDay)}</div>
              <div className={styles.availabilitySubtitle}>
                Override lets you book outside normal hours or buffer windows
              </div>
            </div>
            <div className={styles.overrideControl}>
              <input
                type="date"
                className={`${styles.field} ${styles.dateField}`}
                value={dateValue}
                onChange={(e) => setDateValue(e.target.value)}
                data-testid="new-booking-date-input"
              />
              <span className={overrideOn ? `${styles.overrideLabel} ${styles.overrideLabelOn}` : styles.overrideLabel}>
                Override availability: {overrideOn ? "ON" : "OFF"}
              </span>
              <button
                type="button"
                className={overrideOn ? `${styles.toggle} ${styles.toggleOn}` : styles.toggle}
                onClick={() => setOverrideOn((v) => !v)}
                role="switch"
                aria-checked={overrideOn}
                aria-label="Override availability"
                data-testid="new-booking-override-toggle"
              >
                <span className={styles.toggleKnob} />
              </button>
            </div>
          </div>

          {!serviceId ? (
            <p className={styles.emptySlots}>Choose a service to see available times.</p>
          ) : slotsError ? (
            <p className={styles.helperText} data-testid="new-booking-slots-error">
              {slotsError}
            </p>
          ) : gridSlots.length === 0 ? (
            <p className={styles.emptySlots} data-testid="new-booking-slots-empty">
              No normal availability for this day{overrideOn ? "" : " — turn on override to book outside normal hours."}
            </p>
          ) : (
            <div className={styles.slotGrid} data-testid="new-booking-slot-grid">
              {gridSlots.map((slot) => {
                const time = slot.start.getTime();
                const selected = selectedSlotStart === time;
                const classNames = [styles.slot];
                if (slot.isOverrideOnly) classNames.push(styles.slotOverride);
                if (selected) classNames.push(styles.slotSelected);
                return (
                  <button
                    key={time}
                    type="button"
                    className={classNames.join(" ")}
                    disabled={slot.isOverrideOnly && !overrideOn}
                    onClick={() => setSelectedSlotStart(time)}
                    data-testid={`new-booking-slot-${time}`}
                  >
                    {formatTime(slot.start)}
                  </button>
                );
              })}
            </div>
          )}
          <p className={styles.helperText}>
            Dashed slots are outside normal availability — only bookable because override is on. They&apos;ll show
            flagged on the calendar if booking them creates a scheduling conflict.
          </p>
        </div>

        <div className={styles.card}>
          <label className={styles.fieldLabel} htmlFor="new-booking-visit-notes">
            Visit notes (optional, this visit only)
          </label>
          <textarea
            id="new-booking-visit-notes"
            className={styles.field}
            rows={3}
            value={visitNotes}
            onChange={(e) => setVisitNotes(e.target.value)}
            data-testid="new-booking-visit-notes-input"
          />
        </div>

        {submitError ? (
          <p className={styles.error} data-testid="new-booking-submit-error">
            {submitError}
          </p>
        ) : null}

        <div className={styles.actions}>
          <Link href="/admin/calendar" className={styles.secondaryButton} data-testid="new-booking-cancel-link">
            Cancel
          </Link>
          <button type="submit" className={styles.primaryButton} disabled={submitting} data-testid="new-booking-submit-button">
            {submitting ? "Saving…" : "Save Booking"}
          </button>
        </div>
      </form>
    </div>
  );
}
