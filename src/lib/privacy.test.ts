import { describe, expect, it } from "vitest";

import { applyMemberPrivacy, type MemberRecord, type Viewer } from "./privacy";

const target: MemberRecord = {
  id: "m1",
  userId: "u-target",
  firstName: "Ada",
  lastName: "Obi",
  preferredName: null,
  avatarUrl: null,
  bio: "Hello",
  faculty: "Lagos Business School",
  programme: "MBA",
  graduationYear: 2015,
  company: "Acme",
  jobTitle: "PM",
  industry: "Tech",
  city: "Lagos",
  country: "Nigeria",
  linkedinUrl: null,
  websiteUrl: null,
  email: "ada@example.com",
  phone: "+2348000000000",
  status: "active",
  role: "member",
  profileVisibility: "members",
  emailVisibility: "members",
  phoneVisibility: "members",
  createdAt: new Date("2020-01-01T00:00:00Z"),
  deletedAt: null,
};

describe("applyMemberPrivacy", () => {
  it("self sees the full record incl. email and phone", () => {
    const viewer: Viewer = { userId: "u-target", role: "member" };
    const view = applyMemberPrivacy(target, viewer);
    expect(view).not.toBeNull();
    expect(view?.isSelf).toBe(true);
    expect(view?.email).toBe("ada@example.com");
    expect(view?.phone).toBe("+2348000000000");
  });

  it("exco sees everything, even a private and suspended target", () => {
    const viewer: Viewer = { userId: "u-exco", role: "exco" };
    const view = applyMemberPrivacy(
      { ...target, profileVisibility: "private", status: "suspended" },
      viewer,
    );
    expect(view).not.toBeNull();
    expect(view?.email).toBe("ada@example.com");
    expect(view?.isSelf).toBe(false);
  });

  it("a member viewing a private profile gets nothing", () => {
    const viewer: Viewer = { userId: "u-other", role: "member" };
    const view = applyMemberPrivacy(
      { ...target, profileVisibility: "private" },
      viewer,
    );
    expect(view).toBeNull();
  });

  it("a member viewing an excos-only (private) email field sees the profile but not the email", () => {
    const viewer: Viewer = { userId: "u-other", role: "member" };
    const view = applyMemberPrivacy(
      { ...target, profileVisibility: "members", emailVisibility: "private" },
      viewer,
    );
    expect(view).not.toBeNull();
    expect(view?.firstName).toBe("Ada");
    expect(view?.email).toBeNull();
    expect(view?.phone).toBe("+2348000000000");
  });

  it("a member viewing a suspended target gets nothing", () => {
    const viewer: Viewer = { userId: "u-other", role: "member" };
    const view = applyMemberPrivacy({ ...target, status: "suspended" }, viewer);
    expect(view).toBeNull();
  });

  // The contact-block privacy story from the task DONE: member A hides her
  // phone; another member cannot see it but an exco can.
  describe("hidden phone (phoneVisibility = private)", () => {
    const hiddenPhone: MemberRecord = { ...target, phoneVisibility: "private" };

    it("another member sees the profile but not the phone, and is told it is hidden", () => {
      const viewer: Viewer = { userId: "u-other", role: "member" };
      const view = applyMemberPrivacy(hiddenPhone, viewer);
      expect(view).not.toBeNull();
      expect(view?.phone).toBeNull();
      expect(view?.phoneHidden).toBe(true);
      // email is still members-visible, so it is shown and not flagged hidden
      expect(view?.email).toBe("ada@example.com");
      expect(view?.emailHidden).toBe(false);
    });

    it("an exco sees the phone", () => {
      const viewer: Viewer = { userId: "u-exco", role: "exco" };
      const view = applyMemberPrivacy(hiddenPhone, viewer);
      expect(view?.phone).toBe("+2348000000000");
      expect(view?.phoneHidden).toBe(false);
    });

    it("the owner still sees her own phone", () => {
      const viewer: Viewer = { userId: "u-target", role: "member" };
      const view = applyMemberPrivacy(hiddenPhone, viewer);
      expect(view?.phone).toBe("+2348000000000");
      expect(view?.phoneHidden).toBe(false);
    });
  });

  it("does not flag a missing phone as hidden (nothing to hide)", () => {
    const viewer: Viewer = { userId: "u-other", role: "member" };
    const view = applyMemberPrivacy(
      { ...target, phone: null, phoneVisibility: "private" },
      viewer,
    );
    expect(view?.phone).toBeNull();
    expect(view?.phoneHidden).toBe(false);
  });

  it("a soft-deleted member is invisible to members but visible to admins", () => {
    const deleted = { ...target, deletedAt: new Date("2026-06-01T00:00:00Z") };
    expect(
      applyMemberPrivacy(deleted, { userId: "u-other", role: "member" }),
    ).toBeNull();
    expect(
      applyMemberPrivacy(deleted, { userId: "u-exco", role: "exco" }),
    ).not.toBeNull();
  });
});
