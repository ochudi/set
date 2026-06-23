"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { nairaToKobo } from "@/lib/money";

import { saveFundraiserAction } from "./actions";

export type FundraiserFormDefaults = {
  title: string;
  slug: string;
  status: "draft" | "active" | "closed" | "archived";
  goalNaira: string;
  startsAt: string; // yyyy-mm-dd or ""
  endsAt: string;
  coverImage: string;
  description: string;
};

const STATUSES = [
  ["draft", "Draft"],
  ["active", "Active"],
  ["closed", "Completed"],
  ["archived", "Archived"],
] as const;

export function FundraiserForm({
  id,
  defaults,
}: {
  id: string | null;
  defaults: FundraiserFormDefaults;
}) {
  const router = useRouter();
  const [v, setV] = useState(defaults);
  const [uploading, setUploading] = useState(false);
  const [pending, start] = useTransition();

  function set<K extends keyof FundraiserFormDefaults>(
    key: K,
    value: FundraiserFormDefaults[K],
  ) {
    setV((prev) => ({ ...prev, [key]: value }));
  }

  async function onCover(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/event-cover", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Upload failed");
      set("coverImage", data.url);
      toast.success("Cover uploaded.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  function save() {
    if (!v.title.trim()) return toast.error("Add a title.");
    let goalKobo: number | null = null;
    if (v.goalNaira.trim()) {
      goalKobo = nairaToKobo(v.goalNaira);
      if (goalKobo === null) return toast.error("Enter a valid goal amount.");
    }
    start(async () => {
      const res = await saveFundraiserAction(id, {
        title: v.title,
        description: v.description,
        goalKobo,
        startsAt: v.startsAt || null,
        endsAt: v.endsAt || null,
        coverImage: v.coverImage,
        slug: v.slug,
        status: v.status,
      });
      if (res.ok) {
        toast.success("Saved.");
        router.push(res.id ? `/admin/fundraisers/${res.id}` : "/admin/fundraisers");
        router.refresh();
      } else {
        toast.error(res.error ?? "Could not save.");
      }
    });
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="title">Title</Label>
        <Input
          id="title"
          value={v.title}
          onChange={(e) => set("title", e.target.value)}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="slug">Slug (public URL)</Label>
          <Input
            id="slug"
            value={v.slug}
            onChange={(e) => set("slug", e.target.value)}
            placeholder="auto from title"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="status">Status</Label>
          <Select
            value={v.status}
            onValueChange={(val) =>
              set("status", val as FundraiserFormDefaults["status"])
            }
          >
            <SelectTrigger id="status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUSES.map(([val, label]) => (
                <SelectItem key={val} value={val}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="goal">Goal (NGN)</Label>
          <Input
            id="goal"
            inputMode="decimal"
            value={v.goalNaira}
            onChange={(e) => set("goalNaira", e.target.value)}
            placeholder="1,000,000"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="startsAt">Starts</Label>
          <Input
            id="startsAt"
            type="date"
            value={v.startsAt}
            onChange={(e) => set("startsAt", e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="endsAt">Ends</Label>
          <Input
            id="endsAt"
            type="date"
            value={v.endsAt}
            onChange={(e) => set("endsAt", e.target.value)}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="cover">Cover image (1200×630)</Label>
        <div className="flex items-center gap-3">
          <Input
            id="cover"
            type="file"
            accept="image/*"
            onChange={onCover}
            disabled={uploading}
            className="max-w-xs"
          />
          {v.coverImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={v.coverImage}
              alt=""
              className="h-12 w-24 rounded border object-cover"
            />
          ) : null}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Story (markdown)</Label>
        <Textarea
          id="description"
          rows={12}
          value={v.description}
          onChange={(e) => set("description", e.target.value)}
          className="font-mono text-[13px]"
        />
      </div>

      <Button onClick={save} disabled={pending || uploading}>
        {pending ? "Saving..." : "Save"}
      </Button>
    </div>
  );
}
