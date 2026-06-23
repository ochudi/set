"use client";

import { useState, type ChangeEvent } from "react";

import { initials } from "@/lib/member-display";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";

/**
 * Controlled avatar uploader for react-hook-form. Posts to /api/avatar (which
 * re-encodes and strips EXIF server-side) and reports the public URL via
 * onChange so the form owns the value.
 */
export function AvatarField({
  value,
  fallbackName,
  onChange,
}: {
  value: string;
  fallbackName: string;
  onChange: (url: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handle(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const body = new FormData();
      body.append("file", file);
      const res = await fetch("/api/avatar", { method: "POST", body });
      if (!res.ok) {
        setError("Upload failed. Use a JPG, PNG, or WebP under 8 MB.");
        return;
      }
      const data = (await res.json()) as { url: string };
      onChange(data.url);
    } catch {
      setError("Upload failed. Please try again.");
    } finally {
      setBusy(false);
      event.target.value = "";
    }
  }

  return (
    <div className="flex items-center gap-4">
      <Avatar className="size-16">
        {value ? <AvatarImage src={value} alt="" /> : null}
        <AvatarFallback>{initials(fallbackName || "M")}</AvatarFallback>
      </Avatar>
      <div className="flex flex-wrap items-center gap-2">
        <label className="inline-flex cursor-pointer items-center rounded-md border bg-background px-3 py-1.5 text-sm hover:bg-muted">
          {busy ? "Uploading..." : "Replace photo"}
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={handle}
            className="sr-only"
            disabled={busy}
          />
        </label>
        {value ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-muted-foreground"
            onClick={() => onChange("")}
          >
            Remove
          </Button>
        ) : null}
        {error ? <p className="w-full text-xs text-destructive">{error}</p> : null}
      </div>
    </div>
  );
}
