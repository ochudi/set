import { describe, expect, it } from "vitest";

import { formatAuditAction } from "./audit-format";

describe("formatAuditAction", () => {
  it("renders the role change example from the brief", () => {
    expect(
      formatAuditAction("member.role_change", { from: "member", to: "exco" }, "Ada"),
    ).toBe("Changed role for Ada from member to exco");
  });

  it("falls back gracefully when the target is unknown", () => {
    expect(formatAuditAction("member.suspend", null, null)).toBe("Suspended");
    expect(formatAuditAction("member.suspend", null, "Ada")).toBe("Suspended Ada");
  });

  it("uses possessive for deletes", () => {
    expect(formatAuditAction("member.delete", null, "Ada")).toBe(
      "Deleted Ada's account",
    );
  });

  it("lists changed fields on a member update", () => {
    expect(
      formatAuditAction("member.update", { fields: ["city", "company"] }, "Ada"),
    ).toBe("Updated Ada's profile (city, company)");
  });

  it("renders invite creation with email and role", () => {
    expect(
      formatAuditAction("invite.create", { email: "x@y.com", role: "member" }, null),
    ).toBe("Invited x@y.com as member");
  });

  it("renders announcement email with recipient count", () => {
    expect(
      formatAuditAction("announcement.email", { recipients: 42 }, "Dues are open"),
    ).toBe("Emailed announcement Dues are open to 42 members");
  });

  it("renders super admin transfer", () => {
    expect(formatAuditAction("superadmin.transfer", null, "Bola")).toBe(
      "Transferred super admin to Bola",
    );
  });

  it("humanizes unknown actions", () => {
    expect(formatAuditAction("widget.frobnicate", null, null)).toBe(
      "Widget frobnicate",
    );
    expect(formatAuditAction("widget.frobnicate", null, "Thing")).toBe(
      "Widget frobnicate Thing",
    );
  });
});
