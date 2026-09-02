// @vitest-environment jsdom
//
// Code Generation Step 24 — state-transition component tests for `ManageBookingFlow`
// (src/app/(public)/(marketing)/manage-booking/ManageBookingFlow.tsx): its `phase`
// ("lookup" -> "result") transition (GC-3, BR-BOOK-5/6), the guest-lookup form validation
// that gates it, and the cancel-confirmation sub-state within the result phase.
//
// `../../_lib/api` is mocked — `lookupBooking`/`cancelBooking`/`fetchServices` never hit
// the network here; BR-BOOK-5's actual generic-error guarantee is Step 15's job (this file
// only checks the component renders whatever message the (mocked) API call throws, without
// adding branching of its own).
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ManageBookingFlow } from "@/app/(public)/(marketing)/manage-booking/ManageBookingFlow";
import * as api from "@/app/(public)/_lib/api";
import type { AppointmentWithLineItems } from "@/app/(public)/_lib/api";

vi.mock("@/app/(public)/_lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/app/(public)/_lib/api")>();
  return {
    ...actual,
    lookupBooking: vi.fn(),
    cancelBooking: vi.fn(),
    rescheduleBooking: vi.fn(),
    fetchAvailability: vi.fn(),
    fetchServices: vi.fn(),
  };
});

function foundAppointment(overrides: Partial<AppointmentWithLineItems> = {}): AppointmentWithLineItems {
  return {
    id: "appt-1",
    bookingReference: "HTG-4821",
    ownerId: "owner-1",
    groomerId: "groomer-1",
    slotStart: new Date("2026-09-10T14:00:00.000Z"),
    slotEnd: new Date("2026-09-10T15:30:00.000Z"),
    status: "Booked",
    createdBy: "guest",
    isOverride: false,
    hasConflict: false,
    flaggedForReview: false,
    notificationFailed: false,
    visitNotes: null,
    cancelledAt: null,
    cancelledBy: null,
    createdAt: new Date("2026-09-01T00:00:00.000Z"),
    lineItems: [
      { id: "li-1", appointmentId: "appt-1", petId: "pet-1", serviceId: "svc-1", priceSnapshot: 75, durationSnapshotMinutes: 90 },
    ],
    ...overrides,
  } as AppointmentWithLineItems;
}

