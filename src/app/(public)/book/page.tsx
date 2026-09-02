// Booking flow entry point — GC-1 (browse availability) / GC-2 (book as guest). A thin
// server component (reads the optional `?serviceId=` deep link from `/services`) handing
// off to the client-side `BookingWizard`, which owns the actual multi-step flow.
import { BookingWizard } from "./BookingWizard";

export const metadata = {
  title: "Book an Appointment — Happy Tails Grooming",
};

export default async function BookPage({
  searchParams,
}: {
  searchParams: Promise<{ serviceId?: string }>;
}) {
  const params = await searchParams;
  return <BookingWizard initialServiceId={params.serviceId ?? null} />;
}
