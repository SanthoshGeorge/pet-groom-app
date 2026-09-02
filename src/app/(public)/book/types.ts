// Shared form-state shapes for the booking wizard.
import type { PetSize } from "../_lib/api";

export interface ContactFormState {
  name: string;
  phone: string;
  email: string;
}

export interface PetFormEntry {
  /** Stable client-side key (list rendering / remove) — not sent to the API. */
  key: string;
  name: string;
  breed: string;
  size: PetSize | "";
  /** Raw text input; parsed to a number (or omitted) at submit time. */
  age: string;
  /**
   * The mockup's Public-Details.dc.html shows exactly one "Notes for the groomer
   * (allergies, temperament, etc.)" field per pet — not the two separate
   * `temperamentNotes`/`allergyMedicalNotes` fields FR-11/the domain model actually store.
   * JUDGMENT CALL: matched the mockup's single visible field pixel-and-copy-faithfully,
   * and mapped its value to `temperamentNotes` at submit time (see `book/api-adapter.ts`)
   * — `allergyMedicalNotes` is left unset by this flow. Called out in the Step 20 report.
   */
  notes: string;
}

export function createEmptyPet(): PetFormEntry {
  return {
    key: typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `pet-${Date.now()}-${Math.random()}`,
    name: "",
    breed: "",
    size: "",
    age: "",
    notes: "",
  };
}

export const PET_SIZES: readonly PetSize[] = ["Small", "Medium", "Large", "XL"];
