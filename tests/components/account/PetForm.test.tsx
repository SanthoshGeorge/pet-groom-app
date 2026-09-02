// @vitest-environment jsdom
//
// Code Generation Step 24 — form-validation component tests for `PetForm`
// (src/app/(public)/(marketing)/account/pets/PetForm.tsx), the shared add/edit pet form.
// The component's own header comment calls its validation "a client-side mirror of
// customer/validation.ts's `validatePetCreateInput`" (BR-CUST-* territory, already covered
// server-side by Steps 10/15) — these tests check that the UX-only mirror actually blocks
// submission and shows the right message, plus the add-vs-edit mode switch.
//
// `../../../_lib/api`'s `savePet` is mocked — network behavior is Step 15's job.
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PetForm } from "@/app/(public)/(marketing)/account/pets/PetForm";
import * as api from "@/app/(public)/_lib/api";

vi.mock("@/app/(public)/_lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/app/(public)/_lib/api")>();
  return {
    ...actual,
    savePet: vi.fn(),
  };
});

describe("PetForm — form validation", () => {
  beforeEach(() => {
    vi.mocked(api.savePet).mockReset();
  });

  it("add mode: rejects an empty submission with a name-required error", async () => {
    render(<PetForm onSaved={vi.fn()} onCancel={vi.fn()} />);

    fireEvent.click(screen.getByTestId("add-pet-form-save-button"));

    expect(await screen.findByTestId("add-pet-form-error")).toHaveTextContent("Pet's name is required.");
    expect(api.savePet).not.toHaveBeenCalled();
  });

  it("add mode: requires breed once name is filled", async () => {
    const user = userEvent.setup();
    render(<PetForm onSaved={vi.fn()} onCancel={vi.fn()} />);

    await user.type(screen.getByTestId("add-pet-form-name-input"), "Biscuit");
    fireEvent.click(screen.getByTestId("add-pet-form-save-button"));

    expect(await screen.findByTestId("add-pet-form-error")).toHaveTextContent("Breed is required.");
    expect(api.savePet).not.toHaveBeenCalled();
  });

  it("add mode: requires a size once name and breed are filled", async () => {
    const user = userEvent.setup();
    render(<PetForm onSaved={vi.fn()} onCancel={vi.fn()} />);

    await user.type(screen.getByTestId("add-pet-form-name-input"), "Biscuit");
    await user.type(screen.getByTestId("add-pet-form-breed-input"), "Golden Retriever");
    fireEvent.click(screen.getByTestId("add-pet-form-save-button"));

    expect(await screen.findByTestId("add-pet-form-error")).toHaveTextContent("Choose a size.");
    expect(api.savePet).not.toHaveBeenCalled();
  });

  it("add mode: rejects a negative age", async () => {
    const user = userEvent.setup();
    render(<PetForm onSaved={vi.fn()} onCancel={vi.fn()} />);

    await user.type(screen.getByTestId("add-pet-form-name-input"), "Biscuit");
    await user.type(screen.getByTestId("add-pet-form-breed-input"), "Golden Retriever");
    await user.selectOptions(screen.getByTestId("add-pet-form-size-select"), "Medium");
    await user.type(screen.getByTestId("add-pet-form-age-input"), "-1");
    fireEvent.click(screen.getByTestId("add-pet-form-save-button"));

    expect(await screen.findByTestId("add-pet-form-error")).toHaveTextContent(
      "Age must be a non-negative whole number.",
    );
    expect(api.savePet).not.toHaveBeenCalled();
  });

  it("add mode: submits with valid required fields and no age (optional), then reports the new pet", async () => {
    const user = userEvent.setup();
    const savedPet = { id: "pet-1", name: "Biscuit", breed: "Golden Retriever", size: "Medium" } as unknown as api.Pet;
    vi.mocked(api.savePet).mockResolvedValue(savedPet);
    const onSaved = vi.fn();

    render(<PetForm onSaved={onSaved} onCancel={vi.fn()} />);
    await user.type(screen.getByTestId("add-pet-form-name-input"), "Biscuit");
    await user.type(screen.getByTestId("add-pet-form-breed-input"), "Golden Retriever");
    await user.selectOptions(screen.getByTestId("add-pet-form-size-select"), "Medium");
    fireEvent.click(screen.getByTestId("add-pet-form-save-button"));

    await waitFor(() => expect(onSaved).toHaveBeenCalledWith(savedPet));
    expect(api.savePet).toHaveBeenCalledWith({
      petId: undefined,
      name: "Biscuit",
      breed: "Golden Retriever",
      size: "Medium",
      age: null,
      temperamentNotes: null,
      allergyMedicalNotes: null,
    });
  });

  it("edit mode: pre-fills every field from existingPet and posts petId with savePet", async () => {
    const user = userEvent.setup();
    const existingPet = {
      id: "pet-9",
      name: "Waffles",
      breed: "Beagle",
      size: "Small",
      age: 3,
      temperamentNotes: "Shy around clippers",
      allergyMedicalNotes: null,
    } as unknown as api.Pet;
    const updated = { ...existingPet, temperamentNotes: "Calmer now" };
    vi.mocked(api.savePet).mockResolvedValue(updated);
    const onSaved = vi.fn();

    render(<PetForm existingPet={existingPet} onSaved={onSaved} onCancel={vi.fn()} />);

    expect(screen.getByTestId("edit-pet-form-name-input")).toHaveValue("Waffles");
    expect(screen.getByTestId("edit-pet-form-breed-input")).toHaveValue("Beagle");
    expect(screen.getByTestId("edit-pet-form-age-input")).toHaveValue(3);
    expect(screen.getByTestId("edit-pet-form-save-button")).toHaveTextContent("Save Changes");

    await user.clear(screen.getByTestId("edit-pet-form-temperament-input"));
    await user.type(screen.getByTestId("edit-pet-form-temperament-input"), "Calmer now");
    fireEvent.click(screen.getByTestId("edit-pet-form-save-button"));

    await waitFor(() => expect(onSaved).toHaveBeenCalledWith(updated));
    expect(api.savePet).toHaveBeenCalledWith(
      expect.objectContaining({ petId: "pet-9", temperamentNotes: "Calmer now" }),
    );
  });

  it("surfaces a server ApiError message on failed save", async () => {
    const user = userEvent.setup();
    vi.mocked(api.savePet).mockRejectedValue(new api.ApiError(400, "Something is wrong with this pet."));

    render(<PetForm onSaved={vi.fn()} onCancel={vi.fn()} />);
    await user.type(screen.getByTestId("add-pet-form-name-input"), "Biscuit");
    await user.type(screen.getByTestId("add-pet-form-breed-input"), "Golden Retriever");
    await user.selectOptions(screen.getByTestId("add-pet-form-size-select"), "Medium");
    fireEvent.click(screen.getByTestId("add-pet-form-save-button"));

    expect(await screen.findByTestId("add-pet-form-error")).toHaveTextContent("Something is wrong with this pet.");
  });
});
