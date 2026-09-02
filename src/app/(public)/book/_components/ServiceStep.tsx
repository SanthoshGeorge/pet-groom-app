"use client";

// Step 1 — "choose a service". JUDGMENT CALL / no direct mockup coverage: Public-Booking.dc.html
// only shows this step already resolved (its collapsed "done" summary card, "Full Groom —
// $75 · 90 min"); no artboard depicts the actual picker UI. This screen is built by
// extending the mockup's OWN visual language for a service picker — Main.dc.html's service
// card (icon + name + price/duration, via the shared `getServiceDisplayInfo`/`ServiceIcon`
// helpers) made selectable, inside the booking flow's own "active step" card chrome
// (`ActiveStepCard`) — rather than inventing an unrelated layout.
import { useEffect, useState } from "react";
import { ApiError, fetchServices, type Service } from "../../_lib/api";
import { formatDuration, formatMoney } from "../../_lib/format";
import { getServiceDisplayInfo } from "../../_lib/serviceDisplay";
import { ServiceIcon } from "../../_components/icons";
import { ActiveStepCard } from "./StepCards";
import styles from "./ServiceStep.module.css";

export function ServiceStep({
  selectedServiceId,
  onSelect,
  initialServiceId,
}: {
  selectedServiceId: string | null;
  onSelect: (service: Service) => void;
  /**
   * Best-effort deep link from `/services`' "Book this service →" links (`?serviceId=`).
   * Resolved against the real, just-fetched catalog (never trusted blindly as a valid id)
   * and applied at most once, on first load.
   */
  initialServiceId?: string | null;
}) {
  const [services, setServices] = useState<Service[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchServices()
      .then((result) => {
        if (cancelled) return;
        setServices(result);
        if (initialServiceId) {
          const match = result.find((service) => service.id === initialServiceId);
          if (match) onSelect(match);
        }
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof ApiError ? err.message : "Couldn't load services right now.");
      });
    return () => {
      cancelled = true;
    };
    // Intentionally runs once on mount only — `initialServiceId`/`onSelect` are read from
    // their first-render values so a later manual selection never gets silently overridden.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <ActiveStepCard stepNumber={1} label="SERVICE" title="Choose a service">
      {error ? <p className={styles.error}>{error}</p> : null}
      {!error && !services ? <p className={styles.status}>Loading services…</p> : null}
      {services && services.length === 0 ? (
        <p className={styles.status}>No services are available to book right now.</p>
      ) : null}
      {services && services.length > 0 ? (
        <div className={styles.grid}>
          {services.map((service) => {
            const { icon } = getServiceDisplayInfo(service.name);
            const selected = service.id === selectedServiceId;
            return (
              <button
                type="button"
                key={service.id}
                className={`${styles.option} ${selected ? styles.optionSelected : ""}`}
                onClick={() => onSelect(service)}
                data-testid={`service-step-option-${service.id}`}
                aria-pressed={selected}
              >
                <ServiceIcon icon={icon} className={styles.icon} />
                <span className={styles.optionBody}>
                  <span className={styles.optionName}>{service.name}</span>
                  <span className={styles.optionMeta}>
                    {formatMoney(service.price)} · {formatDuration(service.durationMinutes)}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      ) : null}
    </ActiveStepCard>
  );
}
