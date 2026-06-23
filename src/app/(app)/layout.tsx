import { redirect } from "next/navigation";

import { getCurrentMember, requireSession } from "@/lib/dal";

import { AppNavbar } from "./_components/navbar";
import { SidebarNav } from "./_components/sidebar-nav";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireSession();
  const member = await getCurrentMember();
  // Onboarding gate for the whole authed app (rule 1 — done in the DAL/layout).
  if (!member?.onboardedAt) redirect("/welcome");

  const role = session.user.role;
  const name =
    member.preferredName ||
    member.firstName ||
    session.user.email ||
    "Member";

  return (
    <div className="min-h-screen">
      <AppNavbar
        role={role}
        name={name}
        email={session.user.email ?? null}
        avatarUrl={member.avatarUrl ?? null}
      />
      <div className="mx-auto flex w-full max-w-[1400px]">
        <aside className="sticky top-14 hidden h-[calc(100vh-3.5rem)] w-60 shrink-0 overflow-y-auto border-r p-3 lg:block">
          <SidebarNav role={role} />
        </aside>
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </div>
  );
}
