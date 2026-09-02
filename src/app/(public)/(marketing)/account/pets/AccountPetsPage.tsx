"use client";

// `AccountPetsPage` per frontend-components.md's spec (RC-1). NO MOCKUP COVERS THIS SCREEN —
// see AuthCard.module.css's header comment.
//
// JUDGMENT CALL — auth gate: the spec's prop is `ownerId` (from session), and the task's own
// instructions for this step spell out the mechanism explicitly: "if the GET
// /api/account/pets call returns 401, redirect to /login" — i.e. a client-side check against
// the real endpoint, the same pattern this file's sibling `HeaderAuthLinks` uses for the
// shared header. So rather than taking an external `ownerId` prop, this component *is* the
// route's top-level client component: it fetches the session-scoped owner itself and treats
// a 401 `ApiError` as "log in first," matching how every other no-mockup page in this app
// (e.g. `ManageBookingFlow`) owns its own data fetching.
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ApiError, fetchAccountPets, type OwnerWithPets, type Pet } from "../../../_lib/api";
import { PetCard } from "./PetCard";
import { PetForm } from "./PetForm";
import formStyles from "../../_auth/AuthCard.module.css";
import styles from "./AccountPets.module.css";

export function AccountPetsPage() {
  const router = useRouter();
  const [owner, setOwner] = useState<OwnerWithPets | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [addingPet, setAddingPet] = useState(false);
  const [editingPetId, setEditingPetId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchAccountPets()
      .then((result) => {
        if (cancelled) return;
        setOwner(result);
        setLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        if (err instanceof ApiError && err.status === 401) {
          router.push("/login?redirectTo=/account/pets");
          return;
        }
        setLoadError(err instanceof ApiError ? err.message : "Couldn't load your pets right now.");
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [router]);

  function handleSaved(pet: Pet) {
    setOwner((prev) => {
      if (!prev) return prev;
      const alreadyHasPet = prev.pets.some((p) => p.id === pet.id);
      return {
        ...prev,
        pets: alreadyHasPet ? prev.pets.map((p) => (p.id === pet.id ? pet : p)) : [...prev.pets, pet],
      };
    });
    setAddingPet(false);
    setEditingPetId(null);
  }

  if (loading) {
    return (
      <div className={styles.page}>
        <h1 className={styles.title}>My Pets</h1>
        <p className={styles.subtitle} data-testid="account-pets-loading">
          Loading…
        </p>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className={styles.page}>
        <h1 className={styles.title}>My Pets</h1>
        <p className={formStyles.error} data-testid="account-pets-load-error">
          {loadError}
        </p>
      </div>
    );
  }

  if (!owner) return null;

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>My Pets</h1>
      <p className={styles.subtitle}>Keep your pets&apos; details up to date so we&apos;re ready for their next visit.</p>

      <div className={styles.petList}>
        {owner.pets.map((pet) =>
          editingPetId === pet.id ? (
            <PetForm key={pet.id} existingPet={pet} onSaved={handleSaved} onCancel={() => setEditingPetId(null)} />
          ) : (
            <PetCard key={pet.id} pet={pet} editable onEdit={() => setEditingPetId(pet.id)} />
          ),
        )}
        {owner.pets.length === 0 && !addingPet ? (
          <p className={styles.emptyState} data-testid="account-pets-empty-state">
            You haven&apos;t added any pets yet.
          </p>
        ) : null}
      </div>

      {addingPet ? (
        <PetForm onSaved={handleSaved} onCancel={() => setAddingPet(false)} />
      ) : (
        <button
          type="button"
          className={styles.addPetButton}
          onClick={() => setAddingPet(true)}
          data-testid="account-pets-add-pet-button"
        >
          + Add a Pet
        </button>
      )}
    </div>
  );
}
