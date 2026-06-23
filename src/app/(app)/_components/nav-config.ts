import {
  Award,
  CalendarDays,
  Cake,
  FileText,
  HeartHandshake,
  LayoutDashboard,
  Megaphone,
  ScrollText,
  Settings,
  Users,
  type LucideIcon,
} from "lucide-react";

export type NavItem = { href: string; label: string; icon: LucideIcon };

export const MAIN_NAV: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/directory", label: "Directory", icon: Users },
  { href: "/events", label: "Events", icon: CalendarDays },
  { href: "/birthdays", label: "Birthdays", icon: Cake },
  { href: "/fundraisers", label: "Fundraisers", icon: HeartHandshake },
  { href: "/announcements", label: "Announcements", icon: Megaphone },
  { href: "/exco", label: "Leadership", icon: Award },
];

export const ADMIN_NAV: NavItem[] = [
  { href: "/admin/members", label: "Members", icon: Users },
  { href: "/admin/events", label: "Events", icon: CalendarDays },
  { href: "/admin/fundraisers", label: "Fundraisers", icon: HeartHandshake },
  { href: "/admin/announcements", label: "Announcements", icon: Megaphone },
  { href: "/admin/birthdays", label: "Birthdays", icon: Cake },
  { href: "/admin/minutes", label: "Minutes", icon: FileText },
  { href: "/admin/exco", label: "Leadership", icon: Award },
];

export const SUPER_ADMIN_NAV: NavItem[] = [
  { href: "/admin/audit", label: "Audit", icon: ScrollText },
  { href: "/admin/settings", label: "Settings", icon: Settings },
];
