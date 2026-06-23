import { describe, expect, it } from "vitest";

import { describeDevice } from "./user-agent";

describe("describeDevice", () => {
  it("returns a fallback for empty input", () => {
    expect(describeDevice(null)).toBe("Unknown device");
    expect(describeDevice("")).toBe("Unknown device");
    expect(describeDevice("   ")).toBe("Unknown device");
  });

  it("identifies Chrome on macOS", () => {
    const ua =
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";
    expect(describeDevice(ua)).toBe("Chrome on macOS");
  });

  it("distinguishes Edge from Chrome (Edge UA also contains Chrome)", () => {
    const ua =
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36 Edg/124.0";
    expect(describeDevice(ua)).toBe("Edge on Windows");
  });

  it("identifies Safari on iOS (not Chrome)", () => {
    const ua =
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";
    expect(describeDevice(ua)).toBe("Safari on iOS");
  });

  it("identifies Firefox on Android", () => {
    const ua = "Mozilla/5.0 (Android 14; Mobile; rv:125.0) Gecko/125.0 Firefox/125.0";
    expect(describeDevice(ua)).toBe("Firefox on Android");
  });
});
