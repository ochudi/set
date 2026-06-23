import { describe, expect, it } from "vitest";

import { buildEventIcs } from "./ics";

const base = {
  id: "11111111-1111-1111-1111-111111111111",
  title: "Class Reunion",
  description: "Come and reconnect.",
  location: "Lagos Business School",
  isVirtual: false,
  meetingUrl: null,
  startsAt: new Date("2026-07-12T17:00:00Z"),
  endsAt: new Date("2026-07-12T19:00:00Z"),
  sequence: 3,
};

describe("buildEventIcs", () => {
  it("publishes with a stable UID and the row's sequence", () => {
    const ics = buildEventIcs(base);
    expect(ics).toContain("BEGIN:VCALENDAR");
    expect(ics).toContain("METHOD:PUBLISH");
    expect(ics).toContain(`UID:${base.id}`);
    expect(ics).toContain("SEQUENCE:3");
    expect(ics).toContain("SUMMARY:Class Reunion");
    expect(ics).toContain("STATUS:CONFIRMED");
  });

  it("builds a cancellation variant", () => {
    const ics = buildEventIcs({ ...base, sequence: 4 }, { canceled: true });
    expect(ics).toContain("METHOD:CANCEL");
    expect(ics).toContain("STATUS:CANCELLED");
    expect(ics).toContain("SEQUENCE:4");
    // Same UID so the calendar updates the existing entry rather than adding one
    expect(ics).toContain(`UID:${base.id}`);
  });

  it("uses the meeting link as the location for virtual events", () => {
    const ics = buildEventIcs({
      ...base,
      isVirtual: true,
      location: null,
      meetingUrl: "https://meet.example.com/abc",
    });
    expect(ics).toContain("meet.example.com");
  });
});
