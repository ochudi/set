import { NextResponse } from "next/server";
import {
  AlignmentType,
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  TextRun,
} from "docx";

import { getMinutes, getSessionUser } from "@/lib/dal";

// Word export of saved minutes. GET is fine: it only reads (rule 5). Node runtime
// because the docx packer needs Buffer.
export const runtime = "nodejs";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getSessionUser();
  if (!user || (user.role !== "exco" && user.role !== "super_admin")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { id } = await params;
  const m = await getMinutes(id);
  if (!m) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const meta = (label: string, value: string | null) =>
    value
      ? new Paragraph({
          children: [
            new TextRun({ text: `${label}: `, bold: true }),
            new TextRun(value),
          ],
          spacing: { after: 60 },
        })
      : null;

  const body: Paragraph[] = [
    new Paragraph({ text: m.title, heading: HeadingLevel.TITLE }),
    meta("Date", m.meetingDate),
    meta("Location", m.location),
    meta("Facilitator", m.facilitator),
    meta("Minutes by", m.minutesBy),
    m.attendees.length
      ? new Paragraph({
          children: [
            new TextRun({ text: "Attendees: ", bold: true }),
            new TextRun(m.attendees.join(", ")),
          ],
          spacing: { after: 200 },
        })
      : null,
  ].filter((p): p is Paragraph => p !== null);

  for (const s of m.sections) {
    body.push(
      new Paragraph({ text: s.heading || "Section", heading: HeadingLevel.HEADING_2 }),
    );
    for (const p of s.points) {
      body.push(new Paragraph({ text: p, bullet: { level: 0 } }));
    }
  }

  if (m.decisions.length) {
    body.push(new Paragraph({ text: "Decisions", heading: HeadingLevel.HEADING_2 }));
    for (const d of m.decisions) {
      body.push(new Paragraph({ text: d, bullet: { level: 0 } }));
    }
  }

  if (m.actionItems.length) {
    body.push(
      new Paragraph({ text: "Action items", heading: HeadingLevel.HEADING_2 }),
    );
    for (const a of m.actionItems) {
      const bits = [a.task, a.owner ? `owner: ${a.owner}` : "", a.due ? `due: ${a.due}` : ""]
        .filter(Boolean)
        .join(" — ");
      body.push(new Paragraph({ text: bits, bullet: { level: 0 } }));
    }
  }

  body.push(
    new Paragraph({
      alignment: AlignmentType.RIGHT,
      spacing: { before: 300 },
      children: [
        new TextRun({
          text: "Generated with Set, the PAU Alumni Association platform.",
          italics: true,
          color: "737373",
          size: 16,
        }),
      ],
    }),
  );

  const doc = new Document({ sections: [{ children: body }] });
  const buffer = await Packer.toBuffer(doc);
  const slug = m.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "minutes";

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="${slug}.docx"`,
      "Cache-Control": "no-store",
    },
  });
}
