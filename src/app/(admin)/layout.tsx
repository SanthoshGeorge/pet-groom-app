// Admin/owner site route group (calendar, on-behalf booking, catalog/hours/reports).
// Pages built out in Code Generation Phase H (Step 22), gated by auth.validateSession(role=owner).
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
