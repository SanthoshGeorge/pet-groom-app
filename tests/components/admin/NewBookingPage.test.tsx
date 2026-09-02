// @vitest-environment jsdom
//
// Code Generation Step 24 — component tests for `NewBookingPage`
// (src/app/(admin)/admin/bookings/new/NewBookingPage.tsx):
//   1. Form validation — the required-field checks `handleSubmit` runs before ever calling
//      `createAdminBooking` (contact name/phone/email, service, pet name/breed, a chosen
//      slot), in the order the component checks them.
//   2. Conditional rendering — the post-booking success banner's conflict/override copy,
//      driven by the *returned* appointment's `hasConflict`/`isOverride` fields (SO-3,
//      booking-business-rules.md; BR-AVAIL-10's conflict-warning-but-still-confirmed case).
//
// `../../../_lib/api` is fully mocked — this is a UI test, not an integration test (Step
// 15/18 already cover `POST /api/admin/bookings` itself).
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useRouter } from "next/navigation";
import { NewBookingPage } from "@/app/(admin)/admin/bookings/new/NewBookingPage";
import * as api from "@/app/(admin)/_lib/api";
import type { AppointmentWithLineItems, Service, Slot } from "@/app/(admin)/_lib/api";

vi.mock("next/navigation", () => ({
  useRouter: vi.fn(() => ({ push: vi.fn() })),
}));

vi.mock("@/app/(admin)/_lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/app/(admin)/_lib/api")>();
  return {
    ...actual,
    fetchServices: vi.fn(),
    fetchSlots: vi.fn(),
    createAdminBooking: vi.fn(),
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

function todaySlot(): Slot {
  const start = new Date();
  start.setUTCHours(10, 0, 0, 0);
  return { start, end: new Date(start.getTime() + 90 * 60000), serviceId: SERVICE.id };
}

function completedAppointment(overrides: Partial<AppointmentWithLineItems>): AppointmentWithLineItems {
  const slot = todaySlot();
  return {
    id: "appt-1",
    bookingReference: "HTG-4821",
    ownerId: "owner-1",
    groomerId: "groomer-1",
    slotStart: slot.start,
    slotEnd: slot.end,
    status: "Booked",
    createdBy: "owner",
    isOverride: false,
    hasConflict: false,
    flaggedForReview: false,
    notificationFailed: false,
    visitNotes: null,
    cancelledAt: null,
    cancelledBy: null,
    createdAt: new Date(),
    lineItems: [
      { id: "li-1", appointmentId: "appt-1", petId: "pet-1", serviceId: SERVICE.id, priceSnapshot: 75, durationSnapshotMinutes: 90 },
    ],
    ...overrides,
  } as AppointmentWithLineItems;
}

async function fillAndSelectSlot(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByTestId("new-booking-customer-name-input"), "Jamie Rivera");
  await user.type(screen.getByTestId("new-booking-customer-phone-input"), "555-019-4482");
  await user.type(screen.getByTestId("new-booking-customer-email-input"), "jamie@example.com");
  await user.selectOptions(screen.getByTestId("new-booking-service-select"), SERVICE.id);
  await user.type(screen.getByTestId("new-booking-pet-name-input"), "Biscuit");
  await user.type(screen.getByTestId("new-booking-pet-breed-input"), "Golden Retriever");
  const grid = await screen.findByTestId("new-booking-slot-grid");
  const slotButton = grid.querySelector("button") as HTMLButtonElement;
  fireEvent.click(slotButton);
}

