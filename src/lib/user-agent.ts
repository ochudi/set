/**
 * Tiny user-agent describer for the /me "your devices" view. Pure (no deps, no
 * db) so it is trivially unit-testable. This is informational only — never used
 * for any auth or security decision.
 *
 * Order matters: Edge and Opera UA strings also contain "Chrome", and Chrome's
 * contains "Safari", so the more specific brands are tested first.
 */
export function describeDevice(ua: string | null | undefined): string {
  if (!ua || !ua.trim()) return "Unknown device";

  const browser = /edg(a|ios|)\//i.test(ua)
    ? "Edge"
    : /opr\/|opera/i.test(ua)
      ? "Opera"
      : /chrome|crios|chromium/i.test(ua)
        ? "Chrome"
        : /firefox|fxios/i.test(ua)
          ? "Firefox"
          : /safari/i.test(ua)
            ? "Safari"
            : null;

  const os = /windows/i.test(ua)
    ? "Windows"
    : /iphone|ipad|ipod/i.test(ua)
      ? "iOS"
      : /mac os x|macintosh/i.test(ua)
        ? "macOS"
        : /android/i.test(ua)
          ? "Android"
          : /linux/i.test(ua)
            ? "Linux"
            : null;

  if (browser && os) return `${browser} on ${os}`;
  return browser ?? os ?? "Unknown device";
}
