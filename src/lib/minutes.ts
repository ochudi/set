/**
 * Pure helpers for the secretary's minutes tool. No db / no network here so the
 * structuring logic is unit-testable. The DAL calls the LLM (when a key is set)
 * and falls back to `fallbackMinutes` otherwise.
 */
import { z } from "zod";

export type MinutesDraft = {
  title: string;
  meetingDate: string; // "YYYY-MM-DD" or ""
  location: string;
  facilitator: string;
  minutesBy: string;
  attendees: string[];
  sections: { heading: string; points: string[] }[];
  actionItems: { task: string; owner: string; due: string }[];
  decisions: string[];
};

export const EMPTY_DRAFT: MinutesDraft = {
  title: "",
  meetingDate: "",
  location: "",
  facilitator: "",
  minutesBy: "",
  attendees: [],
  sections: [],
  actionItems: [],
  decisions: [],
};

const draftSchema = z.object({
  title: z.string().default(""),
  meetingDate: z.string().default(""),
  location: z.string().default(""),
  facilitator: z.string().default(""),
  minutesBy: z.string().default(""),
  attendees: z.array(z.string()).default([]),
  sections: z
    .array(
      z.object({
        heading: z.string().default(""),
        points: z.array(z.string()).default([]),
      }),
    )
    .default([]),
  actionItems: z
    .array(
      z.object({
        task: z.string().default(""),
        owner: z.string().default(""),
        due: z.string().default(""),
      }),
    )
    .default([]),
  decisions: z.array(z.string()).default([]),
});

/** Parse the model's reply (which may be fenced) into a validated MinutesDraft. */
export function parseMinutesJson(raw: string): MinutesDraft {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const body = (fenced ? fenced[1] : raw).trim();
  const start = body.indexOf("{");
  const end = body.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("No JSON object in model reply");
  const parsed = JSON.parse(body.slice(start, end + 1));
  return draftSchema.parse(parsed);
}

/** Speaker labels from a Teams-style transcript ("Name  0:05") or "Name:" lines. */
export function extractSpeakers(transcript: string): string[] {
  const names = new Set<string>();
  for (const line of transcript.split(/\r?\n/)) {
    const teams = line.match(/^\s*([A-Za-z][\w.'’()\-, ]{1,58}?)\s+\d{1,2}:\d{2}\s*$/);
    const colon = line.match(/^\s*([A-Z][\w.'’()\-, ]{1,58}?):\s/);
    const name = teams?.[1] ?? colon?.[1];
    if (!name) continue;
    const clean = name.trim();
    // Skip obvious non-people / bot labels.
    if (/notetaker|otter|transcription|recording/i.test(clean)) continue;
    if (clean.length >= 2) names.add(clean);
  }
  return [...names];
}

/**
 * Deterministic structuring used when no LLM key is configured. It is a useful
 * starting point the secretary edits: real attendees are pulled from the
 * transcript, notes seed the first section, and a couple of long lines are
 * surfaced as discussion points.
 */
export function fallbackMinutes(transcript: string, notes: string): MinutesDraft {
  const attendees = extractSpeakers(transcript);
  const lines = transcript
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 60 && !/^\s*[A-Za-z].{0,58}\s+\d{1,2}:\d{2}\s*$/.test(l));
  const points = lines.slice(0, 8);

  const sections: MinutesDraft["sections"] = [];
  if (notes.trim()) {
    sections.push({
      heading: "Notes",
      points: notes
        .split(/\r?\n/)
        .map((l) => l.replace(/^[-*•]\s*/, "").trim())
        .filter(Boolean),
    });
  }
  sections.push({ heading: "Discussion", points });

  return {
    ...EMPTY_DRAFT,
    title: "Meeting minutes",
    attendees,
    sections,
  };
}

const SYSTEM_PROMPT = `You are an expert meeting secretary for the Pan-Atlantic University Alumni Association (PAUAA). You turn raw meeting transcripts and rough notes into clean, accurate minutes.

Return ONLY a JSON object (no prose, no markdown fence) with exactly these keys:
{
  "title": string,                // e.g. "PAUAA General Assembly Meeting"
  "meetingDate": string,          // "YYYY-MM-DD" if derivable, else ""
  "location": string,             // physical or "Virtual (Microsoft Teams)" etc, else ""
  "facilitator": string,          // who chaired, else ""
  "minutesBy": string,            // who took minutes, else ""
  "attendees": string[],          // distinct real people present (no bots/notetakers)
  "sections": [{ "heading": string, "points": string[] }],  // grouped discussion, sentence case
  "actionItems": [{ "task": string, "owner": string, "due": string }], // due "" if unknown
  "decisions": string[]           // clear decisions/resolutions reached
}

Rules: plain language, sentence case, no em dashes. Be faithful to the transcript; do not invent facts, names, figures, or dates. Prefer a handful of clear bullet points per section over long paragraphs. If something is unclear, leave it out rather than guessing.`;

export function buildMinutesMessages(
  transcript: string,
  notes: string,
): { system: string; user: string } {
  const user = `Rough notes from the secretary (may be empty):\n${notes || "(none)"}\n\n---\nTranscript:\n${transcript}`;
  return { system: SYSTEM_PROMPT, user };
}
