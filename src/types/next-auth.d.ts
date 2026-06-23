import type { DefaultSession } from "next-auth";

type Role = "member" | "exco" | "super_admin";
type Status = "active" | "invited" | "suspended" | "deactivated";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: Role;
      status: Status;
    } & DefaultSession["user"];
  }

  interface User {
    role: Role;
    status: Status;
  }
}

declare module "next-auth/adapters" {
  interface AdapterUser {
    role: Role;
    status: Status;
  }
}
