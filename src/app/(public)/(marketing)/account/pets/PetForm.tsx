"use client";

// Shared `AddPetForm` / `EditPetForm` per frontend-components.md's spec — one component,
// mode determined by whether `existingPet` is passed, exactly as the spec describes.
//
// JUDGMENT CALL: the spec lists `ownerId` as a prop, but `PATCH /api/account/pets` (Step 12)
// resolves the owner from the session cookie server-side and takes no `ownerId` in its body
// (see that route's own header comment) — there's nothing for this component to do with an
// `ownerId` prop, so it's omitted rather than accepted-and-ignored; `savePet` in `_lib/api.ts`
// mirrors the route's real shape instead of the spec's.
import { useState, type FormEvent } from "react";
import { ApiError, savePet, type Pet, type PetSize } from "../../../_lib/api";
import formStyles from "../../_auth/AuthCard.module.css";
import styles from "./AccountPets.module.css";

const PET_SIZES: readonly PetSize[] = ["Small", "Medium", "Large", "XL"];

export function PetForm({
  existingPet,
  onSaved,
  onCancel,
}: {
  existingPet?: Pet;
  onSaved: (pet: Pet) => void;
  onCancel: () => void;
}) {
  const isEdit = Boolean(existingPet);
  const [name, setName] = useState(existingPet?.name ?? "");
  const [breed, setBreed] = useState(existingPet?.breed ?? "");
  const [size, setSize] = useState<PetSize | "">(existingPet?.size ?? "");
  const [age, setAge] = useState(existingPet?.age != null ? String(existingPet.age) : "");
  const [temperamentNotes, setTemperamentNotes] = useState(existingPet?.temperamentNotes ?? "");
  const [allergyMedicalNotes, setAllergyMedicalNotes] = useState(existingPet?.allergyMedicalNotes ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const testPrefix = isEdit ? "edit-pet-form" : "add-pet-form";

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    // Client-side mirror of customer/validation.ts's `validatePetCreateInput` — UX-only, the
    // server re-validates regardless.
    if (!name.trim()) {
      setError("Pet's name is required.");
      return;
    }
    if (!breed.trim()) {
      setError("Breed is required.");
      return;
    }
    if (!size) {
      setError("Choose a size.");
      return;
    }
    let parsedAge: number | null = null;
    if (age.trim()) {
      const n = Number(age);
      if (!Number.isInteger(n) || n < 0) {
        setError("Age must be a non-negative whole number.");
        return;
      }
      parsedAge = n;
    }

    setSubmitting(true);
    try {
      const pet = await savePet({
        petId: existingPet?.id,
        name: name.trim(),
        breed: breed.trim(),
        size,
        age: parsedAge,
        temperamentNotes: temperamentNotes.trim() || null,
        allergyMedicalNotes: allergyMedicalNotes.trim() || null,
      });
      onSaved(pet);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't save this pet. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className={styles.petFormCard} onSubmit={handleSubmit} noValidate>
      <h3 className={styles.petFormTitle}>{isEdit ? `Edit ${existingPet?.name}` : "Add a Pet"}</h3>
      {error ? (
        <p className={formStyles.error} data-testid={`${testPrefix}-error`}>
          {error}
        </p>
      ) : null}
      <div className={styles.fieldRow}>
        <div className={formStyles.fieldGroup}>
          <label className={formStyles.label} htmlFor={`${testPrefix}-name`}>
            Pet&apos;s name
          </label>
          <input
            id={`${testPrefix}-name`}
            className={formStyles.field}
            value={name}
            onChange={(e) => setName(e.target.value)}
            data-testid={`${testPrefix}-name-input`}
          />
        </div>
        <div className={formStyles.fieldGroup}>
          <label className={formStyles.label} htmlFor={`${testPrefix}-breed`}>
            Breed
          </label>
          <input
            id={`${testPrefix}-breed`}
            className={formStyles.field}
            value={breed}
            onChange={(e) => setBreed(e.target.value)}
            data-testid={`${testPrefix}-breed-input`}
          />
        </div>
      </div>
      <div className={styles.fieldRow}>
        <div className={formStyles.fieldGroup}>
          <label className={formStyles.label} htmlFor={`${testPrefix}-size`}>
            Size
          </label>
          <select
            id={`${testPrefix}-size`}
            className={formStyles.field}
            value={size}
            onChange={(e) => setSize(e.target.value as PetSize)}
            data-testid={`${testPrefix}-size-select`}
          >
            <option value="">Choose a size…</option>
            {PET_SIZES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <div className={formStyles.fieldGroup}>
          <label className={formStyles.label} htmlFor={`${testPrefix}-age`}>
            Age (years, optional)
          </label>
          <input
            id={`${testPrefix}-age`}
            className={formStyles.field}
            type="number"
            min={0}
            value={age}
            onChange={(e) => setAge(e.target.value)}
            data-testid={`${testPrefix}-age-input`}
          />
        </div>
      </div>
      <div className={formStyles.fieldGroup}>
        <label className={formStyles.label} htmlFor={`${testPrefix}-temperament`}>
          Temperament notes (optional)
        </label>
        <textarea
          id={`${testPrefix}-temperament`}
          className={formStyles.field}
          rows={2}
          value={temperamentNotes}
          onChange={(e) => setTemperamentNotes(e.target.value)}
          data-testid={`${testPrefix}-temperament-input`}
        />
      </div>
      <div className={formStyles.fieldGroup}>
        <label className={formStyles.label} htmlFor={`${testPrefix}-allergy`}>
          Allergy / medical notes (optional)
        </label>
        <textarea
          id={`${testPrefix}-allergy`}
          className={formStyles.field}
          rows={2}
          value={allergyMedicalNotes}
          onChange={(e) => setAllergyMedicalNotes(e.target.value)}
          data-testid={`${testPrefix}-allergy-input`}
        />
      </div>
      <div className={formStyles.actionsRow}>
        <button type="submit" className={formStyles.btnPrimary} disabled={submitting} data-testid={`${testPrefix}-save-button`}>
          {submitting ? "Saving…" : isEdit ? "Save Changes" : "Add Pet"}
        </button>
        <button
          type="button"
          className={formStyles.btnSecondary}
          onClick={onCancel}
          disabled={submitting}
          data-testid={`${testPrefix}-cancel-button`}
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
