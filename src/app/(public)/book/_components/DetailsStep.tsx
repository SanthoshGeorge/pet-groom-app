"use client";

// Step 3 — "who should we expect?", Public-Details.dc.html matched pixel-and-copy-faithfully
// for layout/copy. The mockup shows this screen pre-filled and `readonly` (a logged-in
// customer's saved details, per the mockup's own "Booking as a guest · Log in instead"
// framing that implies both paths exist) — this step 20 build is the guest path (RC-2's
// account pre-fill is Step 21's job), so the same fields are real, editable inputs here.
import type { ContactFormState, PetFormEntry } from "../types";
import { PET_SIZES, createEmptyPet } from "../types";
import type { Service } from "../../_lib/api";
import { MailIcon, PlusIcon } from "../../_components/icons";
import { ActiveStepCard } from "./StepCards";
import styles from "./DetailsStep.module.css";

export interface DetailsFieldErrors {
  name?: string;
  phone?: string;
  email?: string;
  pets?: Record<string, { name?: string; breed?: string; size?: string }>;
}

export function DetailsStep({
  service,
  contact,
  onContactChange,
  pets,
  onPetsChange,
  errors,
}: {
  service: Service;
  contact: ContactFormState;
  onContactChange: (contact: ContactFormState) => void;
  pets: PetFormEntry[];
  onPetsChange: (pets: PetFormEntry[]) => void;
  errors: DetailsFieldErrors;
}) {
  function updatePet(key: string, patch: Partial<PetFormEntry>) {
    onPetsChange(pets.map((pet) => (pet.key === key ? { ...pet, ...patch } : pet)));
  }

  function removePet(key: string) {
    onPetsChange(pets.filter((pet) => pet.key !== key));
  }

  return (
    <ActiveStepCard stepNumber={3} label="YOUR DETAILS" title="Who should we expect?">
      <div className={styles.fieldRow}>
        <div>
          <label className={styles.label} htmlFor="details-name">Your name</label>
          <input
            id="details-name"
            className={styles.field}
            value={contact.name}
            onChange={(e) => onContactChange({ ...contact, name: e.target.value })}
            data-testid="details-form-name-input"
          />
          {errors.name ? <p className={styles.fieldError}>{errors.name}</p> : null}
        </div>
        <div>
          <label className={styles.label} htmlFor="details-phone">Phone number</label>
          <input
            id="details-phone"
            className={styles.field}
            type="tel"
            value={contact.phone}
            onChange={(e) => onContactChange({ ...contact, phone: e.target.value })}
            data-testid="details-form-phone-input"
          />
          {errors.phone ? <p className={styles.fieldError}>{errors.phone}</p> : null}
        </div>
      </div>
      <div className={styles.fieldGroup}>
        <label className={styles.label} htmlFor="details-email">Email</label>
        <input
          id="details-email"
          className={styles.field}
          type="email"
          value={contact.email}
          onChange={(e) => onContactChange({ ...contact, email: e.target.value })}
          data-testid="details-form-email-input"
        />
        {errors.email ? <p className={styles.fieldError}>{errors.email}</p> : null}
      </div>

      <div className={styles.divider} />

      {pets.map((pet, index) => {
        const petErrors = errors.pets?.[pet.key];
        return (
          <div className={styles.petBlock} key={pet.key}>
            <div className={styles.petHeader}>
              <h3 className={styles.petTitle}>Pet {index + 1}</h3>
              {index === 0 ? (
                <span className={styles.gettingNote}>Getting: {service.name}</span>
              ) : (
                <button
                  type="button"
                  className={styles.removeButton}
                  onClick={() => removePet(pet.key)}
                  data-testid={`details-form-remove-pet-button-${index}`}
                >
                  Remove
                </button>
              )}
            </div>
            <div className={styles.fieldRow}>
              <div>
                <label className={styles.label} htmlFor={`pet-name-${pet.key}`}>Pet&apos;s name</label>
                <input
                  id={`pet-name-${pet.key}`}
                  className={styles.field}
                  value={pet.name}
                  onChange={(e) => updatePet(pet.key, { name: e.target.value })}
                  data-testid={`details-form-pet-name-input-${index}`}
                />
                {petErrors?.name ? <p className={styles.fieldError}>{petErrors.name}</p> : null}
              </div>
              <div>
                <label className={styles.label} htmlFor={`pet-breed-${pet.key}`}>Breed</label>
                <input
                  id={`pet-breed-${pet.key}`}
                  className={styles.field}
                  value={pet.breed}
                  onChange={(e) => updatePet(pet.key, { breed: e.target.value })}
                  data-testid={`details-form-pet-breed-input-${index}`}
                />
                {petErrors?.breed ? <p className={styles.fieldError}>{petErrors.breed}</p> : null}
              </div>
            </div>
            <div className={styles.fieldRow}>
              <div>
                <label className={styles.label} htmlFor={`pet-size-${pet.key}`}>Size</label>
                <select
                  id={`pet-size-${pet.key}`}
                  className={styles.field}
                  value={pet.size}
                  onChange={(e) => updatePet(pet.key, { size: e.target.value as PetFormEntry["size"] })}
                  data-testid={`details-form-pet-size-select-${index}`}
                >
                  <option value="">Choose a size…</option>
                  {PET_SIZES.map((size) => (
                    <option key={size} value={size}>
                      {size}
                    </option>
                  ))}
                </select>
                {petErrors?.size ? <p className={styles.fieldError}>{petErrors.size}</p> : null}
              </div>
              <div>
                <label className={styles.label} htmlFor={`pet-age-${pet.key}`}>Age (years, optional)</label>
                <input
                  id={`pet-age-${pet.key}`}
                  className={styles.field}
                  type="number"
                  min={0}
                  value={pet.age}
                  onChange={(e) => updatePet(pet.key, { age: e.target.value })}
                  data-testid={`details-form-pet-age-input-${index}`}
                />
              </div>
            </div>
            <div>
              <label className={styles.label} htmlFor={`pet-notes-${pet.key}`}>Notes for the groomer (allergies, temperament, etc.)</label>
              <textarea
                id={`pet-notes-${pet.key}`}
                className={styles.field}
                rows={2}
                value={pet.notes}
                onChange={(e) => updatePet(pet.key, { notes: e.target.value })}
                data-testid={`details-form-pet-notes-input-${index}`}
              />
            </div>
          </div>
        );
      })}

      <button
        type="button"
        className={styles.addPetButton}
        onClick={() => onPetsChange([...pets, createEmptyPet()])}
        data-testid="details-form-add-pet-button"
      >
        <PlusIcon />
        Add another pet to this visit
      </button>

      <div className={styles.notice}>
        <MailIcon className={styles.noticeIcon} />
        <span className={styles.noticeText}>
          Confirmation goes to your email &amp; phone. We&apos;ll text a reminder the day before.
        </span>
      </div>
    </ActiveStepCard>
  );
}
