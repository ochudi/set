"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

import {
  deleteAnnouncementAction,
  publishAction,
  saveDraftAction,
} from "./actions";

const MD =
  "text-sm leading-relaxed [&_a]:text-brand [&_a]:underline [&_h2]:mt-4 [&_h2]:text-base [&_h2]:font-semibold [&_h3]:font-semibold [&_li]:my-1 [&_ol]:list-decimal [&_ol]:pl-5 [&_ul]:list-disc [&_ul]:pl-5";

export type AnnouncementFormValues = {
  title: string;
  body: string;
  pinned: boolean;
};

export function AnnouncementForm({
  id,
  defaults,
  recipientCount,
}: {
  id: string | null;
  defaults: AnnouncementFormValues;
  recipientCount: number;
}) {
  const router = useRouter();
  const [title, setTitle] = useState(defaults.title);
  const [body, setBody] = useState(defaults.body);
  const [pinned, setPinned] = useState(defaults.pinned);
  const [emailMembers, setEmailMembers] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [pending, start] = useTransition();

  const valid = title.trim().length > 0 && body.trim().length > 0;
  const input = () => ({ title: title.trim(), body, pinned });

  function saveDraft() {
    if (!valid) return toast.error("Add a title and body first.");
    start(async () => {
      const res = await saveDraftAction(id, input());
      if (res.ok) {
        toast.success("Draft saved.");
        router.push("/admin/announcements");
        router.refresh();
      } else {
        toast.error(res.error ?? "Could not save.");
      }
    });
  }

  function doPublish() {
    start(async () => {
      const res = await publishAction(id, input(), emailMembers);
      if (!res.ok) {
        toast.error(res.error ?? "Could not publish.");
        return;
      }
      if (res.capExceeded) {
        toast.warning(res.error ?? "Daily email cap reached.");
      } else if (res.emailed > 0) {
        toast.success(
          `Published and emailed ${res.emailed} member${res.emailed === 1 ? "" : "s"}.`,
        );
      } else {
        toast.success("Published.");
      }
      setConfirmOpen(false);
      router.push("/admin/announcements");
      router.refresh();
    });
  }

  function onPublishClick() {
    if (!valid) return toast.error("Add a title and body first.");
    if (emailMembers) {
      setConfirmText("");
      setConfirmOpen(true);
    } else {
      doPublish();
    }
  }

  function onDelete() {
    if (!id) return;
    if (!window.confirm("Delete this announcement? This cannot be undone."))
      return;
    start(async () => {
      const res = await deleteAnnouncementAction(id);
      if (res.ok) {
        toast.success("Announcement deleted.");
        router.push("/admin/announcements");
        router.refresh();
      } else {
        toast.error(res.error ?? "Could not delete.");
      }
    });
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="title">Title</Label>
        <Input
          id="title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Announcement title"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="body">Body (markdown)</Label>
          <Textarea
            id="body"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={18}
            className="font-mono text-[13px]"
            placeholder="Write in markdown. Links and lists are supported."
          />
        </div>
        <div className="space-y-2">
          <Label>Preview</Label>
          <div className={`min-h-[18rem] rounded-md border bg-card p-3 ${MD}`}>
            {body.trim() ? (
              <Markdown remarkPlugins={[remarkGfm]}>{body}</Markdown>
            ) : (
              <p className="text-sm text-muted-foreground">
                Nothing to preview yet.
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-6">
        <label className="flex items-center gap-2 text-sm">
          <Switch checked={pinned} onCheckedChange={setPinned} />
          Pinned
        </label>
        <label className="flex items-center gap-2 text-sm">
          <Switch checked={emailMembers} onCheckedChange={setEmailMembers} />
          Email members on publish
        </label>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button variant="outline" onClick={saveDraft} disabled={pending}>
          Save draft
        </Button>
        <Button onClick={onPublishClick} disabled={pending}>
          Publish
        </Button>
        {id ? (
          <Button
            variant="ghost"
            onClick={onDelete}
            disabled={pending}
            className="ml-auto text-destructive hover:text-destructive"
          >
            Delete
          </Button>
        ) : null}
      </div>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Publish and email members?</DialogTitle>
            <DialogDescription>
              This emails the {recipientCount} member
              {recipientCount === 1 ? "" : "s"} opted in to announcement emails.
              Type PUBLISH to confirm.
            </DialogDescription>
          </DialogHeader>
          <Input
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder="PUBLISH"
            autoFocus
          />
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setConfirmOpen(false)}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button
              onClick={doPublish}
              disabled={pending || confirmText !== "PUBLISH"}
            >
              {pending ? "Publishing..." : "Publish and email"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
