"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Download,
  Plus,
  Printer,
  Sparkles,
  Trash2,
  Wand2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { MinutesDraft } from "@/lib/minutes";

import {
  createMinutesAction,
  deleteMinutesAction,
  generateMinutesAction,
  updateMinutesAction,
} from "./actions";

type Status = "draft" | "final";

export function MinutesWorkbench({
  id,
  initialDraft,
  initialTranscript,
}: {
  id?: string;
  initialDraft: MinutesDraft;
  initialTranscript: string;
}) {
  const router = useRouter();
  const [phase, setPhase] = useState<"input" | "edit">(id ? "edit" : "input");
  const [transcript, setTranscript] = useState(initialTranscript);
  const [notes, setNotes] = useState("");
  const [draft, setDraft] = useState<MinutesDraft>(initialDraft);
  const [showSource, setShowSource] = useState(false);
  const [generating, startGen] = useTransition();
  const [saving, startSave] = useTransition();

  const set = <K extends keyof MinutesDraft>(k: K, v: MinutesDraft[K]) =>
    setDraft((d) => ({ ...d, [k]: v }));

  function generate() {
    if (!transcript.trim()) {
      toast.error("Paste a transcript first.");
      return;
    }
    const t = toast.loading("Reading the transcript...");
    startGen(async () => {
      const res = await generateMinutesAction(transcript, notes);
      toast.dismiss(t);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setDraft(res.draft);
      setPhase("edit");
      toast.success(
        res.usedAi
          ? "Draft created with AI. Review and edit below."
          : "Draft started. Set an AI key to get a fuller first draft.",
      );
    });
  }

  function save(status: Status) {
    const t = toast.loading("Saving...");
    startSave(async () => {
      if (id) {
        const res = await updateMinutesAction(id, draft, status);
        toast.dismiss(t);
        if (res.ok) toast.success("Saved.");
        else toast.error(res.error ?? "Could not save.");
      } else {
        const res = await createMinutesAction(draft, transcript, status);
        toast.dismiss(t);
        if (res.ok) {
          toast.success("Saved.");
          router.push(`/admin/minutes/${res.id}`);
        } else {
          toast.error("Could not save.");
        }
      }
    });
  }

  function remove() {
    if (!id) return;
    if (!confirm("Delete these minutes? This cannot be undone.")) return;
    startSave(async () => {
      const res = await deleteMinutesAction(id);
      if (res.ok) {
        toast.success("Deleted.");
        router.push("/admin/minutes");
      } else {
        toast.error(res.error ?? "Could not delete.");
      }
    });
  }

  if (phase === "input") {
    return (
      <div className="max-w-2xl space-y-4">
        <div className="space-y-2">
          <Label htmlFor="transcript">Transcript</Label>
          <Textarea
            id="transcript"
            value={transcript}
            onChange={(e) => setTranscript(e.target.value)}
            placeholder="Paste the meeting transcript here (Teams, Otter, Zoom, or your own notes)."
            className="min-h-60 font-mono text-xs"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="notes">Your notes (optional)</Label>
          <Textarea
            id="notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Anything to emphasise: decisions, who to credit, action items you caught."
            className="min-h-28"
          />
        </div>
        <div className="flex items-center gap-3">
          <Button onClick={generate} disabled={generating}>
            <Sparkles className="size-4" />
            {generating ? "Generating..." : "Generate minutes"}
          </Button>
          <p className="text-xs text-muted-foreground">
            You can edit everything afterwards.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={() => save("draft")} disabled={saving}>
          Save draft
        </Button>
        <Button onClick={() => save("final")} disabled={saving} variant="secondary">
          Save as final
        </Button>
        {id ? (
          <>
            <Button asChild variant="outline">
              <a href={`/api/admin/minutes/${id}/docx`}>
                <Download className="size-4" /> Word
              </a>
            </Button>
            <Button asChild variant="outline">
              <a href={`/print/minutes/${id}`} target="_blank" rel="noreferrer">
                <Printer className="size-4" /> Print / PDF
              </a>
            </Button>
            <Button onClick={remove} disabled={saving} variant="ghost" className="ml-auto text-destructive">
              <Trash2 className="size-4" /> Delete
            </Button>
          </>
        ) : (
          <p className="text-xs text-muted-foreground">
            Save to enable Word and PDF export.
          </p>
        )}
      </div>

      {/* meta */}
      <section className="grid gap-4 sm:grid-cols-2">
        <Field label="Title">
          <Input value={draft.title} onChange={(e) => set("title", e.target.value)} />
        </Field>
        <Field label="Date">
          <Input
            type="date"
            value={draft.meetingDate}
            onChange={(e) => set("meetingDate", e.target.value)}
          />
        </Field>
        <Field label="Location">
          <Input value={draft.location} onChange={(e) => set("location", e.target.value)} />
        </Field>
        <Field label="Facilitator">
          <Input
            value={draft.facilitator}
            onChange={(e) => set("facilitator", e.target.value)}
          />
        </Field>
        <Field label="Minutes by">
          <Input value={draft.minutesBy} onChange={(e) => set("minutesBy", e.target.value)} />
        </Field>
      </section>

      <StringList
        label="Attendees"
        items={draft.attendees}
        placeholder="Name, class"
        onChange={(v) => set("attendees", v)}
      />

      {/* sections */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">Discussion</h2>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() =>
              set("sections", [...draft.sections, { heading: "", points: [""] }])
            }
          >
            <Plus className="size-4" /> Section
          </Button>
        </div>
        {draft.sections.map((s, si) => (
          <div key={si} className="space-y-2 rounded-lg border bg-card p-4">
            <div className="flex items-center gap-2">
              <Input
                value={s.heading}
                placeholder="Section heading"
                onChange={(e) => {
                  const next = [...draft.sections];
                  next[si] = { ...s, heading: e.target.value };
                  set("sections", next);
                }}
                className="font-medium"
              />
              <Button
                type="button"
                size="icon"
                variant="ghost"
                onClick={() => set("sections", draft.sections.filter((_, i) => i !== si))}
                aria-label="Remove section"
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
            {s.points.map((p, pi) => (
              <div key={pi} className="flex items-start gap-2 pl-2">
                <span className="mt-2.5 text-muted-foreground">•</span>
                <Textarea
                  value={p}
                  onChange={(e) => {
                    const next = [...draft.sections];
                    const pts = [...s.points];
                    pts[pi] = e.target.value;
                    next[si] = { ...s, points: pts };
                    set("sections", next);
                  }}
                  className="min-h-9 py-1.5"
                />
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  onClick={() => {
                    const next = [...draft.sections];
                    next[si] = { ...s, points: s.points.filter((_, i) => i !== pi) };
                    set("sections", next);
                  }}
                  aria-label="Remove point"
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            ))}
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => {
                const next = [...draft.sections];
                next[si] = { ...s, points: [...s.points, ""] };
                set("sections", next);
              }}
            >
              <Plus className="size-4" /> Point
            </Button>
          </div>
        ))}
      </section>

      <StringList
        label="Decisions"
        items={draft.decisions}
        placeholder="A decision or resolution reached"
        onChange={(v) => set("decisions", v)}
      />

      {/* action items */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">Action items</h2>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() =>
              set("actionItems", [...draft.actionItems, { task: "", owner: "", due: "" }])
            }
          >
            <Plus className="size-4" /> Action
          </Button>
        </div>
        {draft.actionItems.map((a, ai) => (
          <div key={ai} className="flex flex-wrap items-center gap-2">
            <Input
              value={a.task}
              placeholder="Task"
              className="min-w-48 flex-1"
              onChange={(e) => {
                const next = [...draft.actionItems];
                next[ai] = { ...a, task: e.target.value };
                set("actionItems", next);
              }}
            />
            <Input
              value={a.owner}
              placeholder="Owner"
              className="w-36"
              onChange={(e) => {
                const next = [...draft.actionItems];
                next[ai] = { ...a, owner: e.target.value };
                set("actionItems", next);
              }}
            />
            <Input
              value={a.due}
              placeholder="Due"
              className="w-32"
              onChange={(e) => {
                const next = [...draft.actionItems];
                next[ai] = { ...a, due: e.target.value };
                set("actionItems", next);
              }}
            />
            <Button
              type="button"
              size="icon"
              variant="ghost"
              onClick={() => set("actionItems", draft.actionItems.filter((_, i) => i !== ai))}
              aria-label="Remove action item"
            >
              <Trash2 className="size-4" />
            </Button>
          </div>
        ))}
      </section>

      {/* regenerate */}
      <section className="rounded-lg border border-dashed p-4">
        <button
          type="button"
          onClick={() => setShowSource((v) => !v)}
          className="text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          {showSource ? "Hide" : "Show"} source transcript
        </button>
        {showSource ? (
          <div className="mt-3 space-y-2">
            <Textarea
              value={transcript}
              onChange={(e) => setTranscript(e.target.value)}
              className="min-h-40 font-mono text-xs"
            />
            <Button onClick={generate} disabled={generating} variant="outline">
              <Wand2 className="size-4" />
              {generating ? "Regenerating..." : "Regenerate from transcript"}
            </Button>
            <p className="text-xs text-muted-foreground">
              Regenerating replaces the fields above with a fresh draft.
            </p>
          </div>
        ) : null}
      </section>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function StringList({
  label,
  items,
  placeholder,
  onChange,
}: {
  label: string;
  items: string[];
  placeholder: string;
  onChange: (items: string[]) => void;
}) {
  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">{label}</h2>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => onChange([...items, ""])}
        >
          <Plus className="size-4" /> Add
        </Button>
      </div>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">None yet.</p>
      ) : (
        <div className="space-y-2">
          {items.map((it, i) => (
            <div key={i} className="flex items-center gap-2">
              <Input
                value={it}
                placeholder={placeholder}
                onChange={(e) => {
                  const next = [...items];
                  next[i] = e.target.value;
                  onChange(next);
                }}
              />
              <Button
                type="button"
                size="icon"
                variant="ghost"
                onClick={() => onChange(items.filter((_, idx) => idx !== i))}
                aria-label="Remove"
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
