import { ResetPasswordForm } from "./ResetPasswordForm";

export const metadata = {
  title: "Reset Password — Happy Tails Grooming",
};

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const params = await searchParams;
  return <ResetPasswordForm token={params.token ?? ""} />;
}
