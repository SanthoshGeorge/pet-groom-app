// Guest booking lookup / cancel / reschedule (GC-3). NO MOCKUP SCREEN COVERS THIS PAGE —
// see ManageBookingFlow.tsx's header comment for how it was built (GC-3's acceptance
// criteria + the mocked-up screens' shared visual language). `?ref=` is an optional
// deep link from the confirmation screen's "Manage This Booking" button.
import { ManageBookingFlow } from "./ManageBookingFlow";

export const metadata = {
  title: "Manage a Booking — Happy Tails Grooming",
};

export default async function ManageBookingPage({
  searchParams,
}: {
  searchParams: Promise<{ ref?: string }>;
}) {
  const params = await searchParams;
  return <ManageBookingFlow initialReference={params.ref ?? ""} />;
}
