import type { Metadata } from "next";

export const metadata: Metadata = { title: "Check your inbox" };

export default function VerifyPage() {
  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-sm rounded-lg border bg-card p-8 text-center shadow-sm">
        <h1 className="mb-3 font-sans text-2xl font-semibold italic tracking-tight">
          Set.
        </h1>
        <p className="text-sm">Check your inbox. The link expires in 10 minutes.</p>
      </div>
    </main>
  );
}
