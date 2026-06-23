"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

import {
  exportPledgesAction,
  markReceivedAction,
  postUpdateAction,
} from "./actions";

export function MarkReceivedButton({
  pledgeId,
  fundraiserId,
  received,
}: {
  pledgeId: string;
  fundraiserId: string;
  received: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  if (received) {
    return <span className="text-xs text-muted-foreground">received</span>;
  }
  return (
    <Button
      size="sm"
      variant="outline"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const r = await markReceivedAction(pledgeId, fundraiserId);
          if (r.ok) {
            toast.success("Marked received.");
            router.refresh();
          } else {
            toast.error(r.error ?? "Could not update.");
          }
        })
      }
    >
      {pending ? "..." : "Mark received"}
    </Button>
  );
}

export function PostUpdateForm({ fundraiserId }: { fundraiserId: string }) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [pending, start] = useTransition();

  function submit() {
    if (!body.trim()) {
      toast.error("Write an update first.");
      return;
    }
    start(async () => {
      const r = await postUpdateAction(fundraiserId, {
        title: title.trim() || null,
        body,
      });
      if (r.ok) {
        toast.success("Update posted.");
        setTitle("");
        setBody("");
        router.refresh();
      } else {
        toast.error(r.error ?? "Could not post.");
      }
    });
  }

  return (
    <div className="space-y-2">
      <Input
        placeholder="Title (optional)"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
      />
      <Textarea
        rows={4}
        placeholder="Share progress (markdown)"
        value={body}
        onChange={(e) => setBody(e.target.value)}
      />
      <Button onClick={submit} disabled={pending}>
        {pending ? "Posting..." : "Post update"}
      </Button>
    </div>
  );
}

export function CsvExportButton({
  fundraiserId,
  slug,
}: {
  fundraiserId: string;
  slug: string;
}) {
  const [pending, start] = useTransition();
  function go() {
    start(async () => {
      const { csv, count } = await exportPledgesAction(fundraiserId);
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${slug}-pledges.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`Exported ${count} pledge${count === 1 ? "" : "s"}.`);
    });
  }
  return (
    <Button size="sm" variant="outline" onClick={go} disabled={pending}>
      {pending ? "Exporting..." : "Export CSV"}
    </Button>
  );
}
