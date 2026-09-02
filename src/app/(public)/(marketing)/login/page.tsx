// `redirectTo` is an optional deep link (e.g. `/login?redirectTo=/account/pets`, used by
// the shared header and by `/account/pets`'s own 401 redirect) — read server-side and
// passed down as `LoginForm`'s documented `redirectTo` prop, same pattern
// `/manage-booking`'s page.tsx already uses for its own `?ref=` param.
import { LoginForm } from "./LoginForm";

export const metadata = {
  title: "Log In — Happy Tails Grooming",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ redirectTo?: string }>;
}) {
  const params = await searchParams;
  return <LoginForm redirectTo={params.redirectTo} />;
}
