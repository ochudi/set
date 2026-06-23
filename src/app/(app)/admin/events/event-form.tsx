"use client";

import { useState, useTransition, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

import {
  createEventAction,
  publishEventAction,
  updateEventAction,
} from "./actions";

export type EventFormValues = {
  title: string;
  description: string;
  isVirtual: boolean;
  location: string;
  meetingUrl: string;
  startsAtLocal: string; // datetime-local string, WAT
  endsAtLocal: string;
  capacity: string;
  coverImage: string;
};

export const EMPTY_EVENT: EventFormValues = {
  title: "",
  description: "",
  isVirtual: false,
  location: "",
  meetingUrl: "",
  startsAtLocal: "",
  endsAtLocal: "",
  capacity: "",
  coverImage: "",
};

export function EventForm({
  mode,
  eventId,
  defaults,
}: {
  mode: "create" | "edit";
  eventId?: string;
  defaults: EventFormValues;
}) {
  const router = useRouter();
  const [form, setForm] = useState<EventFormValues>(defaults);
  const [publishNow, setPublishNow] = useState(false);
  const [emailMembers, setEmailMembers] = useState(false);
  const [coverBusy, setCoverBusy] = useState(false);
  const [pending, startTransition] = useTransition();

  function set<K extends keyof EventFormValues>(key: K, value: EventFormValues[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function onCover(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setCoverBusy(true);
    try {
      const body = new FormData();
      body.append("file", file);
      const res = await fetch("/api/event-cover", { method: "POST", body });
      if (!res.ok) {
        toast.error("Cover upload failed. Use a JPG, PNG, or WebP under 8 MB.");
        return;
      }
      const data = (await res.json()) as { url: string };
      set("coverImage", data.url);
    } catch {
      toast.error("Cover upload failed.");
    } finally {
      setCoverBusy(false);
    }
  }

  function payload() {
    return {
      title: form.title,
      description: form.description,
      isVirtual: form.isVirtual,
      location: form.location,
      meetingUrl: form.meetingUrl,
      startsAt: form.startsAtLocal,
      endsAt: form.endsAtLocal,
      capacity: form.capacity,
      coverImage: form.coverImage,
    };
  }

  function submit() {
    startTransition(async () => {
      if (mode === "create") {
        const res = await createEventAction(payload());
        if (!res.ok || !res.id) {
          toast.error(res.error ?? "Could not create the event");
          return;
        }
        if (publishNow) {
          const pub = await publishEventAction(res.id, emailMembers);
          toast.success(
            emailMembers
              ? `Published and emailed ${pub.emailed ?? 0} members`
              : "Event published",
          );
        } else {
          toast.success("Draft saved");
        }
        router.push(`/admin/events/${res.id}`);
      } else if (eventId) {
        const res = await updateEventAction(eventId, payload());
        if (res.ok) {
          toast.success("Event updated");
          router.refresh();
        } else {
          toast.error(res.error ?? "Could not save");
        }
      }
    });
  }

  return (
    <form
      className="max-w-3xl space-y-6"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <div className="space-y-1.5">
        <Label htmlFor="ev-title">Title</Label>
        <Input
          id="ev-title"
          value={form.title}
          onChange={(e) => set("title", e.target.value)}
          required
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="ev-desc">Description</Label>
        <div className="grid gap-3 lg:grid-cols-2">
          <Textarea
            id="ev-desc"
            rows={10}
            value={form.description}
            onChange={(e) => set("description", e.target.value)}
            placeholder="Markdown supported"
            className="font-mono text-[13px]"
          />
          <div className="rounded-md border bg-muted/30 p-3">
            <p className="mb-2 font-mono text-[11px] uppercase text-muted-foreground">
              Preview
            </p>
            <div className="space-y-3 text-sm leading-relaxed [&_a]:text-brand [&_a]:underline [&_h2]:text-base [&_h2]:font-semibold [&_li]:my-1 [&_ol]:list-decimal [&_ol]:pl-5 [&_ul]:list-disc [&_ul]:pl-5">
              {form.description ? (
                <Markdown remarkPlugins={[remarkGfm]}>{form.description}</Markdown>
              ) : (
                <p className="text-muted-foreground">Nothing to preview yet.</p>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between rounded-md border p-3">
        <div>
          <Label htmlFor="ev-virtual">Virtual event</Label>
          <p className="text-sm text-muted-foreground">
            Reveals the meeting link only to members who RSVP going or maybe.
          </p>
        </div>
        <Switch
          id="ev-virtual"
          checked={form.isVirtual}
          onCheckedChange={(v) => set("isVirtual", v)}
        />
      </div>

      {form.isVirtual ? (
        <div className="space-y-1.5">
          <Label htmlFor="ev-meeting">Meeting link</Label>
          <Input
            id="ev-meeting"
            value={form.meetingUrl}
            onChange={(e) => set("meetingUrl", e.target.value)}
            placeholder="https://meet..."
          />
        </div>
      ) : (
        <div className="space-y-1.5">
          <Label htmlFor="ev-location">Location</Label>
          <Input
            id="ev-location"
            value={form.location}
            onChange={(e) => set("location", e.target.value)}
            placeholder="Venue and address"
          />
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="ev-start">Starts</Label>
          <Input
            id="ev-start"
            type="datetime-local"
            value={form.startsAtLocal}
            onChange={(e) => set("startsAtLocal", e.target.value)}
            required
          />
          <p className="text-xs text-muted-foreground">Times are West Africa Time (WAT).</p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="ev-end">Ends (optional)</Label>
          <Input
            id="ev-end"
            type="datetime-local"
            value={form.endsAtLocal}
            onChange={(e) => set("endsAtLocal", e.target.value)}
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="ev-capacity">Capacity (optional)</Label>
          <Input
            id="ev-capacity"
            type="number"
            min={1}
            value={form.capacity}
            onChange={(e) => set("capacity", e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label>Cover image</Label>
          <div className="flex items-center gap-3">
            {form.coverImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={form.coverImage}
                alt=""
                className="h-10 w-16 rounded border object-cover"
              />
            ) : null}
            <label className="inline-flex cursor-pointer items-center rounded-md border bg-background px-3 py-1.5 text-sm hover:bg-muted">
              {coverBusy ? "Uploading..." : form.coverImage ? "Replace" : "Upload"}
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="sr-only"
                disabled={coverBusy}
                onChange={onCover}
              />
            </label>
            {form.coverImage ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => set("coverImage", "")}
              >
                Remove
              </Button>
            ) : null}
          </div>
        </div>
      </div>

      {mode === "create" ? (
        <div className="space-y-3 rounded-md border p-3">
          <label className="flex items-center gap-2 text-sm">
            <Switch checked={publishNow} onCheckedChange={setPublishNow} />
            Publish immediately
          </label>
          {publishNow ? (
            <label className="flex items-center gap-2 text-sm">
              <Switch checked={emailMembers} onCheckedChange={setEmailMembers} />
              Email opted-in members an invitation
            </label>
          ) : null}
        </div>
      ) : null}

      <Button type="submit" disabled={pending || coverBusy}>
        {pending
          ? "Saving..."
          : mode === "create"
            ? publishNow
              ? "Create and publish"
              : "Save draft"
            : "Save changes"}
      </Button>
    </form>
  );
}