describe("ManageBookingFlow — lookup -> result phase transition", () => {
  beforeEach(() => {
    vi.mocked(api.lookupBooking).mockReset();
    vi.mocked(api.cancelBooking).mockReset();
    vi.mocked(api.rescheduleBooking).mockReset();
    vi.mocked(api.fetchAvailability).mockReset();
    vi.mocked(api.fetchServices).mockReset().mockResolvedValue([]);
  });

  it("starts in the lookup phase, showing the lookup form", () => {
    render(<ManageBookingFlow initialReference="" />);
    expect(screen.getByTestId("booking-lookup-submit-button")).toBeInTheDocument();
    expect(screen.queryByTestId("booking-status-badge")).not.toBeInTheDocument();
  });

  it("blocks lookup when the confirmation number is empty", async () => {
    render(<ManageBookingFlow initialReference="" />);
    fireEvent.click(screen.getByTestId("booking-lookup-submit-button"));

    expect(await screen.findByTestId("booking-lookup-error")).toHaveTextContent("Enter your confirmation number.");
    expect(api.lookupBooking).not.toHaveBeenCalled();
  });

  it("blocks lookup when neither email nor phone is provided", async () => {
    const user = userEvent.setup();
    render(<ManageBookingFlow initialReference="" />);
    await user.type(screen.getByTestId("booking-lookup-reference-input"), "HTG-4821");
    fireEvent.click(screen.getByTestId("booking-lookup-submit-button"));

    expect(await screen.findByTestId("booking-lookup-error")).toHaveTextContent(
      "Enter the email or phone number used to book.",
    );
    expect(api.lookupBooking).not.toHaveBeenCalled();
  });

  it("transitions from lookup to result phase on a successful lookup", async () => {
    const user = userEvent.setup();
    vi.mocked(api.lookupBooking).mockResolvedValue(foundAppointment());
    render(<ManageBookingFlow initialReference="" />);

    await user.type(screen.getByTestId("booking-lookup-reference-input"), "HTG-4821");
    await user.type(screen.getByTestId("booking-lookup-email-input"), "jamie@example.com");
    fireEvent.click(screen.getByTestId("booking-lookup-submit-button"));

    expect(await screen.findByTestId("booking-status-badge")).toHaveTextContent("Booked");
    expect(screen.queryByTestId("booking-lookup-submit-button")).not.toBeInTheDocument();
    expect(screen.getByTestId("booking-lookup-cancel-button")).toBeInTheDocument();
    expect(screen.getByTestId("booking-lookup-reschedule-button")).toBeInTheDocument();
  });

  it("shows BR-BOOK-5's generic not-found message verbatim on a failed lookup, staying on the lookup phase", async () => {
    const user = userEvent.setup();
    vi.mocked(api.lookupBooking).mockRejectedValue(
      new api.ApiError(404, "No booking found matching that reference and contact information"),
    );
    render(<ManageBookingFlow initialReference="" />);

    await user.type(screen.getByTestId("booking-lookup-reference-input"), "HTG-9999");
    await user.type(screen.getByTestId("booking-lookup-phone-input"), "555-000-0000");
    fireEvent.click(screen.getByTestId("booking-lookup-submit-button"));

    expect(await screen.findByTestId("booking-lookup-error")).toHaveTextContent(
      "No booking found matching that reference and contact information",
    );
    expect(screen.getByTestId("booking-lookup-submit-button")).toBeInTheDocument();
  });

  it("does not offer cancel/reschedule actions for a non-Booked (e.g. Completed) appointment", async () => {
    const user = userEvent.setup();
    vi.mocked(api.lookupBooking).mockResolvedValue(foundAppointment({ status: "Completed" }));
    render(<ManageBookingFlow initialReference="" />);

    await user.type(screen.getByTestId("booking-lookup-reference-input"), "HTG-4821");
    await user.type(screen.getByTestId("booking-lookup-email-input"), "jamie@example.com");
    fireEvent.click(screen.getByTestId("booking-lookup-submit-button"));

    await screen.findByTestId("booking-status-badge");
    expect(screen.queryByTestId("booking-lookup-cancel-button")).not.toBeInTheDocument();
    expect(screen.queryByTestId("booking-lookup-reschedule-button")).not.toBeInTheDocument();
    expect(screen.getByText("This appointment can no longer be cancelled or rescheduled online.")).toBeInTheDocument();
  });

  it("clicking Cancel Appointment opens a confirm sub-state, and confirming transitions the badge to Cancelled", async () => {
    const user = userEvent.setup();
    vi.mocked(api.lookupBooking).mockResolvedValue(foundAppointment());
    vi.mocked(api.cancelBooking).mockResolvedValue(foundAppointment({ status: "Cancelled" }));
    render(<ManageBookingFlow initialReference="" />);
    await user.type(screen.getByTestId("booking-lookup-reference-input"), "HTG-4821");
    await user.type(screen.getByTestId("booking-lookup-email-input"), "jamie@example.com");
    fireEvent.click(screen.getByTestId("booking-lookup-submit-button"));
    await screen.findByTestId("booking-lookup-cancel-button");

    fireEvent.click(screen.getByTestId("booking-lookup-cancel-button"));
    expect(await screen.findByTestId("booking-lookup-confirm-cancel-button")).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("booking-lookup-confirm-cancel-button"));

    await waitFor(() => expect(screen.getByTestId("booking-status-badge")).toHaveTextContent("Cancelled"));
    expect(screen.queryByTestId("booking-lookup-confirm-cancel-button")).not.toBeInTheDocument();
  });

  it("'Never Mind' dismisses the cancel-confirm sub-state without calling cancelBooking", async () => {
    const user = userEvent.setup();
    vi.mocked(api.lookupBooking).mockResolvedValue(foundAppointment());
    render(<ManageBookingFlow initialReference="" />);
    await user.type(screen.getByTestId("booking-lookup-reference-input"), "HTG-4821");
    await user.type(screen.getByTestId("booking-lookup-email-input"), "jamie@example.com");
    fireEvent.click(screen.getByTestId("booking-lookup-submit-button"));
    await screen.findByTestId("booking-lookup-cancel-button");
    fireEvent.click(screen.getByTestId("booking-lookup-cancel-button"));
    await screen.findByTestId("booking-lookup-dismiss-cancel-button");

    fireEvent.click(screen.getByTestId("booking-lookup-dismiss-cancel-button"));

    expect(screen.queryByTestId("booking-lookup-confirm-cancel-button")).not.toBeInTheDocument();
    expect(api.cancelBooking).not.toHaveBeenCalled();
  });

  it("'Look up a different booking' resets from the result phase back to the lookup phase", async () => {
    const user = userEvent.setup();
    vi.mocked(api.lookupBooking).mockResolvedValue(foundAppointment());
    render(<ManageBookingFlow initialReference="" />);
    await user.type(screen.getByTestId("booking-lookup-reference-input"), "HTG-4821");
    await user.type(screen.getByTestId("booking-lookup-email-input"), "jamie@example.com");
    fireEvent.click(screen.getByTestId("booking-lookup-submit-button"));
    await screen.findByTestId("booking-lookup-start-over-button");

    fireEvent.click(screen.getByTestId("booking-lookup-start-over-button"));

    expect(await screen.findByTestId("booking-lookup-submit-button")).toBeInTheDocument();
    expect(screen.queryByTestId("booking-status-badge")).not.toBeInTheDocument();
  });
});
