"use client";

import { useState } from "react";
import { Download } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { deleteAccount } from "./actions";

export function DataTab({ graceDays }: { graceDays: number }) {
  const [confirm, setConfirm] = useState("");

  return (
    <div className="max-w-2xl space-y-10">
      <section>
        <h3 className="text-base font-semibold">Download your data</h3>
        <p className="mb-3 mt-1 text-sm text-muted-foreground">
          A JSON file with your profile, event RSVPs, pledges, and any
          announcements you have authored.
        </p>
        <Button asChild variant="outline">
          <a href="/api/me/export">
            <Download className="mr-2 size-4" />
            Download my data
          </a>
        </Button>
      </section>

      <section className="rounded-lg border border-destructive/30 p-4">
        <h3 className="text-base font-semibold text-destructive">
          Delete your account
        </h3>
        <p className="mb-3 mt-1 text-sm text-muted-foreground">
          Your profile is hidden right away and permanently removed after{" "}
          {graceDays} days. Your pledges and event history stay on record as
          &quot;Deleted member&quot;. An administrator can restore your account
          within {graceDays} days.
        </p>
        <Dialog
          onOpenChange={(open) => {
            if (!open) setConfirm("");
          }}
        >
          <DialogTrigger asChild>
            <Button variant="destructive">Delete my account</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete your account</DialogTitle>
              <DialogDescription>
                This signs you out everywhere and hides your profile. It can be
                restored by an administrator within {graceDays} days, after which
                it is permanent.
              </DialogDescription>
            </DialogHeader>
            <form action={deleteAccount} className="space-y-3">
              <Label htmlFor="confirm">
                Type DELETE to confirm
              </Label>
              <Input
                id="confirm"
                name="confirm"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                autoComplete="off"
                autoCapitalize="off"
                spellCheck={false}
              />
              <DialogFooter>
                <DialogClose asChild>
                  <Button type="button" variant="ghost">
                    Cancel
                  </Button>
                </DialogClose>
                <Button
                  type="submit"
                  variant="destructive"
                  disabled={confirm !== "DELETE"}
                >
                  Delete account
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </section>
    </div>
  );
}
