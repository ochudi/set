"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { transferSuperAdminAction } from "./actions";

type Candidate = { userId: string; name: string; email: string };

export function DangerZone({ candidates }: { candidates: Candidate[] }) {
  const router = useRouter();
  const [targetId, setTargetId] = useState("");
  const [confirm, setConfirm] = useState("");
  const [pending, start] = useTransition();

  const target = candidates.find((c) => c.userId === targetId) ?? null;
  const confirmed =
    target != null && confirm.trim().toLowerCase() === target.email.toLowerCase();

  function transfer() {
    if (!target) {
      toast.error("Choose who should become super admin.");
      return;
    }
    if (!confirmed) {
      toast.error("Type the new super admin's email to confirm.");
      return;
    }
    start(async () => {
      const res = await transferSuperAdminAction({
        targetUserId: target.userId,
        confirmEmail: confirm,
      });
      if (res.ok) {
        toast.success(`Super admin transferred to ${target.name}.`);
        setConfirm("");
        setTargetId("");
        router.refresh();
      } else {
        toast.error(res.error ?? "Could not transfer.");
      }
    });
  }

  return (
    <section className="max-w-xl space-y-6 rounded-lg border border-destructive/30 bg-card p-5">
      <div>
        <h2 className="text-base font-semibold text-destructive">Danger zone</h2>
        <p className="text-sm text-muted-foreground">
          These actions are powerful and audited.
        </p>
      </div>

      <div className="space-y-2">
        <h3 className="text-sm font-medium">Export all data</h3>
        <p className="text-sm text-muted-foreground">
          Download a zip of CSVs covering members, events, RSVPs, fundraisers,
          pledges, announcements, and the audit log.
        </p>
        {/* POST so the audit write is not a GET (rule 5); the browser downloads
            the response directly. */}
        <form method="POST" action="/api/admin/export">
          <Button type="submit" variant="outline">
            Export all data
          </Button>
        </form>
      </div>

      <div className="space-y-3 border-t pt-4">
        <h3 className="text-sm font-medium">Transfer super admin</h3>
        <p className="text-sm text-muted-foreground">
          Hand super admin to another active member. You will be demoted to exco.
          This cannot be undone by you afterwards.
        </p>
        <div className="space-y-2">
          <Label htmlFor="transfer-target">New super admin</Label>
          <select
            id="transfer-target"
            value={targetId}
            onChange={(e) => {
              setTargetId(e.target.value);
              setConfirm("");
            }}
            className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm outline-none focus-visible:border-ring"
          >
            <option value="">Select a member</option>
            {candidates.map((c) => (
              <option key={c.userId} value={c.userId}>
                {c.name} ({c.email})
              </option>
            ))}
          </select>
        </div>
        {target ? (
          <div className="space-y-2">
            <Label htmlFor="transfer-confirm">
              Type {target.email} to confirm
            </Label>
            <Input
              id="transfer-confirm"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder={target.email}
              autoComplete="off"
            />
          </div>
        ) : null}
        <Button
          onClick={transfer}
          disabled={pending || !confirmed}
          variant="destructive"
        >
          {pending ? "Transferring..." : "Transfer super admin"}
        </Button>
      </div>
    </section>
  );
}
