"use client";

import { useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { PAU_FACULTIES } from "@/lib/pau";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

import { addMember } from "./actions";

const selectClass =
  "h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm outline-none focus-visible:border-ring";

const EMPTY = {
  firstName: "",
  lastName: "",
  email: "",
  dateOfBirth: "",
  graduationYear: "",
  faculty: "",
  role: "member" as "member" | "exco",
};

export function AddMemberSheet({
  isSuperAdmin,
  children,
}: {
  isSuperAdmin: boolean;
  children: ReactNode;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [pending, startTransition] = useTransition();

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function submit() {
    startTransition(async () => {
      const res = await addMember(form);
      if (res.ok) {
        toast.success(
          res.sent
            ? "Invitation sent"
            : "Member added (invite email not sent — check email settings)",
        );
        setForm(EMPTY);
        setOpen(false);
        router.refresh();
      } else {
        toast.error(res.error ?? "Could not add member");
      }
    });
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>{children}</SheetTrigger>
      <SheetContent className="flex w-full flex-col gap-0 overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Add member</SheetTitle>
          <SheetDescription>
            Creates a 30-day invitation. They set up their own profile on first
            sign-in.
          </SheetDescription>
        </SheetHeader>

        <form
          className="flex flex-1 flex-col gap-4 p-4"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="am-first">First name</Label>
              <Input
                id="am-first"
                value={form.firstName}
                onChange={(e) => set("firstName", e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="am-last">Last name</Label>
              <Input
                id="am-last"
                value={form.lastName}
                onChange={(e) => set("lastName", e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="am-email">Email</Label>
            <Input
              id="am-email"
              type="email"
              value={form.email}
              onChange={(e) => set("email", e.target.value)}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="am-dob">Birthday</Label>
              <Input
                id="am-dob"
                type="date"
                value={form.dateOfBirth}
                onChange={(e) => set("dateOfBirth", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="am-year">Graduating year</Label>
              <Input
                id="am-year"
                type="number"
                min={1990}
                max={2100}
                value={form.graduationYear}
                onChange={(e) => set("graduationYear", e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="am-faculty">Faculty</Label>
            <select
              id="am-faculty"
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

          <div className="space-y-1.5">
            <Label htmlFor="am-role">Role</Label>
            <select
              id="am-role"
              value={form.role}
              onChange={(e) => set("role", e.target.value as "member" | "exco")}
              className={selectClass}
            >
              <option value="member">Member</option>
              {isSuperAdmin ? <option value="exco">Exco</option> : null}
            </select>
          </div>

          <SheetFooter className="mt-auto flex-row justify-end gap-2 px-0">
            <SheetClose asChild>
              <Button type="button" variant="ghost">
                Cancel
              </Button>
            </SheetClose>
            <Button type="submit" disabled={pending}>
              {pending ? "Adding..." : "Add member"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
