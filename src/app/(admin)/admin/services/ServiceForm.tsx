"use client";

// `ServiceForm` per frontend-components.md's spec — shared for add/edit, BR-CAT-5 validation
// (all three fields required, price/duration numeric and positive), and the static note
// about BR-CAT-3 (price/duration edits only affect future bookings, never past ones).
import { useState, type FormEvent } from "react";
import { ApiError, createService, updateService, type Service } from "../../_lib/api";
import styles from "./Services.module.css";

export function ServiceForm({
  existingService,
  onSaved,
  onCancel,
}: {
  existingService?: Service;
  onSaved: (service: Service) => void;
  onCancel: () => void;
}) {
  const editing = Boolean(existingService);
  const [name, setName] = useState(existingService?.name ?? "");
  const [price, setPrice] = useState(existingService ? String(existingService.price) : "");
  const [durationMinutes, setDurationMinutes] = useState(
    existingService ? String(existingService.durationMinutes) : "",
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    const trimmedName = name.trim();
    const parsedPrice = Number(price);
    const parsedDuration = Number(durationMinutes);

    if (!trimmedName) {
      setError("Name is required.");
      return;
    }
    if (!Number.isFinite(parsedPrice) || parsedPrice <= 0) {
      setError("Price must be a positive number.");
      return;
    }
    if (!Number.isFinite(parsedDuration) || parsedDuration <= 0) {
      setError("Duration must be a positive number of minutes.");
      return;
    }

    setSubmitting(true);
    try {
      const service = existingService
        ? await updateService(existingService.id, { name: trimmedName, price: parsedPrice, durationMinutes: parsedDuration })
        : await createService({ name: trimmedName, price: parsedPrice, durationMinutes: parsedDuration });
      onSaved(service);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't save this service.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className={styles.formCard} onSubmit={handleSubmit} noValidate data-testid="service-form">
      {error ? (
        <p className={styles.formError} data-testid="service-form-error">
          {error}
        </p>
      ) : null}
      <div className={styles.formGrid}>
        <div>
          <label className={styles.fieldLabel} htmlFor="service-form-name">
            Name
          </label>
          <input
            id="service-form-name"
            className={styles.field}
            value={name}
            onChange={(e) => setName(e.target.value)}
            data-testid="service-form-name-input"
          />
        </div>
        <div>
          <label className={styles.fieldLabel} htmlFor="service-form-price">
            Price ($)
          </label>
          <input
            id="service-form-price"
            className={styles.field}
            type="number"
            min="0"
            step="0.01"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            data-testid="service-form-price-input"
          />
        </div>
        <div>
          <label className={styles.fieldLabel} htmlFor="service-form-duration">
            Duration (min)
          </label>
          <input
            id="service-form-duration"
            className={styles.field}
            type="number"
            min="0"
            step="5"
            value={durationMinutes}
            onChange={(e) => setDurationMinutes(e.target.value)}
            data-testid="service-form-duration-input"
          />
        </div>
      </div>
      <p className={styles.formNote}>
        Price and duration changes only apply going forward — already-booked appointments keep the price and
        duration they were booked at.
      </p>
      <div className={styles.formActions}>
        <button type="button" className={styles.secondaryButton} onClick={onCancel} data-testid="service-form-cancel-button">
          Cancel
        </button>
        <button type="submit" className={styles.primaryButton} disabled={submitting} data-testid="service-form-submit-button">
          {submitting ? "Saving…" : editing ? "Save Changes" : "Add Service"}
        </button>
      </div>
    </form>
  );
}