describe("NewBookingPage", () => {
  beforeEach(() => {
    vi.mocked(api.fetchServices).mockReset().mockResolvedValue([SERVICE]);
    vi.mocked(api.fetchSlots).mockReset().mockResolvedValue([todaySlot()]);
    vi.mocked(api.createAdminBooking).mockReset();
    vi.mocked(useRouter).mockReturnValue({ push: vi.fn() } as unknown as ReturnType<typeof useRouter>);
  });

  describe("form validation", () => {
    it("rejects submission with everything empty, requiring contact info first", async () => {
      render(<NewBookingPage />);
      await screen.findByTestId("new-booking-service-select");

      fireEvent.click(screen.getByTestId("new-booking-submit-button"));

      expect(await screen.findByTestId("new-booking-submit-error")).toHaveTextContent(
        "Enter the customer's name, phone, and email.",
      );
      expect(api.createAdminBooking).not.toHaveBeenCalled();
    });

    it("requires a service once contact info is filled", async () => {
      const user = userEvent.setup();
      render(<NewBookingPage />);
      await user.type(screen.getByTestId("new-booking-customer-name-input"), "Jamie Rivera");
      await user.type(screen.getByTestId("new-booking-customer-phone-input"), "555-019-4482");
      await user.type(screen.getByTestId("new-booking-customer-email-input"), "jamie@example.com");
      fireEvent.click(screen.getByTestId("new-booking-submit-button"));

      expect(await screen.findByTestId("new-booking-submit-error")).toHaveTextContent("Choose a service.");
      expect(api.createAdminBooking).not.toHaveBeenCalled();
    });

    it("requires pet name/breed once contact and service are filled", async () => {
      const user = userEvent.setup();
      render(<NewBookingPage />);
      await user.type(screen.getByTestId("new-booking-customer-name-input"), "Jamie Rivera");
      await user.type(screen.getByTestId("new-booking-customer-phone-input"), "555-019-4482");
      await user.type(screen.getByTestId("new-booking-customer-email-input"), "jamie@example.com");
      await user.selectOptions(screen.getByTestId("new-booking-service-select"), SERVICE.id);
      fireEvent.click(screen.getByTestId("new-booking-submit-button"));

      expect(await screen.findByTestId("new-booking-submit-error")).toHaveTextContent(
        "Enter the pet's name and breed.",
      );
      expect(api.createAdminBooking).not.toHaveBeenCalled();
    });

    it("requires a chosen time slot once every other field is filled", async () => {
      const user = userEvent.setup();
      render(<NewBookingPage />);
      await user.type(screen.getByTestId("new-booking-customer-name-input"), "Jamie Rivera");
      await user.type(screen.getByTestId("new-booking-customer-phone-input"), "555-019-4482");
      await user.type(screen.getByTestId("new-booking-customer-email-input"), "jamie@example.com");
      await user.selectOptions(screen.getByTestId("new-booking-service-select"), SERVICE.id);
      await user.type(screen.getByTestId("new-booking-pet-name-input"), "Biscuit");
      await user.type(screen.getByTestId("new-booking-pet-breed-input"), "Golden Retriever");
      fireEvent.click(screen.getByTestId("new-booking-submit-button"));

      expect(await screen.findByTestId("new-booking-submit-error")).toHaveTextContent("Choose a time slot.");
      expect(api.createAdminBooking).not.toHaveBeenCalled();
    });
  });

  describe("conditional rendering — post-booking conflict/override banner (SO-3)", () => {
    it("shows a plain 'Booking confirmed' success with no conflict/override copy for a normal booking", async () => {
      const user = userEvent.setup();
      vi.mocked(api.createAdminBooking).mockResolvedValue(
        completedAppointment({ isOverride: false, hasConflict: false }),
      );
      render(<NewBookingPage />);
      await fillAndSelectSlot(user);
      fireEvent.click(screen.getByTestId("new-booking-submit-button"));

      const success = await screen.findByTestId("new-booking-success");
      expect(success).toHaveTextContent("Booking confirmed");
      expect(success).not.toHaveTextContent("scheduling conflict");
      const body = screen.getByTestId("new-booking-success-body");
      expect(body).not.toHaveTextContent("override");
      expect(body).not.toHaveTextContent("overlaps another");
    });

    it("shows the override note (but not the conflict warning) when isOverride is true and hasConflict is false", async () => {
      const user = userEvent.setup();
      vi.mocked(api.createAdminBooking).mockResolvedValue(
        completedAppointment({ isOverride: true, hasConflict: false }),
      );
      render(<NewBookingPage />);
      await fillAndSelectSlot(user);
      fireEvent.click(screen.getByTestId("new-booking-submit-button"));

      const success = await screen.findByTestId("new-booking-success");
      expect(success).toHaveTextContent("Booking confirmed");
      const body = screen.getByTestId("new-booking-success-body");
      expect(body).toHaveTextContent("This was booked outside normal hours/buffer (override).");
      expect(body).not.toHaveTextContent("overlaps another");
    });

    it("shows the conflict warning banner and heading when hasConflict is true", async () => {
      const user = userEvent.setup();
      vi.mocked(api.createAdminBooking).mockResolvedValue(
        completedAppointment({ isOverride: true, hasConflict: true }),
      );
      render(<NewBookingPage />);
      await fillAndSelectSlot(user);
      fireEvent.click(screen.getByTestId("new-booking-submit-button"));

      const success = await screen.findByTestId("new-booking-success");
      expect(success).toHaveTextContent("Booked — with a scheduling conflict");
      const body = screen.getByTestId("new-booking-success-body");
      expect(body).toHaveTextContent("It overlaps another already-booked appointment — double-check the schedule.");
      expect(body).toHaveTextContent("This was booked outside normal hours/buffer (override).");
    });
  });

  describe("state: override toggle disables dashed (override-only) slots", () => {
    it("disables an override-only slot until the toggle is turned on", async () => {
      const user = userEvent.setup();
      // No normal slots for the day -> every rendered slot is override-only.
      vi.mocked(api.fetchSlots).mockResolvedValue([]);
      render(<NewBookingPage />);
      await user.selectOptions(await screen.findByTestId("new-booking-service-select"), SERVICE.id);

      const emptyMessage = await screen.findByTestId("new-booking-slots-empty");
      expect(emptyMessage).toHaveTextContent("turn on override to book outside normal hours");

      fireEvent.click(screen.getByTestId("new-booking-override-toggle"));
      const grid = await screen.findByTestId("new-booking-slot-grid");
      const firstSlotButton = grid.querySelector("button") as HTMLButtonElement;
      expect(firstSlotButton).not.toBeDisabled();
    });
  });
});
