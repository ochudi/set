import { requireRole } from "@/lib/dal";

// Layout guard (rule 1): members are redirected to /dashboard here, NOT in
// middleware (which is optimistic only — see CVE-2025-29927).
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireRole("exco", "super_admin");
  return <>{children}</>;
}
