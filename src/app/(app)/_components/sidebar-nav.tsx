"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";
import type { Role } from "@/lib/privacy";
import { ADMIN_NAV, MAIN_NAV, SUPER_ADMIN_NAV, type NavItem } from "./nav-config";

function NavLink({
  item,
  onNavigate,
}: {
  item: NavItem;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const active =
    pathname === item.href || pathname.startsWith(`${item.href}/`);
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex items-center gap-3 rounded-md border-l-2 border-transparent px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
        active &&
          "border-l-[var(--brand)] bg-primary/10 font-medium text-foreground",
      )}
    >
      <Icon className="size-4 shrink-0" />
      {item.label}
    </Link>
  );
}

export function SidebarNav({
  role,
  onNavigate,
}: {
  role: Role;
  onNavigate?: () => void;
}) {
  const isAdmin = role === "exco" || role === "super_admin";
  const isSuper = role === "super_admin";

  return (
    <div className="space-y-6">
      <div className="space-y-0.5">
        {MAIN_NAV.map((item) => (
          <NavLink key={item.href} item={item} onNavigate={onNavigate} />
        ))}
      </div>

      {isAdmin ? (
        <div className="space-y-0.5">
          <p className="px-3 pb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Admin
          </p>
          {ADMIN_NAV.map((item) => (
            <NavLink key={item.href} item={item} onNavigate={onNavigate} />
          ))}
          {isSuper
            ? SUPER_ADMIN_NAV.map((item) => (
                <NavLink key={item.href} item={item} onNavigate={onNavigate} />
              ))
            : null}
        </div>
      ) : null}
    </div>
  );
}
