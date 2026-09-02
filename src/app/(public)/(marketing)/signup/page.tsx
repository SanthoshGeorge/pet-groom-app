import { SignupForm, type SignupPrefill } from "./SignupForm";

export const metadata = {
  title: "Sign Up — Happy Tails Grooming",
};

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ name?: string; phone?: string; email?: string }>;
}) {
  const params = await searchParams;
  const prefill: SignupPrefill | undefined =
    params.name || params.phone || params.email
      ? { name: params.name, phone: params.phone, email: params.email }
      : undefined;
  return <SignupForm prefill={prefill} />;
}
