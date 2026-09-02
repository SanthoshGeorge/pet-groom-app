// `PetCard` per frontend-components.md's spec — presentational, no state. Deliberately no
// "Remove" action: `component-methods.md` has no `removePet` method, an open item the spec
// itself flags rather than assumes (see frontend-components.md's "Open item" note under
// `AccountPetsPage`) — not implemented here for the same reason.
import type { Pet } from "../../../_lib/api";
import styles from "./AccountPets.module.css";

export function PetCard({
  pet,
  onEdit,
  editable,
}: {
  pet: Pet;
  onEdit: () => void;
  editable: boolean;
}) {
  return (
    <div className={styles.petCard} data-testid={`pet-card-${pet.id}`}>
      <div className={styles.petCardHeader}>
        <div>
          <h3 className={styles.petName}>{pet.name}</h3>
          <p className={styles.petMeta}>
            {pet.breed} · {pet.size}
            {pet.age != null ? ` · ${pet.age} yr${pet.age === 1 ? "" : "s"}` : ""}
          </p>
        </div>
        {editable ? (
          <button
            type="button"
            className={styles.editButton}
            onClick={onEdit}
            data-testid={`pet-card-edit-button-${pet.id}`}
          >
            Edit
          </button>
        ) : null}
      </div>
      {pet.temperamentNotes ? (
        <p className={styles.petNote}>
          <strong>Temperament:</strong> {pet.temperamentNotes}
        </p>
      ) : null}
      {pet.allergyMedicalNotes ? (
        <p className={styles.petNote}>
          <strong>Allergies / medical:</strong> {pet.allergyMedicalNotes}
        </p>
      ) : null}
    </div>
  );
}
