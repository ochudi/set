import { beforeAll, describe, expect, it } from "vitest";

import { buildUnsubscribeHeaders } from "./email";
import { readUnsubscribeToken } from "./tokens";

beforeAll(() => {
  process.env.AUTH_SECRET = "test-secret-0123456789-abcdef";
});

describe("buildUnsubscribeHeaders (RFC 8058)", () => {
  it("emits both List-Unsubscribe headers", () => {
    const h = buildUnsubscribeHeaders("ada@example.com", "announcements");
    expect(h["List-Unsubscribe-Post"]).toBe("List-Unsubscribe=One-Click");
    expect(h["List-Unsubscribe"]).toContain("<mailto:");
    expect(h["List-Unsubscribe"]).toContain("/unsubscribe/");
  });

  it("scopes the https unsubscribe link to the category", () => {
    const h = buildUnsubscribeHeaders("ada@example.com", "announcements");
    const match = h["List-Unsubscribe"].match(/\/unsubscribe\/([^>]+)>/);
    expect(match).not.toBeNull();
    expect(readUnsubscribeToken(match![1])).toEqual({
      email: "ada@example.com",
      category: "announcements",
    });
  });
});
