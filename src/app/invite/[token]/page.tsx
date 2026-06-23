import type { Metadata } from "next";
import Link from "next/link";

import { getInviteByToken } from "@/lib/dal";

import { AcceptForm } from "./accept-form";

export const metadata: Metadata = { title: "Your invitation" };

export default async function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const invite = await getInviteByToken(token);

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-sm rounded-lg border bg-card p-8 text-center shadow-sm">
        <h1 className="mb-2 font-sans text-2xl font-semibold italic tracking-tight">
          Set.
        </h1>

        {!invite ? (
          <p className="mb-2 text-sm text-muted-foreground">
            This invitation link is not valid.
          </p>
        ) : !invite.valid ? (
          <p className="mb-2 text-sm text-muted-foreground">
            {invite.reason === "expired"
              ? "This invitation has expired. Ask an admin to resend it."
              : "This invitation has already been used. Try signing in."}
          </p>
        ) : (
          <>
            <p className="mb-6 mt-1 text-sm text-muted-foreground">
              {invite.inviterName
                ? `${invite.inviterName} invited you`
                : "You have been invited"}{" "}
              to join the alumni community. Accept to set up your profile.
            </p>
            <AcceptForm token={token} email={invite.email} />
          </>
        )}

        <p className="mt-6 text-xs text-muted-foreground">
          <Link href="/login" className="underline">
            Already a member? Sign in
          </Link>
        </p>
      </div>
    </main>
  );
}
