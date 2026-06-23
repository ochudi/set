"use client";

import Script from "next/script";
import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { externalPledgeAction, type ExternalPledgeState } from "./actions";

const FIELD =
  "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm";

export function ExternalPledgeForm({
  slug,
  siteKey,
}: {
  slug: string;
  siteKey: string | null;
}) {
  const [state, action, pending] = useActionState<
    ExternalPledgeState | undefined,
    FormData
  >(externalPledgeAction, undefined);

  if (state?.ok) {
    return (
      <div className="rounded-lg border bg-card p-5 text-center">
        <p className="text-sm">{state.message}</p>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-4 rounded-lg border bg-card p-5">
      <h2 className="text-base font-semibold">Make a pledge</h2>
      <input type="hidden" name="slug" value={slug} />

      <div className="space-y-2">
        <Label htmlFor="name">Your name</Label>
        <Input id="name" name="name" required maxLength={120} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="amount">Amount (NGN)</Label>
        <Input id="amount" name="amount" inputMode="decimal" required placeholder="5,000" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="channel">Channel</Label>
        <select id="channel" name="channel" defaultValue="transfer" className={FIELD}>
          <option value="transfer">Bank transfer</option>
          <option value="cash">Cash</option>
          <option value="card">Card</option>
          <option value="other">Other</option>
        </select>
      </div>

      {siteKey ? (
        <>
          <Script
            src="https://challenges.cloudflare.com/turnstile/v0/api.js"
            async
            defer
          />
          <div className="cf-turnstile" data-sitekey={siteKey} />
        </>
      ) : (
        // Dev: no Turnstile site key configured. Submit a placeholder token so
        // the form is usable; the server still rejects a truly missing token.
        <input type="hidden" name="cf-turnstile-response" value="dev-no-turnstile" />
      )}

      {state && !state.ok ? (
        <p className="text-sm text-destructive">{state.message}</p>
      ) : null}

      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Submitting..." : "Pledge"}
      </Button>
      <p className="text-center text-xs text-muted-foreground">
        A pledge is a promise to give. The team will reach out with payment
        details.
      </p>
    </form>
  );
}
