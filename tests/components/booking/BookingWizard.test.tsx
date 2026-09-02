// @vitest-environment jsdom
//
// Code Generation Step 24 — state-transition component tests for `BookingWizard`
// (src/app/(public)/book/BookingWizard.tsx): the linear step machine (1 service -> 2 slot
// -> 3 details -> 4 confirmation) documented in the component's own header comment as a
// deliberate single-route, internal-state design. Covers forward navigation gated on each
// step's own precondition (service chosen / slot chosen), the "Change" backward transition,
// the slot-reset side effect when the service changes after a slot was picked, and the
// 409-conflict edge case that sends the wizard back to step 2.
//
// `../_lib/api` is mocked — `fetchServices` (ServiceStep), `fetchAvailability` (SlotStep),
// and `createBooking` (final submit) never hit the network in this file.
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BookingWizard } from "@/app/(public)/book/BookingWizard";
import * as api from "@/app/(public)/_lib/api";
import type { Appointment, Service, Slot } from "@/app/(public)/_lib/api";

// `ConfirmationStep` (rendered on step 4) calls `useRouter` — a real Next.js App Router
// isn't mounted under RTL's plain jsdom render, so this needs the same stub every other
// component test in this suite that reaches a step using `next/navigation` uses.
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

vi.mock("@/app/(public)/_lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/app/(public)/_lib/api")>();
  return {
    ...actual,
    fetchServices: vi.fn(),
    fetchAvailability: vi.fn(),
    createBooking: vi.fn(),
  };
});

const SERVICE_A: Service = {
  id: "svc-a",
  name: "Full Groom",
  price: 75,
  durationMinutes: 90,
  active: true,
  createdAt: new Date("2026-01-01"),
  updatedAt: new Date("2026-01-01"),
};
const SERVICE_B: Service = {
  id: "svc-b",
  name: "Bath Only",
  price: 40,
  durationMinutes: 45,
  active: true,
  createdAt: new Date("2026-01-01"),
  updatedAt: new Date("2026-01-01"),
};

function slotFor(service: Service): Slot {
  const start = new Date();
  start.setUTCDate(start.getUTCDate() + 1);
  start.setUTCHours(10, 0, 0, 0);
  return { start, end: new Date(start.getTime() + service.durationMinutes * 60000), serviceId: service.id };
}

async function goToStep2(user: ReturnType<typeof userEvent.setup>, service: Service = SERVICE_A) {
  const option = await screen.findByTestId(`service-step-option-${service.id}`);
  fireEvent.click(option);
  // Step 1 -> 2 happens synchronously inside handleSelectService.
  await screen.findByTestId(`slot-step-slot-${slotFor(service).start.toISOString()}`);
}

async function goToStep3(user: ReturnType<typeof userEvent.setup>, service: Service = SERVICE_A) {
  await goToStep2(user, service);
  fireEvent.click(screen.getByTestId(`slot-step-slot-${slotFor(service).start.toISOString()}`));
  fireEvent.click(screen.getByTestId("booking-wizard-continue-to-details-button"));
  await screen.findByTestId("details-form-name-input");
}

