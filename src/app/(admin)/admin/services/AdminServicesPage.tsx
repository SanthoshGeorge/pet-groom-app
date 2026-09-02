"use client";

// `AdminServicesPage` per frontend-components.md's spec (SO-4). NO MOCKUP COVERS THIS
// SCREEN — built from the spec's props/state/interaction list, matching the mocked-up admin
// screens' shared visual language (`admin-tokens.css`, agenda-row/card shapes) rather than a
// pixel reference. See `_lib/api.ts`'s `fetchServices` header comment for a real, disclosed
// limitation: no admin-scoped "list all services including inactive" API route exists (only
// the module method `catalog.listAllServices()` does — Step 13 never wired it to a route,
// and this step must not add one), so this page's initial load can only show currently-
// active services; it keeps newly created/edited/deactivated services in local state for the
// rest of the session so the list stays accurate as the admin works.
import { useEffect, useState } from "react";
import { ApiError, deactivateService, fetchServices, type Service } from "../../_lib/api";
import { PlusIcon } from "../../_components/icons";
import { ServiceRow } from "./ServiceRow";
import { ServiceForm } from "./ServiceForm";
import { DeactivateServiceConfirm } from "./DeactivateServiceConfirm";
import styles from "./Services.module.css";

export function AdminServicesPage() {
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [editingServiceId, setEditingServiceId] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [deactivatingService, setDeactivatingService] = useState<Service | null>(null);
  const [deactivateError, setDeactivateError] = useState<string | null>(null);
  const [deactivating, setDeactivating] = useState(false);

  useEffect(() => {
    fetchServices()
      .then((result) => {
        setServices(result);
        setLoading(false);
      })
      .catch((err) => {
        setLoadError(err instanceof ApiError ? err.message : "Couldn't load services right now.");
        setLoading(false);
      });
  }, []);

  function upsertService(service: Service) {
    setServices((prev) => {
      const exists = prev.some((s) => s.id === service.id);
      return exists ? prev.map((s) => (s.id === service.id ? service : s)) : [...prev, service];
    });
  }

  function handleSaved(service: Service) {
    upsertService(service);
    setEditingServiceId(null);
    setShowAddForm(false);
  }

  async function handleConfirmDeactivate() {
    if (!deactivatingService) return;
    setDeactivating(true);
    setDeactivateError(null);
    try {
      const service = await deactivateService(deactivatingService.id);
      upsertService(service);
      setDeactivatingService(null);
    } catch (err) {
      setDeactivateError(err instanceof ApiError ? err.message : "Couldn't deactivate this service.");
    } finally {
      setDeactivating(false);
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>Services & Prices</h1>
        {!showAddForm ? (
          <button
            type="button"
            className={styles.addButton}
            onClick={() => setShowAddForm(true)}
            data-testid="admin-services-add-button"
          >
            <PlusIcon />
            Add Service
          </button>
        ) : null}
      </div>
      <p className={styles.subtitle}>Manage the services customers can book, and their prices and durations.</p>

      {loadError ? (
        <p className={styles.error} data-testid="admin-services-load-error">
          {loadError}
        </p>
      ) : null}

      {showAddForm ? (
        <ServiceForm onSaved={handleSaved} onCancel={() => setShowAddForm(false)} />
      ) : null}

      {loading ? (
        <p className={styles.loading} data-testid="admin-services-loading">
          Loading…
        </p>
      ) : (
        <div className={styles.list} data-testid="admin-services-list">
          {services.length === 0 && !showAddForm ? (
            <p className={styles.emptyState} data-testid="admin-services-empty-state">
              No services yet — add your first one above.
            </p>
          ) : null}
          {services.map((service) =>
            editingServiceId === service.id ? (
              <ServiceForm
                key={service.id}
                existingService={service}
                onSaved={handleSaved}
                onCancel={() => setEditingServiceId(null)}
              />
            ) : (
              <ServiceRow
                key={service.id}
                service={service}
                onEdit={() => setEditingServiceId(service.id)}
                onDeactivate={() => setDeactivatingService(service)}
              />
            ),
          )}
        </div>
      )}

      {deactivateError ? (
        <p className={styles.error} data-testid="admin-services-deactivate-error">
          {deactivateError}
        </p>
      ) : null}

      {deactivatingService ? (
        <DeactivateServiceConfirm
          service={deactivatingService}
          onConfirm={handleConfirmDeactivate}
          onCancel={() => setDeactivatingService(null)}
          confirming={deactivating}
        />
      ) : null}
    </div>
  );
}
