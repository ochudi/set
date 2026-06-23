"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Pencil, Plus, Trash2, X } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { ExcoView } from "@/lib/dal";
import { initials } from "@/lib/member-display";

import {
  createExcoAction,
  deleteExcoAction,
  updateExcoAction,
  type ExcoFormInput,
} from "./actions";

const BLANK: ExcoFormInput = {
  name: "",
  role: "",
  email: "",
  photoUrl: "",
  bio: "",
  setLabel: "",
  group: "exco",
  sortOrder: 0,
};

const selectClass =
  "h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm outline-none focus-visible:border-ring";

export function ExcoManager({ members }: { members: ExcoView[] }) {
  const router = useRouter();
  const [form, setForm] = useState<ExcoFormInput>(BLANK);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const set = <K extends keyof ExcoFormInput>(k: K, v: ExcoFormInput[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  function edit(m: ExcoView) {
    setEditingId(m.id);
    setForm({
      name: m.name,
      role: m.role,
      email: m.email ?? "",
      photoUrl: m.photoUrl ?? "",
      bio: m.bio ?? "",
      setLabel: m.setLabel ?? "",
      group: m.group === "alumni_office" ? "alumni_office" : "exco",
      sortOrder: m.sortOrder,
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function reset() {
    setEditingId(null);
    setForm(BLANK);
  }

  function submit() {
    if (!form.name.trim() || !form.role.trim()) {
      toast.error("Name and role are required.");
      return;
    }
    start(async () => {
      const res = editingId
        ? await updateExcoAction(editingId, form)
        : await createExcoAction(form);
      if (res.ok) {
        toast.success(editingId ? "Updated." : "Added.");
        reset();
        router.refresh();
      } else {
        toast.error(res.error ?? "Could not save.");
      }
    });
  }

  function remove(id: string) {
    if (!confirm("Remove this person from the leadership list?")) return;
    start(async () => {
      const res = await deleteExcoAction(id);
      if (res.ok) {
        toast.success("Removed.");
        router.refresh();
      } else {
        toast.error(res.error ?? "Could not remove.");
      }
    });
  }

  return (
    <div className="space-y-8">
      <section className="max-w-2xl space-y-4 rounded-lg border bg-card p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold">
            {editingId ? "Edit member" : "Add member"}
          </h2>
          {editingId ? (
            <Button variant="ghost" size="sm" onClick={reset}>
              <X className="size-4" /> Cancel
            </Button>
          ) : null}
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Name</Label>
            <Input value={form.name} onChange={(e) => set("name", e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Role</Label>
            <Input value={form.role} onChange={(e) => set("role", e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Group</Label>
            <select
              value={form.group}
              onChange={(e) =>
                set("group", e.target.value as ExcoFormInput["group"])
              }
              className={selectClass}
            >
              <option value="exco">Executive council</option>
              <option value="alumni_office">Alumni office</option>
            </select>
          </div>
          <div className="space-y-2">
            <Label>Set (optional)</Label>
            <Input
              value={form.setLabel}
              placeholder="FT9, 2018"
              onChange={(e) => set("setLabel", e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Email (optional)</Label>
            <Input
              type="email"
              value={form.email}
              onChange={(e) => set("email", e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Sort order</Label>
            <Input
              type="number"
              value={String(form.sortOrder)}
              onChange={(e) => set("sortOrder", Number(e.target.value) || 0)}
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label>Photo URL (optional)</Label>
            <Input
              value={form.photoUrl}
              onChange={(e) => set("photoUrl", e.target.value)}
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label>Bio (optional)</Label>
            <Textarea value={form.bio} onChange={(e) => set("bio", e.target.value)} />
          </div>
        </div>
        <Button onClick={submit} disabled={pending}>
          {editingId ? (
            <>
              <Pencil className="size-4" /> Save changes
            </>
          ) : (
            <>
              <Plus className="size-4" /> Add member
            </>
          )}
        </Button>
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold">
          Current leadership ({members.length})
        </h2>
        {members.length === 0 ? (
          <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
            No one added yet.
          </p>
        ) : (
          <ul className="divide-y rounded-lg border">
            {members.map((m) => (
              <li key={m.id} className="flex items-center gap-3 px-4 py-3">
                <Avatar className="size-9">
                  {m.photoUrl ? <AvatarImage src={m.photoUrl} alt="" /> : null}
                  <AvatarFallback className="text-[11px]">
                    {initials(m.name)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{m.name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {m.role} ·{" "}
                    {m.group === "alumni_office" ? "Alumni office" : "Executive council"}
                  </p>
                </div>
                <Button variant="ghost" size="icon" onClick={() => edit(m)} aria-label="Edit">
                  <Pencil className="size-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => remove(m.id)}
                  aria-label="Remove"
                  className="text-destructive"
                >
                  <Trash2 className="size-4" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