describe("BookingWizard — step state transitions", () => {
  beforeEach(() => {
    vi.mocked(api.fetchServices).mockReset().mockResolvedValue([SERVICE_A, SERVICE_B]);
    vi.mocked(api.fetchAvailability).mockReset().mockImplementation((serviceId: string) => {
      const service = serviceId === SERVICE_B.id ? SERVICE_B : SERVICE_A;
      return Promise.resolve([slotFor(service)]);
    });
    vi.mocked(api.createBooking).mockReset();
  });

  it("starts on step 1 with the Continue-to-slot button disabled until a service is chosen", async () => {
    render(<BookingWizard initialServiceId={null} />);
    await screen.findByTestId(`service-step-option-${SERVICE_A.id}`);

    expect(screen.getByTestId("booking-wizard-continue-to-slot-button")).toBeDisabled();
  });

  it("advances to step 2 automatically upon selecting a service, and step 2's Continue is disabled until a slot is chosen", async () => {
    const user = userEvent.setup();
    render(<BookingWizard initialServiceId={null} />);
    await goToStep2(user);

    // Step 1 collapses to a "done" summary row; step 2's slot grid is now showing.
    expect(screen.getByText(/SERVICE/)).toBeInTheDocument();
    expect(screen.getByTestId("booking-wizard-continue-to-details-button")).toBeDisabled();
  });

  it("advances to step 3 once a slot is picked and Continue is clicked", async () => {
    const user = userEvent.setup();
    render(<BookingWizard initialServiceId={null} />);
    await goToStep3(user);

    expect(screen.getByTestId("details-form-name-input")).toBeInTheDocument();
    expect(screen.getByTestId("booking-wizard-confirm-button")).toBeInTheDocument();
  });

  it("'Change' on the collapsed service row sends the wizard back to step 1", async () => {
    const user = userEvent.setup();
    render(<BookingWizard initialServiceId={null} />);
    await goToStep2(user);

    fireEvent.click(screen.getByTestId("booking-wizard-change-service-button"));

    expect(await screen.findByTestId(`service-step-option-${SERVICE_A.id}`)).toBeInTheDocument();
  });

  it("changing to a different service after a slot was chosen clears the previously selected slot", async () => {
    const user = userEvent.setup();
    render(<BookingWizard initialServiceId={null} />);
    await goToStep2(user, SERVICE_A);
    fireEvent.click(screen.getByTestId(`slot-step-slot-${slotFor(SERVICE_A).start.toISOString()}`));
    // Continue is now enabled since a slot is selected.
    expect(screen.getByTestId("booking-wizard-continue-to-details-button")).not.toBeDisabled();

    // Go back to step 1 and pick a different service.
    fireEvent.click(screen.getByTestId("booking-wizard-change-service-button"));
    const optionB = await screen.findByTestId(`service-step-option-${SERVICE_B.id}`);
    fireEvent.click(optionB);
    await screen.findByTestId(`slot-step-slot-${slotFor(SERVICE_B).start.toISOString()}`);

    // The slot from service A is gone -> Continue is disabled again until a new slot is picked.
    expect(screen.getByTestId("booking-wizard-continue-to-details-button")).toBeDisabled();
  });

  it("submits from step 3, calls createBooking, and transitions to the step-4 confirmation screen", async () => {
    const user = userEvent.setup();
    const appointment = { id: "appt-1", bookingReference: "HTG-4821", slotStart: slotFor(SERVICE_A).start } as unknown as Appointment;
    vi.mocked(api.createBooking).mockResolvedValue(appointment);

    render(<BookingWizard initialServiceId={null} />);
    await goToStep3(user);

    await user.type(screen.getByTestId("details-form-name-input"), "Jamie Rivera");
    await user.type(screen.getByTestId("details-form-phone-input"), "555-019-4482");
    await user.type(screen.getByTestId("details-form-email-input"), "jamie@example.com");
    await user.type(screen.getByTestId("details-form-pet-name-input-0"), "Biscuit");
    await user.type(screen.getByTestId("details-form-pet-breed-input-0"), "Golden Retriever");
    await user.selectOptions(screen.getByTestId("details-form-pet-size-select-0"), "Medium");

    fireEvent.click(screen.getByTestId("booking-wizard-confirm-button"));

    await waitFor(() => expect(api.createBooking).toHaveBeenCalledOnce());
    // Step 4 renders ConfirmationStep instead of the wizard's own step chrome.
    await waitFor(() => expect(screen.queryByTestId("booking-wizard-confirm-button")).not.toBeInTheDocument());
  });

  it("blocks submission from step 3 with missing required details, staying on step 3 and never calling createBooking", async () => {
    const user = userEvent.setup();
    render(<BookingWizard initialServiceId={null} />);
    await goToStep3(user);

    fireEvent.click(screen.getByTestId("booking-wizard-confirm-button"));

    expect(await screen.findByText("Your name is required.")).toBeInTheDocument();
    expect(screen.getByText("A phone number is required.")).toBeInTheDocument();
    expect(screen.getByText("An email is required.")).toBeInTheDocument();
    expect(screen.getByText("Pet's name is required.")).toBeInTheDocument();
    expect(api.createBooking).not.toHaveBeenCalled();
  });

  it("rejects an invalid email format on step 3 without touching the API", async () => {
    const user = userEvent.setup();
    render(<BookingWizard initialServiceId={null} />);
    await goToStep3(user);

    await user.type(screen.getByTestId("details-form-name-input"), "Jamie Rivera");
    await user.type(screen.getByTestId("details-form-phone-input"), "555-019-4482");
    await user.type(screen.getByTestId("details-form-email-input"), "not-an-email");
    await user.type(screen.getByTestId("details-form-pet-name-input-0"), "Biscuit");
    await user.type(screen.getByTestId("details-form-pet-breed-input-0"), "Golden Retriever");
    await user.selectOptions(screen.getByTestId("details-form-pet-size-select-0"), "Medium");
    fireEvent.click(screen.getByTestId("booking-wizard-confirm-button"));

    expect(await screen.findByText("Enter a valid email address.")).toBeInTheDocument();
    expect(api.createBooking).not.toHaveBeenCalled();
  });

  it("on a 409 (slot taken) conflict, resets the slot and sends the wizard back to step 2 with an explanatory error", async () => {
    const user = userEvent.setup();
    vi.mocked(api.createBooking).mockRejectedValue(new api.ApiError(409, "Slot already taken"));

    render(<BookingWizard initialServiceId={null} />);
    await goToStep3(user);
    await user.type(screen.getByTestId("details-form-name-input"), "Jamie Rivera");
    await user.type(screen.getByTestId("details-form-phone-input"), "555-019-4482");
    await user.type(screen.getByTestId("details-form-email-input"), "jamie@example.com");
    await user.type(screen.getByTestId("details-form-pet-name-input-0"), "Biscuit");
    await user.type(screen.getByTestId("details-form-pet-breed-input-0"), "Golden Retriever");
    await user.selectOptions(screen.getByTestId("details-form-pet-size-select-0"), "Medium");

    fireEvent.click(screen.getByTestId("booking-wizard-confirm-button"));

    // Back on step 2 — the slot grid is visible again (state transition back one step), and
    // the previously-picked slot was cleared, so step 2's own Continue button is disabled
    // again until a fresh slot is picked.
    await screen.findByTestId(`slot-step-slot-${slotFor(SERVICE_A).start.toISOString()}`);
    expect(screen.getByTestId("booking-wizard-continue-to-details-button")).toBeDisabled();
    // Fixed after this test originally surfaced the gap: `submitError` is now also passed to
    // step 2's `WizardFooter`, so the conflict message is visible right where the user lands.
    expect(screen.getByText(/just booked by someone else/)).toBeInTheDocument();
  });

  it("adding a second pet on step 3 renders a second pet block with its own remove button", async () => {
    const user = userEvent.setup();
    render(<BookingWizard initialServiceId={null} />);
    await goToStep3(user);

    fireEvent.click(screen.getByTestId("details-form-add-pet-button"));

    expect(screen.getByTestId("details-form-pet-name-input-1")).toBeInTheDocument();
    expect(screen.getByTestId("details-form-remove-pet-button-1")).toBeInTheDocument();
  });
});
