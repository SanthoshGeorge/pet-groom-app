"use client";

// Guest booking lookup / cancel / reschedule (GC-3, BR-BOOK-5/6). NO MOCKUP COVERS THIS
// SCREEN — the mockup canvas has no lookup/manage artboard; built from GC-3's acceptance
// criteria plus the same visual language (colors, type, card/button styles) as the mocked-up
// screens, per the task's instructions for the no-mockup pages.
//
// BR-BOOK-5 compliance: `lookupBooking` throws the SAME generic error whether the
// reference is unknown or the contact doesn't match. This component renders that message
// verbatim (`err.message`, e.g. "No booking found matching that reference and contact
// information") and adds no branching of its own that could leak which precondition
// failed — never a distinct "reference not found" vs. "contact didn't match" message.
import { useEffect, useMemo, useState } from "react";
import {
  ApiError,
  cancelBooking,
  fetchAvailability,
  fetchServices,
  lookupBooking,
  rescheduleBooking,
  type AppointmentWithLineItems,
  type Service,
  type Slot,
} from "../../_lib/api";
import { formatDateLabelUpper, formatMoney, formatSlotSummary, formatTime, utcDayKey } from "../../_lib/format";
import styles from "./ManageBooking.module.css";

type Phase = "lookup" | "result";

function statusBadgeClass(status: AppointmentWithLineItems["status"]): string {
  if (status === "Cancelled" || status === "NoShow") return styles.statusBadgeCancelled;
  if (status === "Completed") return styles.statusBadgeDone;
  return styles.statusBadge;
}

