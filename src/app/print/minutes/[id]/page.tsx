import { notFound } from "next/navigation";
import { format } from "date-fns";

import { getMinutes, requireRole } from "@/lib/dal";

import { PrintButton } from "./print-button";

// Chrome-free printable view (no app navbar): open and use the browser's
// "Save as PDF". Guarded to exco+.
export default async function MinutesPrintPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRole("exco", "super_admin");
  const { id } = await params;
  const m = await getMinutes(id);
  if (!m) notFound();

  const meta: [string, string | null][] = [
    ["Date", m.meetingDate ? format(new Date(m.meetingDate), "d MMMM yyyy") : null],
    ["Location", m.location],
    ["Facilitator", m.facilitator],
    ["Minutes by", m.minutesBy],
  ];

  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-10 print:py-0">
      <div className="mb-6 flex items-center justify-between print:hidden">
        <span className="font-sans text-lg font-semibold italic tracking-tight">
          Set.
        </span>
        <PrintButton />
      </div>

      <article className="space-y-6 text-[13px] leading-relaxed">
        <header className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight">{m.title}</h1>
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-muted-foreground">
            {meta
              .filter(([, v]) => v)
              .map(([k, v]) => (
                <div key={k} className="contents">
                  <dt className="font-medium text-foreground">{k}</dt>
                  <dd>{v}</dd>
                </div>
              ))}
          </dl>
          {m.attendees.length ? (
            <p>
              <span className="font-medium">Attendees: </span>
              {m.attendees.join(", ")}
            </p>
          ) : null}
        </header>

        {m.sections.map((s, i) => (
          <section key={i} className="space-y-1.5">
            <h2 className="text-base font-semibold">{s.heading || "Section"}</h2>
            <ul className="list-disc space-y-1 pl-5">
              {s.points.map((p, pi) => (
                <li key={pi}>{p}</li>
              ))}
            </ul>
          </section>
        ))}

        {m.decisions.length ? (
          <section className="space-y-1.5">
            <h2 className="text-base font-semibold">Decisions</h2>
            <ul className="list-disc space-y-1 pl-5">
              {m.decisions.map((d, i) => (
                <li key={i}>{d}</li>
              ))}
            </ul>
          </section>
        ) : null}

        {m.actionItems.length ? (
          <section className="space-y-1.5">
            <h2 className="text-base font-semibold">Action items</h2>
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b">
                  <th className="py-1 pr-3 font-medium">Task</th>
                  <th className="py-1 pr-3 font-medium">Owner</th>
                  <th className="py-1 font-medium">Due</th>
                </tr>
              </thead>
              <tbody>
                {m.actionItems.map((a, i) => (
                  <tr key={i} className="border-b align-top">
                    <td className="py-1 pr-3">{a.task}</td>
                    <td className="py-1 pr-3">{a.owner || "—"}</td>
                    <td className="py-1">{a.due || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        ) : null}

        <footer className="pt-6 text-xs text-muted-foreground">
          Generated with Set, the PAU Alumni Association platform.
        </footer>
      </article>
    </main>
  );
}
