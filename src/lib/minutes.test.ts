import { describe, expect, it } from "vitest";

import {
  extractSpeakers,
  fallbackMinutes,
  parseMinutesJson,
} from "./minutes";

const TEAMS = `Chukwudi Ofoma 0:05
I'm a bit.
Odianjo, Onyebuchi RSDM 0:35
Thank you very much, let us begin the meeting now please everyone.
Eyo's Notetaker (Otter.ai) 9:36
What?
Stella Uwaechue 32:03
Hello, everyone. Good morning to the whole assembly and welcome.`;

describe("extractSpeakers", () => {
  it("pulls distinct human speakers and skips bots", () => {
    const s = extractSpeakers(TEAMS);
    expect(s).toContain("Chukwudi Ofoma");
    expect(s).toContain("Stella Uwaechue");
    expect(s.some((n) => /notetaker|otter/i.test(n))).toBe(false);
  });
});

describe("fallbackMinutes", () => {
  it("seeds attendees from the transcript and notes into a section", () => {
    const d = fallbackMinutes(TEAMS, "- dues update\n- bus project");
    expect(d.attendees.length).toBeGreaterThan(0);
    expect(d.sections[0].heading).toBe("Notes");
    expect(d.sections[0].points).toContain("dues update");
  });
});

describe("parseMinutesJson", () => {
  it("parses a fenced JSON reply and fills defaults", () => {
    const reply =
      '```json\n{"title":"PAUAA GA","attendees":["Ada"],"sections":[{"heading":"Dues","points":["pay up"]}]}\n```';
    const d = parseMinutesJson(reply);
    expect(d.title).toBe("PAUAA GA");
    expect(d.attendees).toEqual(["Ada"]);
    expect(d.sections[0].points).toEqual(["pay up"]);
    expect(d.actionItems).toEqual([]);
    expect(d.decisions).toEqual([]);
  });

  it("throws on a reply with no JSON", () => {
    expect(() => parseMinutesJson("sorry, I cannot help")).toThrow();
  });
});
