"use client";

import { useState, type ChangeEvent } from "react";

export function AvatarUploader({ defaultUrl }: { defaultUrl?: string | null }) {
  const [url, setUrl] = useState(defaultUrl ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onChange(event: ChangeEvent<HTMLInputElement>) {
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
      setUrl(data.url);
    } catch {
      setError("Upload failed. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2">
      <input type="hidden" name="avatarUrl" value={url} />
      <div className="flex items-center gap-3">
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={url}
            alt="Your avatar"
            className="size-16 rounded-full border object-cover"
          />
        ) : (
          <div className="size-16 rounded-full border bg-muted" />
        )}
        <input
          type="file"
          accept="image/png,image/jpeg,image/webp"
          onChange={onChange}
          className="text-sm"
        />
      </div>
      {busy ? <p className="text-xs text-muted-foreground">Uploading...</p> : null}
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
