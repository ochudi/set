import { describe, expect, it } from "vitest";

import { guardRoleChange, guardStatusChange } from "./admin-guards";

describe("guardRoleChange", () => {
  it("blocks demoting your own account", () => {
    const res = guardRoleChange({
      actorUserId: "u1",
      targetUserId: "u1",
      targetCurrentRole: "super_admin",
      newRole: "member",
      activeSuperAdminCount: 3,
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toMatch(/demote your own/i);
  });

  it("allows promoting yourself (not a demotion)", () => {
    expect(
      guardRoleChange({
        actorUserId: "u1",
        targetUserId: "u1",
        targetCurrentRole: "exco",
        newRole: "super_admin",
        activeSuperAdminCount: 2,
      }).ok,
    ).toBe(true);
  });

  it("blocks removing the last super admin", () => {
    const res = guardRoleChange({
      actorUserId: "u1",
      targetUserId: "u2",
      targetCurrentRole: "super_admin",
      newRole: "exco",
      activeSuperAdminCount: 1,
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toMatch(/last super admin/i);
  });

  it("allows demoting a super admin when others remain", () => {
    expect(
      guardRoleChange({
        actorUserId: "u1",
        targetUserId: "u2",
        targetCurrentRole: "super_admin",
        newRole: "exco",
        activeSuperAdminCount: 2,
      }).ok,
    ).toBe(true);
  });

  it("allows a normal promotion of another member", () => {
    expect(
      guardRoleChange({
        actorUserId: "u1",
        targetUserId: "u2",
        targetCurrentRole: "member",
        newRole: "exco",
        activeSuperAdminCount: 2,
      }).ok,
    ).toBe(true);
  });
});

describe("guardStatusChange", () => {
  it("blocks suspending the last super admin", () => {
    const res = guardStatusChange({
      targetRole: "super_admin",
      action: "suspend",
      activeSuperAdminCount: 1,
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toMatch(/last super admin/i);
  });

  it("blocks deleting the last super admin", () => {
    expect(
      guardStatusChange({
        targetRole: "super_admin",
        action: "delete",
        activeSuperAdminCount: 1,
      }).ok,
    ).toBe(false);
  });

  it("allows suspending a super admin when others remain", () => {
    expect(
      guardStatusChange({
        targetRole: "super_admin",
        action: "suspend",
        activeSuperAdminCount: 2,
      }).ok,
    ).toBe(true);
  });

  it("allows suspending a regular member", () => {
    expect(
      guardStatusChange({
        targetRole: "member",
        action: "suspend",
        activeSuperAdminCount: 1,
      }).ok,
    ).toBe(true);
  });

  it("always allows reactivation", () => {
    expect(
      guardStatusChange({
        targetRole: "super_admin",
        action: "reactivate",
        activeSuperAdminCount: 1,
      }).ok,
    ).toBe(true);
  });
});
