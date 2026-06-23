"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { saveDailyCapAction, saveEmailAction, saveOrgAction } from "./actions";

export function SettingsForm({
  org,
  email,
  dailyCap,
}: {
  org: { name: string; contactEmail: string; foundingYear: string };
  email: { fromName: string; replyTo: string };
  dailyCap: number;
}) {
  const [name, setName] = useState(org.name);
  const [contactEmail, setContactEmail] = useState(org.contactEmail);
  const [foundingYear, setFoundingYear] = useState(org.foundingYear);

  const [fromName, setFromName] = useState(email.fromName);
  const [replyTo, setReplyTo] = useState(email.replyTo);
  const [cap, setCap] = useState(String(dailyCap));

  const [savingOrg, startOrg] = useTransition();
  const [savingEmail, startEmail] = useTransition();

  function saveOrg() {
    startOrg(async () => {
      const res = await saveOrgAction({ name, contactEmail, foundingYear });
      if (res.ok) toast.success("Organization settings saved.");
      else toast.error(res.error ?? "Could not save.");
    });
  }

  function saveEmail() {
    const n = Number(cap);
    if (!Number.isInteger(n) || n < 0 || n > 1000) {
      toast.error("Daily cap must be a whole number between 0 and 1000.");
      return;
    }
    startEmail(async () => {
      const a = await saveEmailAction({ fromName, replyTo });
      const b = await saveDailyCapAction(n);
      if (a.ok && b.ok) toast.success("Email settings saved.");
      else toast.error(a.error ?? b.error ?? "Could not save.");
    });
  }

  return (
    <div className="space-y-6">
      <section className="max-w-xl space-y-4 rounded-lg border bg-card p-5">
        <div>
          <h2 className="text-base font-semibold">Organization</h2>
          <p className="text-sm text-muted-foreground">
            Shown on the public landing and legal pages.
          </p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="org-name">Name</Label>
          <Input
            id="org-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="PAU Alumni Association"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="org-email">Contact email</Label>
          <Input
            id="org-email"
            type="email"
            value={contactEmail}
            onChange={(e) => setContactEmail(e.target.value)}
            placeholder="alumni@example.org"
          />
          <p className="text-xs text-muted-foreground">
            Used for the contact link in the footer and legal pages.
          </p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="org-year">Founding year</Label>
          <Input
            id="org-year"
            value={foundingYear}
            onChange={(e) => setFoundingYear(e.target.value)}
            placeholder="2002"
            inputMode="numeric"
          />
        </div>
        <Button onClick={saveOrg} disabled={savingOrg}>
          {savingOrg ? "Saving..." : "Save organization"}
        </Button>
      </section>

      <section className="max-w-xl space-y-4 rounded-lg border bg-card p-5">
        <div>
          <h2 className="text-base font-semibold">Email</h2>
          <p className="text-sm text-muted-foreground">
            Applied to every message the platform sends.
          </p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="from-name">From name</Label>
          <Input
            id="from-name"
            value={fromName}
            onChange={(e) => setFromName(e.target.value)}
            placeholder="Set"
          />
          <p className="text-xs text-muted-foreground">
            The display name on the from address. The sending address itself is
            fixed by the verified domain.
          </p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="reply-to">Reply-to</Label>
          <Input
            id="reply-to"
            type="email"
            value={replyTo}
            onChange={(e) => setReplyTo(e.target.value)}
            placeholder="alumni@example.org"
          />
          <p className="text-xs text-muted-foreground">
            Where replies go. Leave blank to use the from address.
          </p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="cap">Daily announcement email cap</Label>
          <Input
            id="cap"
            type="number"
            min={0}
            value={cap}
            onChange={(e) => setCap(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            Maximum announcement email campaigns per day. Further sends are
            blocked until the next day. Default 5.
          </p>
        </div>
        <Button onClick={saveEmail} disabled={savingEmail}>
          {savingEmail ? "Saving..." : "Save email settings"}
        </Button>
      </section>
    </div>
  );
}
