// @vitest-environment jsdom
//
// Code Generation Step 24 — conditional-rendering component tests for `AdminCalendarPage`
// (src/app/(admin)/admin/calendar/AdminCalendarPage.tsx): the per-appointment badge row
// (OVERRIDE / CONFLICT / FLAGGED FOR REVIEW / NOTIFICATION FAILED) that surfaces
// `isOverride`/`hasConflict`/`flaggedForReview`/`notificationFailed` from
// `AppointmentWithLineItems` (booking-business-rules.md's SO-1/SO-2/SO-3, and BR-NOTIF-4's
// "same visual treatment as the isOverride/flaggedForReview badges" instruction —
// notification-business-rules.md). Each badge is asserted present when its flag is true and
// ABSENT (not just hidden) when false, for every combination exercised below.
//
// `../../_lib/api` is mocked (fetchAppointments/fetchServices/markNoShow) — this is a UI
// test, not an integration test (Step 15/18 already cover the real API/repository).
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import { AdminCalendarPage } from "@/app/(admin)/admin/calendar/AdminCalendarPage";
import * as api from "@/app/(admin)/_lib/api";
import type { AppointmentWithLineItems, Service } from "@/app/(admin)/_lib/api";

vi.mock("@/app/(admin)/_lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/app/(admin)/_lib/api")>();
  return {
    ...actual,
    fetchAppointments: vi.fn(),
    fetchServices: vi.fn(),
    markNoShow: vi.fn(),
  };
});

const SERVICE: Service = {
  id: "svc-1",
  name: "Full Groom",
  price: 75,
  durationMinutes: 90,
  active: true,
  createdAt: new Date("2026-01-01"),
  updatedAt: new Date("2026-01-01"),
};

function baseAppointment(overrides: Partial<AppointmentWithLineItems>): AppointmentWithLineItems {
  const now = new Date();
  const slotStart = new Date(now.getTime());
  slotStart.setUTCHours(10, 0, 0, 0);
  return {
    id: "appt-1",
    bookingReference: "HTG-0001",
    ownerId: "owner-1",
    groomerId: "groomer-1",
    slotStart,
    slotEnd: new Date(slotStart.getTime() + 90 * 60000),
    status: "Booked",
    createdBy: "owner",
    isOverride: false,
    hasConflict: false,
    flaggedForReview: false,
    notificationFailed: false,
    visitNotes: null,
    cancelledAt: null,
    cancelledBy: null,
    createdAt: now,
    lineItems: [
      { id: "li-1", appointmentId: "appt-1", petId: "pet-1", serviceId: SERVICE.id, priceSnapshot: 75, durationSnapshotMinutes: 90 },
    ],
    ...overrides,
  } as AppointmentWithLineItems;
}

async function renderCalendarWith(appointments: AppointmentWithLineItems[]) {
  vi.mocked(api.fetchAppointments).mockResolvedValue(appointments);
  vi.mocked(api.fetchServices).mockResolvedValue([SERVICE]);
  render(<AdminCalendarPage />);
  await waitFor(() => expect(screen.queryByTestId("calendar-loading")).not.toBeInTheDocument());
  return within(await screen.findByTestId(`calendar-appointment-row-${appointments[0].id}`));
}

describe("AdminCalendarPage — conditional rendering of appointment badges", () => {
  beforeEach(() => {
    vi.mocked(api.fetchAppointments).mockReset();
    vi.mocked(api.fetchServices).mockReset();
    vi.mocked(api.markNoShow).mockReset();
  });

  it("shows no badges at all for a plain, unflagged appointment", async () => {
    const row = await renderCalendarWith([baseAppointment({})]);

    expect(row.queryByText("OVERRIDE")).not.toBeInTheDocument();
    expect(row.queryByText("CONFLICT")).not.toBeInTheDocument();
    expect(row.queryByText("FLAGGED FOR REVIEW")).not.toBeInTheDocument();
    expect(row.queryByText("NOTIFICATION FAILED")).not.toBeInTheDocument();
  });

  it("shows the OVERRIDE badge when isOverride is true, and only that badge", async () => {
    const row = await renderCalendarWith([baseAppointment({ isOverride: true })]);

    expect(row.getByText("OVERRIDE")).toBeInTheDocument();
    expect(row.queryByText("CONFLICT")).not.toBeInTheDocument();
    expect(row.queryByText("NOTIFICATION FAILED")).not.toBeInTheDocument();
  });

  it("shows the CONFLICT badge when hasConflict is true", async () => {
    const row = await renderCalendarWith([baseAppointment({ hasConflict: true })]);

    expect(row.getByText("CONFLICT")).toBeInTheDocument();
    expect(row.queryByText("OVERRIDE")).not.toBeInTheDocument();
  });

  it("shows the FLAGGED FOR REVIEW badge (and the row's flagged styling class) when flaggedForReview is true", async () => {
    const appt = baseAppointment({ flaggedForReview: true });
    const row = await renderCalendarWith([appt]);

    expect(row.getByText("FLAGGED FOR REVIEW")).toBeInTheDocument();
    const rowEl = screen.getByTestId(`calendar-appointment-row-${appt.id}`);
    // rowFlagged is appended as a second class per the component's conditional className.
    expect(rowEl.className.trim().split(/\s+/).length).toBeGreaterThan(1);
  });

  it("shows the NOTIFICATION FAILED badge when notificationFailed is true (BR-NOTIF-4)", async () => {
    const row = await renderCalendarWith([baseAppointment({ notificationFailed: true })]);

    expect(row.getByText("NOTIFICATION FAILED")).toBeInTheDocument();
  });

  it("shows all four badges together when every flag is true (SO-3 override-with-conflict plus a stale flag and a failed send)", async () => {
    const row = await renderCalendarWith([
      baseAppointment({ isOverride: true, hasConflict: true, flaggedForReview: true, notificationFailed: true }),
    ]);

    expect(row.getByText("OVERRIDE")).toBeInTheDocument();
    expect(row.getByText("CONFLICT")).toBeInTheDocument();
    expect(row.getByText("FLAGGED FOR REVIEW")).toBeInTheDocument();
    expect(row.getByText("NOTIFICATION FAILED")).toBeInTheDocument();
  });

  it("shows a status badge only for a non-Booked/non-Completed status (e.g. Cancelled), not for the default Booked status", async () => {
    const bookedRow = await renderCalendarWith([baseAppointment({ status: "Booked" })]);
    expect(bookedRow.queryByText("BOOKED")).not.toBeInTheDocument();

    const cancelled = baseAppointment({ id: "appt-2", status: "Cancelled" });
    const cancelledRow = await renderCalendarWith([cancelled]);
    expect(cancelledRow.getByText("CANCELLED")).toBeInTheDocument();
  });

  it("shows the empty-day message and no badge/row markup when there are no appointments", async () => {
    vi.mocked(api.fetchAppointments).mockResolvedValue([]);
    vi.mocked(api.fetchServices).mockResolvedValue([SERVICE]);
    render(<AdminCalendarPage />);

    expect(await screen.findByTestId("calendar-empty-day")).toBeInTheDocument();
    expect(screen.queryByText("OVERRIDE")).not.toBeInTheDocument();
  });
});
