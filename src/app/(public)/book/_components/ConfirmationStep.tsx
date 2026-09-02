"use client";

// Confirmation screen — Public-Confirmation.dc.html matched pixel-and-copy-faithfully.
// Note the mockup shows NO header/top bar at all here (unlike the two prior steps), just
// the centered card on the page background — `BookingWizard` renders this without
// `BookingTopBar` for exactly that reason.
import { useRouter } from "next/navigation";
import type { Appointment, Service } from "../../_lib/api";
import { downloadAppointmentICS } from "../../_lib/ics";
import { formatMoney, formatSlotSummary } from "../../_lib/format";
import { BellIcon, CheckIcon } from "../../_components/icons";
import type { PetFormEntry } from "../types";
import styles from "./ConfirmationStep.module.css";

export function ConfirmationStep({
  appointment,
  contactName,
  service,
  pets,
}: {
  appointment: Appointment;
  contactName: string;
  service: Service;
  pets: PetFormEntry[];
}) {
  const router = useRouter();
  const firstPetName = pets[0]?.name || "your pet";
  const petSummary =
    pets.length === 1
      ? `${pets[0].name}${pets[0].breed ? ` (${pets[0].breed})` : ""}`
      : `${pets.map((p) => p.name).join(", ")} (${pets.length} pets)`;
  const slotStart = new Date(appointment.slotStart);
  const slotEnd = new Date(appointment.slotEnd);

  return (
    <div className={styles.wrap}>
      <div className={styles.card}>
        <div className={styles.checkCircle}>
          <CheckIcon width={26} height={26} strokeWidth={3} />
        </div>

        <h1 className={styles.title}>You&apos;re all set{contactName ? `, ${contactName.split(" ")[0]}` : ""}!</h1>
        <p className={styles.subtitle}>{firstPetName}&apos;s appointment is booked. See you soon.</p>

        <div className={styles.summary}>
          <div className={styles.summaryRow}>
            <span className={styles.summaryLabel}>Service</span>
            <strong className={styles.summaryValue}>
              {service.name} — {formatMoney(service.price)}
            </strong>
          </div>
          <div className={styles.summaryRow}>
            <span className={styles.summaryLabel}>{pets.length === 1 ? "Pet" : "Pets"}</span>
            <strong className={styles.summaryValue}>{petSummary}</strong>
          </div>
          <div className={styles.summaryRow}>
            <span className={styles.summaryLabel}>When</span>
            <strong className={styles.summaryValue}>{formatSlotSummary(slotStart)}</strong>
          </div>
          <div className={styles.summaryRow}>
            <span className={styles.summaryLabel}>Confirmation #</span>
            <strong className={styles.summaryValue} data-testid="confirmation-booking-reference">
              {appointment.bookingReference}
            </strong>
          </div>
        </div>

        <div className={styles.notice}>
          <BellIcon className={styles.noticeIcon} />
          <span className={styles.noticeText}>
            Confirmation sent to your email and phone. We&apos;ll text a reminder the day before your appointment.
          </span>
        </div>

        <div className={styles.actions}>
          <button
            type="button"
            className={styles.btnSecondary}
            data-testid="confirmation-add-calendar-button"
            onClick={() =>
              downloadAppointmentICS({
                title: `${service.name} — Happy Tails Grooming`,
                description: `Confirmation #${appointment.bookingReference}. ${petSummary}.`,
                start: slotStart,
                end: slotEnd,
                uid: appointment.id,
              })
            }
          >
            Add to Calendar
          </button>
          <button
            type="button"
            className={styles.btnPrimary}
            data-testid="confirmation-manage-booking-button"
            onClick={() => router.push(`/manage-booking?ref=${encodeURIComponent(appointment.bookingReference)}`)}
          >
            Manage This Booking
          </button>
        </div>
        <p className={styles.footnote}>
          Need to cancel or reschedule later? Use &quot;Manage This Booking&quot; with confirmation #
          {appointment.bookingReference} — no account needed.
        </p>
      </div>
    </div>
  );
}
