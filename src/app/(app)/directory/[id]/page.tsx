import Link from "next/link";
import { notFound } from "next/navigation";
import { format } from "date-fns";
import { CalendarDays, Globe, Mail, MapPin, Phone } from "lucide-react";

import {
  getMemberUpcomingEvents,
  getMemberWithPrivacy,
  getSetmates,
} from "@/lib/dal";
import { displayName, initials } from "@/lib/member-display";
import { LinkedinIcon } from "@/components/icons";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

function normalizeUrl(url: string) {
  return /^https?:\/\//i.test(url) ? url : `https://${url}`;
}

export default async function MemberProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const member = await getMemberWithPrivacy(id);
  if (!member) notFound();

  const name = displayName(member);
  const facultyLine = [
    member.faculty,
    member.graduationYear ? `Set of ${member.graduationYear}` : null,
  ]
    .filter(Boolean)
    .join(" / ");
  const programme = member.programme;

  const [setmates, upcoming] = await Promise.all([
    getSetmates(member.graduationYear, member.id),
    getMemberUpcomingEvents(member.id),
  ]);

  const stats = [
    { label: "Joined", value: format(member.createdAt, "MMM yyyy") },
    member.city ? { label: "City", value: member.city } : null,
    member.country ? { label: "Country", value: member.country } : null,
  ].filter(Boolean) as { label: string; value: string }[];

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 lg:px-8">
      <Link
        href="/directory"
        className="text-sm text-muted-foreground hover:text-foreground"
      >
        ← Directory
      </Link>

      <div className="mt-4 grid gap-8 lg:grid-cols-[1fr_280px]">
        <div className="min-w-0">
          {/* Header */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <Avatar className="size-24">
              {member.avatarUrl ? (
                <AvatarImage src={member.avatarUrl} alt="" />
              ) : null}
              <AvatarFallback className="text-xl">
                {initials(name)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-semibold">{name}</h1>
                {member.role !== "member" ? (
                  <Badge variant="secondary" className="capitalize">
                    {member.role === "super_admin" ? "Admin" : "Exco"}
                  </Badge>
                ) : null}
              </div>
              {facultyLine ? (
                <p className="font-mono text-[13px] text-muted-foreground">
                  {facultyLine}
                </p>
              ) : null}
              {programme ? (
                <p className="text-sm text-muted-foreground">{programme}</p>
              ) : null}
              {member.jobTitle || member.company ? (
                <p className="mt-1 text-sm">
                  {[member.jobTitle, member.company].filter(Boolean).join(" · ")}
                </p>
              ) : null}
            </div>
          </div>

          {/* Stats */}
          <div className="mt-6 flex flex-wrap gap-x-8 gap-y-2 text-sm">
            {stats.map((s) => (
              <div key={s.label}>
                <span className="text-muted-foreground">{s.label}</span>{" "}
                <span className="font-medium">{s.value}</span>
              </div>
            ))}
          </div>

          {member.bio ? (
            <>
              <Separator className="my-6" />
              <p className="whitespace-pre-line text-sm leading-relaxed">
                {member.bio}
              </p>
            </>
          ) : null}

          {/* Contact */}
          <Separator className="my-6" />
          <h2 className="mb-3 text-lg font-semibold">Contact</h2>
          <ContactBlock member={member} name={name} />
        </div>

        {/* Sidebar */}
        <aside className="space-y-8">
          {setmates.length > 0 ? (
            <section>
              <h2 className="mb-3 text-sm font-semibold">
                Set of {member.graduationYear}
              </h2>
              <ul className="space-y-2">
                {setmates.map((s) => {
                  const sName = displayName(s);
                  return (
                    <li key={s.id}>
                      <Link
                        href={`/directory/${s.id}`}
                        className="flex items-center gap-2 rounded-md p-1 text-sm hover:bg-muted"
                      >
                        <Avatar className="size-7">
                          {s.avatarUrl ? (
                            <AvatarImage src={s.avatarUrl} alt="" />
                          ) : null}
                          <AvatarFallback className="text-[11px]">
                            {initials(sName)}
                          </AvatarFallback>
                        </Avatar>
                        <span className="truncate">{sName}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </section>
          ) : null}

          {upcoming.length > 0 ? (
            <section>
              <h2 className="mb-3 text-sm font-semibold">Going to</h2>
              <ul className="space-y-3">
                {upcoming.map((e) => (
                  <li key={e.id} className="flex items-start gap-2 text-sm">
                    <CalendarDays className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                    <div className="min-w-0">
                      <Link
                        href={`/events/${e.slug}`}
                        className="block truncate font-medium hover:underline"
                      >
                        {e.title}
                      </Link>
                      <p className="font-mono text-xs text-muted-foreground">
                        {format(e.startsAt, "d MMM yyyy")}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </aside>
      </div>
    </div>
  );
}

function ContactBlock({
  member,
  name,
}: {
  member: Awaited<ReturnType<typeof getMemberWithPrivacy>>;
  name: string;
}) {
  if (!member) return null;
  const rows: React.ReactNode[] = [];

  if (member.email) {
    rows.push(
      <div key="email" className="flex items-center justify-between gap-3">
        <span className="flex min-w-0 items-center gap-2 text-sm">
          <Mail className="size-4 shrink-0 text-muted-foreground" />
          <span className="truncate">{member.email}</span>
        </span>
        <Button asChild size="sm" variant="secondary">
          <a href={`mailto:${member.email}`}>Email</a>
        </Button>
      </div>,
    );
  } else if (member.emailHidden) {
    rows.push(<HiddenRow key="email" icon={<Mail className="size-4" />} label="Email" />);
  }

  if (member.phone) {
    rows.push(
      <div key="phone" className="flex items-center gap-2 text-sm">
        <Phone className="size-4 shrink-0 text-muted-foreground" />
        <span>{member.phone}</span>
      </div>,
    );
  } else if (member.phoneHidden) {
    rows.push(<HiddenRow key="phone" icon={<Phone className="size-4" />} label="Phone" />);
  }

  if (member.linkedinUrl) {
    rows.push(
      <a
        key="linkedin"
        href={normalizeUrl(member.linkedinUrl)}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-2 text-sm hover:underline"
      >
        <LinkedinIcon className="size-4 shrink-0 text-muted-foreground" />
        <span className="truncate">LinkedIn</span>
      </a>,
    );
  }

  if (member.websiteUrl) {
    rows.push(
      <a
        key="website"
        href={normalizeUrl(member.websiteUrl)}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-2 text-sm hover:underline"
      >
        <Globe className="size-4 shrink-0 text-muted-foreground" />
        <span className="truncate">{member.websiteUrl}</span>
      </a>,
    );
  }

  if (rows.length === 0) {
    return (
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <MapPin className="size-4" />
        {name} has not shared any contact details.
      </p>
    );
  }

  return <div className="space-y-3">{rows}</div>;
}

function HiddenRow({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <p className="flex items-center gap-2 text-sm text-muted-foreground">
      <span className="shrink-0 text-muted-foreground">{icon}</span>
      {label} hidden by privacy settings
    </p>
  );
}
