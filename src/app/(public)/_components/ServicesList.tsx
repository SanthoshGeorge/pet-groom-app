"use client";

// Real, interactive data fetch against `GET /api/services` (Step 12) — used by both the
// home page's "Our Services" teaser (`limit={4}`) and the full `/services` menu (no
// limit). Loading/error states are real, not decorative: the catalog is admin-managed and
// this is a live network call, not a static mockup render.
import { useEffect, useState } from "react";
import { fetchServices, type Service, ApiError } from "../_lib/api";
import { ServiceCard } from "./ServiceCard";
import styles from "./ServicesList.module.css";

export function ServicesList({ limit, showBookLinks = false }: { limit?: number; showBookLinks?: boolean }) {
  const [services, setServices] = useState<Service[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchServices()
      .then((result) => {
        if (!cancelled) setServices(result);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof ApiError ? err.message : "Couldn't load services right now.");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (error) {
    return (
      <p className={styles.error} data-testid="services-list-error">
        {error}
      </p>
    );
  }

  if (!services) {
    return (
      <p className={styles.status} data-testid="services-list-loading">
        Loading services…
      </p>
    );
  }

  if (services.length === 0) {
    return (
      <p className={styles.status} data-testid="services-list-empty">
        No services are available to book right now — please check back soon.
      </p>
    );
  }

  const shown = typeof limit === "number" ? services.slice(0, limit) : services;

  return (
    <div className={styles.grid} data-testid="services-list-grid">
      {shown.map((service) => (
        <ServiceCard key={service.id} service={service} showBookLink={showBookLinks} />
      ))}
    </div>
  );
}
