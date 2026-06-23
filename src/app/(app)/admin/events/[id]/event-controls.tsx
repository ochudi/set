"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Download } from "lucide-react";
import { toast } from "sonner";

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
import { Switch } from "@/components/ui/switch";

import {
  cancelEventAction,
  deleteEventAction,
  exportRsvpsAction,
  publishEventAction,
  sendInvitesAction,
} from "../actions";

function downloadCsv(csv: string) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "event-rsvps.csv";
  a.click();
  URL.revokeObjectURL(url);
}

export function EventControls({
  eventId,
  status,
}: {
  eventId: string;
  status: "draft" | "published" | "past" | "canceled";
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [email, setEmail] = useState(false);
  const [cancelConfirm, setCancelConfirm] = useState("");

  function publish() {
    startTransition(async () => {
      const res = await publishEventAction(eventId, email);
      if (res.ok) {
        toast.success(
          email ? `Published and emailed ${res.emailed ?? 0} members` : "Published",
        );
        router.refresh();
      } else {
        toast.error(res.error ?? "Could not publish");
      }
    });
  }

  function invites() {
    startTransition(async () => {
      const res = await sendInvitesAction(eventId);
      if (res.ok) toast.success(`Invites sent to ${res.recipients ?? 0} members`);
      else toast.error("Could not send invites");
    });
  }

  function cancel() {
    startTransition(async () => {
      const res = await cancelEventAction(eventId);
      if (res.ok) {
        toast.success(`Cancelled. Notified ${res.notified ?? 0} attendees.`);
        router.refresh();
      } else {
        toast.error(res.error ?? "Could not cancel");
      }
    });
  }

  function del() {
    startTransition(async () => {
      const res = await deleteEventAction(eventId);
      if (res.ok) {
        toast.success("Event deleted");
        router.push("/admin/events");
      } else {
        toast.error(res.error ?? "Could not delete");
      }
    });
  }

  function exportCsv() {
    startTransition(async () => {
      const res = await exportRsvpsAction(eventId);
      downloadCsv(res.csv);
      toast.success(`Exported ${res.count} RSVP${res.count === 1 ? "" : "s"}`);
    });
  }

  const active = status === "published";

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/30 p-3">
      {status === "draft" ? (
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-sm">
            <Switch checked={email} onCheckedChange={setEmail} />
            Email members
          </label>
          <Button size="sm" disabled={pending} onClick={publish}>
            Publish
          </Button>
        </div>
      ) : null}

      {active ? (
        <Button size="sm" variant="outline" disabled={pending} onClick={invites}>
          Send invites
        </Button>
      ) : null}

      <Button size="sm" variant="outline" disabled={pending} onClick={exportCsv}>
        <Download className="mr-2 size-4" /> RSVPs CSV
      </Button>

      {active ? (
        <Dialog onOpenChange={(o) => !o && setCancelConfirm("")}>
          <DialogTrigger asChild>
            <Button size="sm" variant="outline">
              Cancel event
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Cancel this event</DialogTitle>
              <DialogDescription>
                Going and maybe attendees will be emailed a cancellation with an
                updated calendar entry. Type CANCEL to confirm.
              </DialogDescription>
            </DialogHeader>
            <Label htmlFor="cancel-confirm">Type CANCEL</Label>
            <Input
              id="cancel-confirm"
              value={cancelConfirm}
              onChange={(e) => setCancelConfirm(e.target.value)}
              autoComplete="off"
            />
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="ghost">Keep event</Button>
              </DialogClose>
              <Button
                variant="destructive"
                disabled={pending || cancelConfirm !== "CANCEL"}
                onClick={cancel}
              >
                Cancel event
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ) : null}

      <Dialog>
        <DialogTrigger asChild>
          <Button size="sm" variant="ghost" className="text-destructive">
            Delete
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete this event</DialogTitle>
            <DialogDescription>
              This removes the event from the platform. RSVP records are removed
              with it. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="ghost">Keep</Button>
            </DialogClose>
            <Button variant="destructive" disabled={pending} onClick={del}>
              Delete event
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
