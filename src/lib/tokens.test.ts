import { beforeAll, describe, expect, it } from "vitest";

import { readUnsubscribeToken, signPayload, unsubscribeToken } from "./tokens";

beforeAll(() => {
  process.env.AUTH_SECRET = "test-secret-0123456789-abcdef";
});

describe("unsubscribe tokens", () => {
  it("round-trips the email (lowercased) and defaults to category all", () => {
    const t = unsubscribeToken("Ada@Example.com");
    expect(readUnsubscribeToken(t)).toEqual({
      email: "ada@example.com",
      category: "all",
    });
  });

  it("carries the category so the link flips only that flag", () => {
    const t = unsubscribeToken("ada@example.com", "announcements");
    expect(readUnsubscribeToken(t)).toEqual({
      email: "ada@example.com",
      category: "announcements",
    });
  });

  it("treats an unknown category as all", () => {
    const t = signPayload({ e: "ada@example.com", p: "unsub", c: "bogus" });
    expect(readUnsubscribeToken(t)).toEqual({
      email: "ada@example.com",
      category: "all",
    });
  });

  it("rejects a tampered signature", () => {
    const t = unsubscribeToken("ada@example.com");
    const [body] = t.split(".");
    expect(readUnsubscribeToken(`${body}.deadbeef`)).toBeNull();
    expect(readUnsubscribeToken(`${t}x`)).toBeNull();
  });

  it("rejects a well-signed token of the wrong purpose", () => {
    const t = signPayload({ e: "ada@example.com", p: "something-else" });
    expect(readUnsubscribeToken(t)).toBeNull();
  });

  it("rejects malformed input", () => {
    expect(readUnsubscribeToken("")).toBeNull();
    expect(readUnsubscribeToken("nodot")).toBeNull();
  });
});
