"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { nairaToKobo } from "@/lib/money";

import { pledgeAction } from "./actions";

const CHANNELS: [string, string][] = [
  ["transfer", "Bank transfer"],
  ["cash", "Cash"],
  ["card", "Card"],
  ["other", "Other"],
];

export function PledgeModal({ fundraiserId }: { fundraiserId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [channel, setChannel] = useState("transfer");
  const [note, setNote] = useState("");
  const [anonymous, setAnonymous] = useState(false);
  const [pending, start] = useTransition();

  function submit() {
    const kobo = nairaToKobo(amount);
    if (kobo === null || kobo <= 0) {
      toast.error("Enter a valid amount in naira.");
      return;
    }
    start(async () => {
      const res = await pledgeAction({
        fundraiserId,
        amountKobo: kobo,
        channel,
        note: note.trim() || null,
        anonymous,
      });
      if (res.ok) {
        toast.success("Pledge logged. The treasurer will reach out.");
        setOpen(false);
        setAmount("");
        setNote("");
        setAnonymous(false);
        router.refresh();
      } else {
        toast.error(res.error ?? "Could not log pledge.");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="w-full">Pledge</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Make a pledge</DialogTitle>
          <DialogDescription>
            A pledge is a promise to give. The treasurer will follow up with
            payment details.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="amount">Amount (NGN)</Label>
            <Input
              id="amount"
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="5,000"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="channel">Channel</Label>
            <Select value={channel} onValueChange={setChannel}>
              <SelectTrigger id="channel">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CHANNELS.map(([v, l]) => (
                  <SelectItem key={v} value={v}>
                    {l}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="note">Note (optional)</Label>
            <Textarea
              id="note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
            />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <Switch checked={anonymous} onCheckedChange={setAnonymous} />
            Pledge anonymously
          </label>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={pending}
          >
            Cancel
          </Button>
          <Button onClick={submit} disabled={pending}>
            {pending ? "Logging..." : "Log pledge"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
