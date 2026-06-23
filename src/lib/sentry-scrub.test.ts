import { describe, expect, it } from "vitest";

import { scrubEvent, scrubString } from "./sentry-scrub";

describe("scrubString", () => {
  it("redacts emails", () => {
    expect(scrubString("contact ada@example.com now")).toBe(
      "contact [redacted-email] now",
    );
  });
  it("redacts phone numbers", () => {
    expect(scrubString("call +234 803 123 4567")).toBe("call [redacted-phone]");
    expect(scrubString("ring 08031234567")).toBe("ring [redacted-phone]");
  });
  it("leaves short numbers alone", () => {
    expect(scrubString("page 12 of 34")).toBe("page 12 of 34");
  });
});

describe("scrubEvent", () => {
  it("drops anything under a metadata key, at any depth", () => {
    const e = {
      message: "x",
      contexts: { audit: { metadata: { phone: "08031234567", from: "member" } } },
      extra: { metadata: { secret: "y" } },
    };
    const out = scrubEvent(e) as Record<string, unknown>;
    const contexts = out.contexts as Record<string, Record<string, unknown>>;
    expect(contexts.audit.metadata).toBeUndefined();
    expect((out.extra as Record<string, unknown>).metadata).toBeUndefined();
  });

  it("redacts emails/phones in nested strings", () => {
    const e = {
      message: "user ada@example.com phoned 08031234567",
      breadcrumbs: [{ message: "to bola@x.org" }],
    };
    const out = scrubEvent(e) as Record<string, unknown>;
    expect(out.message).toBe("user [redacted-email] phoned [redacted-phone]");
    const bc = out.breadcrumbs as { message: string }[];
    expect(bc[0].message).toBe("to [redacted-email]");
  });

  it("clears Sentry user PII fields", () => {
    const e = { user: { id: "u1", email: "ada@example.com", username: "ada", ip_address: "1.2.3.4" } };
    const out = scrubEvent(e) as { user: Record<string, unknown> };
    expect(out.user.id).toBe("u1");
    expect(out.user.email).toBeUndefined();
    expect(out.user.username).toBeUndefined();
    expect(out.user.ip_address).toBeUndefined();
  });

  it("does not loop on cyclic objects", () => {
    const e: Record<string, unknown> = { message: "hi" };
    e.self = e;
    expect(() => scrubEvent(e)).not.toThrow();
  });
});
