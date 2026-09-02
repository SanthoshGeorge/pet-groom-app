"use client";

// The booking wizard — GC-2 (guest booking, BR-BOOK-1/8/9) and GC-1's slot browsing
// (BR-AVAIL-1/3/4/8), matched to the mockup canvas pixel-and-copy-faithfully across its
// three artboards (Public-Booking.dc.html, Public-Details.dc.html,
// Public-Confirmation.dc.html), plus a "choose a service" first step the mockup only shows
// already-resolved (see `ServiceStep.tsx`'s header comment).
//
// ROUTING/STATE JUDGMENT CALL: implemented as ONE route (`/book`) with the 3-4 mockup
// screens as internal client state (`step`), not four separate sub-routes. The flow is
// strictly linear (each mockup screen's own "step 1/2/3" chrome only ever shows what's
// done/active/locked in sequence, never lets a user jump ahead), no story asks for
// deep-linking into the middle of an in-progress booking, and a single component avoids
// re-fetching/re-serializing the whole in-progress form (contact + N pets) through the URL
// or session storage between page loads. `/manage-booking` is a separate top-level route
// since it's a distinct entry point, not a step of this same wizard.
import { useState } from "react";
import { BookingTopBar } from "../_components/BookingTopBar";
import { ApiError, createBooking, type Appointment, type PetSize, type Service, type Slot } from "../_lib/api";
import { formatDuration, formatMoney, formatSlotSummary } from "../_lib/format";
import { ServiceStep } from "./_components/ServiceStep";
import { SlotStep } from "./_components/SlotStep";
import { DetailsStep, type DetailsFieldErrors } from "./_components/DetailsStep";
import { ConfirmationStep } from "./_components/ConfirmationStep";
import { DoneChipRow, DoneStepChip, DoneStepRow, LockedStepRow } from "./_components/StepCards";
import { WizardFooter } from "./_components/WizardFooter";
import { createEmptyPet, type ContactFormState, type PetFormEntry } from "./types";
import styles from "./BookingWizard.module.css";

type WizardStep = 1 | 2 | 3 | 4;

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function validateDetails(contact: ContactFormState, pets: PetFormEntry[]): DetailsFieldErrors {
  const errors: DetailsFieldErrors = {};
  if (!contact.name.trim()) errors.name = "Your name is required.";
  if (!contact.phone.trim()) errors.phone = "A phone number is required.";
  if (!contact.email.trim()) errors.email = "An email is required.";
  else if (!isValidEmail(contact.email)) errors.email = "Enter a valid email address.";

  const petErrors: Record<string, { name?: string; breed?: string; size?: string }> = {};
  for (const pet of pets) {
    const entry: { name?: string; breed?: string; size?: string } = {};
    if (!pet.name.trim()) entry.name = "Pet's name is required.";
    if (!pet.breed.trim()) entry.breed = "Breed is required.";
    if (!pet.size) entry.size = "Choose a size.";
    if (Object.keys(entry).length > 0) petErrors[pet.key] = entry;
  }
  if (Object.keys(petErrors).length > 0) errors.pets = petErrors;
  return errors;
}

function hasErrors(errors: DetailsFieldErrors): boolean {
  return Boolean(errors.name || errors.phone || errors.email || (errors.pets && Object.keys(errors.pets).length > 0));
}