export function ManageBookingFlow({ initialReference }: { initialReference: string }) {
  const [phase, setPhase] = useState<Phase>("lookup");
  const [reference, setReference] = useState(initialReference);
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [lookupSubmitting, setLookupSubmitting] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);

  const [appointment, setAppointment] = useState<AppointmentWithLineItems | null>(null);
  const [services, setServices] = useState<Service[]>([]);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [actionSubmitting, setActionSubmitting] = useState(false);

  const [confirmingCancel, setConfirmingCancel] = useState(false);
  const [rescheduling, setRescheduling] = useState(false);
  const [rescheduleSlots, setRescheduleSlots] = useState<Slot[] | null>(null);
  const [rescheduleError, setRescheduleError] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);

  useEffect(() => {
    fetchServices()
      .then(setServices)
      .catch(() => setServices([]));
  }, []);

  const serviceMap = useMemo(() => new Map(services.map((s) => [s.id, s])), [services]);

  function guestProof() {
    return { bookingReference: reference.trim(), contact: { email: email.trim() || undefined, phone: phone.trim() || undefined } };
  }

  async function handleLookup() {
    setLookupError(null);
    if (!reference.trim()) {
      setLookupError("Enter your confirmation number.");
      return;
    }
    if (!email.trim() && !phone.trim()) {
      setLookupError("Enter the email or phone number used to book.");
      return;
    }
    setLookupSubmitting(true);
    try {
      const found = await lookupBooking(reference.trim(), {
        email: email.trim() || undefined,
        phone: phone.trim() || undefined,
      });
      setAppointment(found);
      setPhase("result");
    } catch (err) {
      setLookupError(err instanceof ApiError ? err.message : "Something went wrong looking up your booking.");
    } finally {
      setLookupSubmitting(false);
    }
  }

  async function handleCancel() {
    if (!appointment) return;
    setActionSubmitting(true);
    setActionError(null);
    try {
      const updated = await cancelBooking(appointment.id, guestProof());
      setAppointment(updated);
      setActionSuccess("Your appointment has been cancelled.");
      setConfirmingCancel(false);
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Couldn't cancel this appointment.");
    } finally {
      setActionSubmitting(false);
    }
  }

  async function openReschedule() {
    if (!appointment) return;
    setRescheduling(true);
    setRescheduleError(null);
    setRescheduleSlots(null);
    setSelectedSlot(null);
    const firstServiceId = appointment.lineItems[0]?.serviceId;
    if (!firstServiceId) {
      setRescheduleError("Couldn't determine open times for this appointment's service.");
      return;
    }
    const today = new Date();
    const end = new Date(today.getTime() + 14 * 24 * 60 * 60 * 1000);
    try {
      const slots = await fetchAvailability(firstServiceId, today, end);
      setRescheduleSlots(slots.map((s) => ({ ...s, start: new Date(s.start), end: new Date(s.end) })));
    } catch (err) {
      setRescheduleError(err instanceof ApiError ? err.message : "Couldn't load open times right now.");
    }
  }

  async function confirmReschedule() {
    if (!appointment || !selectedSlot) return;
    setActionSubmitting(true);
    setActionError(null);
    try {
      const updated = await rescheduleBooking(appointment.id, selectedSlot.start, guestProof());
      setAppointment(updated);
      setActionSuccess(`Rescheduled to ${formatSlotSummary(selectedSlot.start)}.`);
      setRescheduling(false);
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setRescheduleError("That time was just booked by someone else — please choose another.");
        setSelectedSlot(null);
        void openReschedule();
      } else {
        setActionError(err instanceof ApiError ? err.message : "Couldn't reschedule this appointment.");
      }
    } finally {
      setActionSubmitting(false);
    }
  }

  const slotsByDay = useMemo(() => {
    const map = new Map<string, Slot[]>();
    for (const slot of rescheduleSlots ?? []) {
      const key = utcDayKey(slot.start);
      const existing = map.get(key);
      if (existing) existing.push(slot);
      else map.set(key, [slot]);
    }
    return map;
  }, [rescheduleSlots]);

  if (phase === "lookup") {
    return (
      <div className={styles.page}>
        <h1 className={styles.title}>Manage a Booking</h1>
        <p className={styles.subtitle}>
          Look up your appointment with your confirmation number and the email or phone you booked with — no
          account needed.
        </p>
        <div className={styles.card}>
          {lookupError ? (
            <p className={styles.error} data-testid="booking-lookup-error">
              {lookupError}
            </p>
          ) : null}
          <div className={styles.fieldGroup}>
            <label className={styles.label} htmlFor="lookup-reference">Confirmation number</label>
            <input
              id="lookup-reference"
              className={styles.field}
              placeholder="e.g. HTG-4821"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              data-testid="booking-lookup-reference-input"
            />
          </div>
          <div className={styles.fieldGroup}>
            <label className={styles.label} htmlFor="lookup-email">Email</label>
            <input
              id="lookup-email"
              className={styles.field}
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              data-testid="booking-lookup-email-input"
            />
          </div>
          <div className={styles.fieldGroup}>
            <label className={styles.label} htmlFor="lookup-phone">Phone number</label>
            <input
              id="lookup-phone"
              className={styles.field}
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              data-testid="booking-lookup-phone-input"
            />
          </div>
          <p className={styles.hint}>Enter at least one of email or phone.</p>
          <button
            type="button"
            className={styles.submitButton}
            disabled={lookupSubmitting}
            onClick={handleLookup}
            data-testid="booking-lookup-submit-button"
          >
            {lookupSubmitting ? "Looking up…" : "Find My Booking"}
          </button>
        </div>
      </div>
    );
  }

  if (!appointment) return null;

  const canModify = appointment.status === "Booked";

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>Your Appointment</h1>
      <p className={styles.subtitle}>Confirmation #{appointment.bookingReference}</p>

      <div className={styles.card}>
        <div className={styles.summaryHeader}>
          <span className={statusBadgeClass(appointment.status)} data-testid="booking-status-badge">
            {appointment.status}
          </span>
        </div>

        {actionSuccess ? <p className={styles.success}>{actionSuccess}</p> : null}
        {actionError ? <p className={styles.error}>{actionError}</p> : null}

        <div className={styles.summaryRow}>
          <span className={styles.summaryLabel}>When</span>
          <strong>{formatSlotSummary(new Date(appointment.slotStart))}</strong>
        </div>
        {appointment.lineItems.map((item, index) => {
          const service = serviceMap.get(item.serviceId);
          return (
            <div className={styles.summaryRow} key={item.id}>
              <span className={styles.summaryLabel}>{appointment.lineItems.length > 1 ? `Pet ${index + 1}` : "Service"}</span>
              <strong>
                {service?.name ?? "Service"} — {formatMoney(item.priceSnapshot)}
              </strong>
            </div>
          );
        })}

        {canModify ? (
          <>
            <div className={styles.actionsRow}>
              <button
                type="button"
                className={styles.btnSecondary}
                onClick={openReschedule}
                disabled={actionSubmitting}
                data-testid="booking-lookup-reschedule-button"
              >
                Reschedule
              </button>
              <button
                type="button"
                className={styles.btnDanger}
                onClick={() => setConfirmingCancel(true)}
                disabled={actionSubmitting}
                data-testid="booking-lookup-cancel-button"
              >
                Cancel Appointment
              </button>
            </div>

            {confirmingCancel ? (
              <div className={styles.rescheduleBox}>
                <p>Are you sure you want to cancel this appointment? This can&apos;t be undone.</p>
                <div className={styles.actionsRow}>
                  <button
                    type="button"
                    className={styles.btnDanger}
                    onClick={handleCancel}
                    disabled={actionSubmitting}
                    data-testid="booking-lookup-confirm-cancel-button"
                  >
                    {actionSubmitting ? "Cancelling…" : "Yes, Cancel It"}
                  </button>
                  <button
                    type="button"
                    className={styles.btnSecondary}
                    onClick={() => setConfirmingCancel(false)}
                    data-testid="booking-lookup-dismiss-cancel-button"
                  >
                    Never Mind
                  </button>
                </div>
              </div>
            ) : null}

            {rescheduling ? (
              <div className={styles.rescheduleBox}>
                {rescheduleError ? <p className={styles.error}>{rescheduleError}</p> : null}
                {!rescheduleError && !rescheduleSlots ? <p>Loading open times…</p> : null}
                {rescheduleSlots
                  ? Array.from(slotsByDay.entries()).map(([dayKey, daySlots]) => (
                      <div className={styles.dayGroup} key={dayKey}>
                        <div className={styles.dayLabel}>{formatDateLabelUpper(daySlots[0].start)}</div>
                        <div className={styles.slotGrid}>
                          {daySlots.map((s) => (
                            <button
                              type="button"
                              key={s.start.toISOString()}
                              className={`${styles.slot} ${selectedSlot?.start.getTime() === s.start.getTime() ? styles.slotSelected : ""}`}
                              onClick={() => setSelectedSlot(s)}
                              data-testid={`booking-lookup-reschedule-slot-${s.start.toISOString()}`}
                            >
                              {formatTime(s.start)}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))
                  : null}
                {rescheduleSlots && rescheduleSlots.length === 0 ? <p>No open times in the next two weeks.</p> : null}
                <div className={styles.actionsRow}>
                  <button
                    type="button"
                    className={styles.btnPrimary}
                    disabled={!selectedSlot || actionSubmitting}
                    onClick={confirmReschedule}
                    data-testid="booking-lookup-confirm-reschedule-button"
                  >
                    {actionSubmitting ? "Saving…" : "Confirm New Time"}
                  </button>
                  <button
                    type="button"
                    className={styles.btnSecondary}
                    onClick={() => setRescheduling(false)}
                    data-testid="booking-lookup-cancel-reschedule-button"
                  >
                    Never Mind
                  </button>
                </div>
              </div>
            ) : null}
          </>
        ) : (
          <p className={styles.notModifiable}>
            This appointment can no longer be cancelled or rescheduled online.
          </p>
        )}
      </div>

      <button
        type="button"
        className={styles.startOverLink}
        onClick={() => {
          setPhase("lookup");
          setAppointment(null);
          setActionSuccess(null);
          setActionError(null);
        }}
        data-testid="booking-lookup-start-over-button"
      >
        Look up a different booking
      </button>
    </div>
  );
}
