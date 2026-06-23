"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { PAU_FACULTIES } from "@/lib/pau";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

import { editMember, loadMemberForEdit, type EditableMember } from "./actions";
import type { RosterRow } from "./members-admin";

const selectClass =
  "h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm outline-none focus-visible:border-ring";

export function EditMemberSheet({
  member,
  onOpenChange,
}: {
  member: RosterRow | null;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState<EditableMember | null>(null);

  useEffect(() => {
    let active = true;
    if (member) {
      setLoading(true);
      setForm(null);
      loadMemberForEdit(member.id).then((data) => {
        if (active) {
          setForm(data);
          setLoading(false);
        }
      });
    }
    return () => {
      active = false;
    };
  }, [member]);

  function set<K extends keyof EditableMember>(key: K, value: string) {
    setForm((f) => (f ? { ...f, [key]: value } : f));
  }

  function submit() {
    if (!member || !form) return;
    startTransition(async () => {
      const res = await editMember(member.id, form);
      if (res.ok) {
        toast.success("Member updated");
        router.refresh();
        onOpenChange(false);
      } else {
        toast.error(res.error ?? "Could not save");
      }
    });
  }

  return (
    <Sheet open={!!member} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col gap-0 overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Edit member</SheetTitle>
          <SheetDescription>
            {member ? member.email : ""}
          </SheetDescription>
        </SheetHeader>

        {loading || !form ? (
          <div className="space-y-4 p-4">
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-9 w-full" />
          </div>
        ) : (
          <form
            className="flex flex-1 flex-col gap-4 p-4"
            onSubmit={(e) => {
              e.preventDefault();
              submit();
            }}
          >
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="em-first">First name</Label>
                <Input
                  id="em-first"
                  value={form.firstName}
                  onChange={(e) => set("firstName", e.target.value)}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="em-last">Last name</Label>
                <Input
                  id="em-last"
                  value={form.lastName}
                  onChange={(e) => set("lastName", e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="em-preferred">Preferred name</Label>
              <Input
                id="em-preferred"
                value={form.preferredName}
                onChange={(e) => set("preferredName", e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="em-year">Graduating year</Label>
                <Input
                  id="em-year"
                  type="number"
                  min={1990}
                  max={2100}
                  value={form.graduationYear}
                  onChange={(e) => set("graduationYear", e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="em-faculty">Faculty</Label>
                <select
                  id="em-faculty"
                  value={form.faculty}
                  onChange={(e) => set("faculty", e.target.value)}
                  className={selectClass}
                >
                  <option value="">Not specified</option>
                  {PAU_FACULTIES.map((f) => (
                    <option key={f} value={f}>
                      {f}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="em-city">City</Label>
                <Input
                  id="em-city"
                  value={form.city}
                  onChange={(e) => set("city", e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="em-country">Country</Label>
                <Input
                  id="em-country"
                  value={form.country}
                  onChange={(e) => set("country", e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="em-role">Role</Label>
                <Input
                  id="em-role"
                  value={form.jobTitle}
                  onChange={(e) => set("jobTitle", e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="em-employer">Employer</Label>
                <Input
                  id="em-employer"
                  value={form.company}
                  onChange={(e) => set("company", e.target.value)}
                />
              </div>
            </div>

            <SheetFooter className="mt-auto flex-row justify-end gap-2 px-0">
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={pending}>
                {pending ? "Saving..." : "Save changes"}
              </Button>
            </SheetFooter>
          </form>
        )}
      </SheetContent>
    </Sheet>
  );
}