export function BookingWizard({ initialServiceId }: { initialServiceId: string | null }) {
  const [step, setStep] = useState<WizardStep>(1);
  const [service, setService] = useState<Service | null>(null);
  const [slot, setSlot] = useState<Slot | null>(null);
  const [contact, setContact] = useState<ContactFormState>({ name: "", phone: "", email: "" });
  const [pets, setPets] = useState<PetFormEntry[]>([createEmptyPet()]);
  const [detailsErrors, setDetailsErrors] = useState<DetailsFieldErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [appointment, setAppointment] = useState<Appointment | null>(null);

  function handleSelectService(next: Service) {
    if (service && service.id !== next.id) {
      // Changing service after a slot/details were already entered invalidates them.
      setSlot(null);
    }
    setService(next);
    if (step === 1) setStep(2);
  }

  function handleSelectSlot(next: Slot) {
    setSlot(next);
    // Clear a stale 409 conflict message once the user picks a new slot (see the
    // handleSubmit catch block below, and step 2's WizardFooter's `error` prop).
    setSubmitError(null);
  }

  async function handleSubmit() {
    if (!service || !slot) return;
    const errors = validateDetails(contact, pets);
    setDetailsErrors(errors);
    if (hasErrors(errors)) return;

    setSubmitting(true);
    setSubmitError(null);
    try {
      const created = await createBooking({
        contact: { name: contact.name.trim(), phone: contact.phone.trim(), email: contact.email.trim() },
        pets: pets.map((pet) => ({
          serviceId: service.id,
          newPet: {
            name: pet.name.trim(),
            breed: pet.breed.trim(),
            // Guarded by `validateDetails`/`hasErrors` above: submission is blocked unless
            // every pet's `size` is a non-empty, valid `PetSize`.
            size: pet.size as PetSize,
            age: pet.age.trim() ? Number(pet.age) : null,
            temperamentNotes: pet.notes.trim() || null,
          },
        })),
        slotStart: slot.start.toISOString(),
      });
      setAppointment(created);
      setStep(4);
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        // GC-2's edge case: someone else claimed the slot first. Send the user back to
        // slot selection with updated availability rather than a dead-end error.
        setSlot(null);
        setStep(2);
        setSubmitError("That time was just booked by someone else — please choose another slot.");
      } else {
        setSubmitError(err instanceof ApiError ? err.message : "Something went wrong creating your booking.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (step === 4 && appointment && service) {
    return <ConfirmationStep appointment={appointment} contactName={contact.name} service={service} pets={pets} />;
  }

  return (
    <div className={styles.page}>
      <BookingTopBar />
      <div className={styles.content}>
        <h1 className={styles.heading}>Book an Appointment</h1>
        <p className={styles.subheading}>No account needed — we&apos;ll just need a few details to confirm your visit.</p>

        {step === 1 ? (
          <ServiceStep
            selectedServiceId={service?.id ?? null}
            onSelect={handleSelectService}
            initialServiceId={initialServiceId}
          />
        ) : (
          service && (
            <DoneStepRow
              label="SERVICE"
              value={`${service.name} — ${formatMoney(service.price)} · ${formatDuration(service.durationMinutes)}`}
              onChange={() => setStep(1)}
              testId="booking-wizard-change-service-button"
            />
          )
        )}

        {step === 2 && service ? (
          <SlotStep key={service.id} service={service} selectedSlot={slot} onSelect={handleSelectSlot} />
        ) : null}
        {step > 2 && slot ? (
          <DoneChipRow>
            {service ? <DoneStepChip value={`${service.name} — $${service.price}`} /> : null}
            <DoneStepChip value={formatSlotSummary(slot.start)} />
          </DoneChipRow>
        ) : null}

        {step === 3 && service ? (
          <DetailsStep
            service={service}
            contact={contact}
            onContactChange={setContact}
            pets={pets}
            onPetsChange={setPets}
            errors={detailsErrors}
          />
        ) : step < 3 ? (
          <LockedStepRow
            stepNumber={3}
            label="YOUR & YOUR PET'S DETAILS"
            value="Name, contact info, and pet details — you can add more than one pet to this visit"
          />
        ) : null}

        {step === 1 ? (
          <WizardFooter
            label="Continue to Date & Time"
            disabled={!service}
            onClick={() => service && setStep(2)}
            testId="booking-wizard-continue-to-slot-button"
          />
        ) : null}
        {step === 2 ? (
          <WizardFooter
            label="Continue to Your Details"
            disabled={!slot}
            error={submitError}
            onClick={() => slot && setStep(3)}
            testId="booking-wizard-continue-to-details-button"
          />
        ) : null}
        {step === 3 ? (
          <WizardFooter
            label="Confirm Booking"
            disabled={pets.length === 0}
            submitting={submitting}
            error={submitError}
            onClick={handleSubmit}
            testId="booking-wizard-confirm-button"
          />
        ) : null}
      </div>
    </div>
  );
}
