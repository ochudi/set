import { format } from "date-fns";

import { PageWrapper } from "@/components/page-wrapper";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  listAdminUpcomingBirthdays,
  listBirthdaySendLog,
  requireRole,
} from "@/lib/dal";

import { BirthdaySendButton } from "./birthday-controls";

const MONTHS_ABBR = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

function whenLabel(daysUntil: number): string {
  if (daysUntil === 0) return "today";
  if (daysUntil === 1) return "tomorrow";
  return `in ${daysUntil} days`;
}

export default async function AdminBirthdaysPage() {
  const session = await requireRole("exco", "super_admin");
  const isSuperAdmin = session.user.role === "super_admin";

  const [upcoming, log] = await Promise.all([
    listAdminUpcomingBirthdays(30),
    listBirthdaySendLog(100),
  ]);

  return (
    <PageWrapper
      title="Birthdays"
      description="Wishes send automatically each morning. Send or re-send by hand here."
    >
      <h2 className="mb-3 text-lg font-semibold">Upcoming (next 30 days)</h2>
      {upcoming.length === 0 ? (
        <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
          No birthdays in the next 30 days.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>When</TableHead>
                <TableHead>This year</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {upcoming.map((b) => (
                <TableRow key={b.memberId}>
                  <TableCell className="font-medium">{b.name}</TableCell>
                  <TableCell className="text-[13px] text-muted-foreground">
                    {b.email}
                  </TableCell>
                  <TableCell className="text-[13px] tabular-nums">
                    {b.day} {MONTHS_ABBR[b.month - 1]}
                  </TableCell>
                  <TableCell className="text-[13px]">
                    {b.isToday ? (
                      <span className="font-medium text-brand">today</span>
                    ) : (
                      whenLabel(b.daysUntil)
                    )}
                  </TableCell>
                  <TableCell>
                    {b.sentThisYear ? (
                      <Badge variant="secondary">Sent</Badge>
                    ) : (
                      <span className="text-[13px] text-muted-foreground">
                        Not sent
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <BirthdaySendButton
                      memberId={b.memberId}
                      name={b.name}
                      sentThisYear={b.sentThisYear}
                      isSuperAdmin={isSuperAdmin}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <h2 className="mb-3 mt-8 text-lg font-semibold">Sent log</h2>
      {log.length === 0 ? (
        <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
          Nothing sent yet.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Year</TableHead>
                <TableHead>Sent</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {log.map((r, i) => (
                <TableRow key={`${r.memberId}-${r.year}-${i}`}>
                  <TableCell className="font-medium">{r.name}</TableCell>
                  <TableCell className="text-[13px] text-muted-foreground">
                    {r.email}
                  </TableCell>
                  <TableCell className="text-[13px] tabular-nums">
                    {r.year}
                  </TableCell>
                  <TableCell className="text-[13px] text-muted-foreground">
                    {format(r.sentAt, "d MMM yyyy, HH:mm")}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </PageWrapper>
  );
}
