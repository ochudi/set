"use client";

import { useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import Papa from "papaparse";
import { Download, FileWarning, Upload } from "lucide-react";
import { toast } from "sonner";

import {
  CSV_TEMPLATE,
  validateImportRow,
  type RowResult,
} from "@/lib/csv-import";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

import { importMembersAction } from "./actions";
import type { ImportSummary } from "@/lib/dal";

type Step = "intro" | "preview" | "summary";

function downloadFile(name: string, content: string, type = "text/csv;charset=utf-8") {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

export function ImportCsvDialog({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>("intro");
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [results, setResults] = useState<RowResult[]>([]);
  const [fileName, setFileName] = useState("");
  const [sendInvites, setSendInvites] = useState(false); // default OFF
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const [pending, startTransition] = useTransition();

  function reset() {
    setStep("intro");
    setRows([]);
    setResults([]);
    setFileName("");
    setSendInvites(false);
    setSummary(null);
  }

  function onFile(file: File) {
    setFileName(file.name);
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h) => h.trim().toLowerCase(),
      complete: (res) => {
        const data = res.data.filter((r) =>
          Object.values(r).some((v) => (v ?? "").trim() !== ""),
        );
        setRows(data);
        setResults(data.map((r, i) => validateImportRow(i, r)));
        setStep("preview");
      },
      error: () => toast.error("Could not read that file. Is it a valid CSV?"),
    });
  }

  const valid = results.filter((r) => r.ok);
  const invalid = results.filter((r): r is Extract<RowResult, { ok: false }> => !r.ok);

  function commit() {
    startTransition(async () => {
      const res = await importMembersAction(rows, sendInvites);
      setSummary(res);
      setStep("summary");
      router.refresh();
    });
  }

  function downloadErrorLog() {
    if (!summary) return;
    const lines = ["email,reason"];
    for (const s of summary.skipped) {
      lines.push(
        [s.email, s.reason]
          .map((v) => (/[",\r\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v))
          .join(","),
      );
    }
    downloadFile("import-errors.csv", lines.join("\r\n"));
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) reset();
      }}
    >
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Import members from CSV</DialogTitle>
          <DialogDescription>
            Bulk-create invitations. Dates must be YYYY-MM-DD; rows with errors
            are skipped and logged.
          </DialogDescription>
        </DialogHeader>

        {step === "intro" ? (
          <div className="space-y-4">
            <ol className="list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
              <li>Download the template and fill it in.</li>
              <li>Upload it here to preview and validate.</li>
              <li>Fix any flagged rows, then import.</li>
              <li>Choose whether to email invites now or later.</li>
            </ol>
            <Button
              variant="outline"
              onClick={() => downloadFile("set-members-template.csv", CSV_TEMPLATE)}
            >
              <Download className="mr-2 size-4" /> Download template
            </Button>
            <div>
              <Label
                htmlFor="csv-file"
                className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed p-6 text-sm text-muted-foreground hover:bg-muted"
              >
                <Upload className="size-4" />
                {fileName || "Choose a CSV file"}
              </Label>
              <input
                id="csv-file"
                type="file"
                accept=".csv,text/csv"
                className="sr-only"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) onFile(f);
                  e.target.value = "";
                }}
              />
            </div>
          </div>
        ) : null}

        {step === "preview" ? (
          <div className="space-y-4">
            <div className="flex gap-4 text-sm">
              <span className="font-medium text-emerald-600 dark:text-emerald-400">
                {valid.length} ready
              </span>
              <span
                className={invalid.length ? "font-medium text-destructive" : "text-muted-foreground"}
              >
                {invalid.length} with errors
              </span>
              <span className="text-muted-foreground">{rows.length} total</span>
            </div>

            {invalid.length > 0 ? (
              <div className="max-h-48 space-y-2 overflow-y-auto rounded-lg border p-3">
                {invalid.map((r) => (
                  <div key={r.index} className="flex items-start gap-2 text-xs">
                    <FileWarning className="mt-0.5 size-3.5 shrink-0 text-destructive" />
                    <span>
                      <span className="font-mono">Row {r.index + 2}</span>{" "}
                      {r.email ? `(${r.email}) ` : ""}
                      <span className="text-destructive">{r.errors.join("; ")}</span>
                    </span>
                  </div>
                ))}
              </div>
            ) : null}

            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={sendInvites}
                onCheckedChange={(v) => setSendInvites(!!v)}
              />
              Send invite emails now
            </label>
            <p className="text-xs text-muted-foreground">
              Leave this off to import quietly and send invites later from the
              members list.
            </p>

            {pending ? (
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                <div className="h-full w-1/2 animate-pulse rounded-full bg-primary" />
              </div>
            ) : null}

            <DialogFooter className="gap-2">
              <Button variant="ghost" onClick={reset} disabled={pending}>
                Back
              </Button>
              <Button onClick={commit} disabled={pending || valid.length === 0}>
                {pending
                  ? "Importing..."
                  : `Import ${valid.length} member${valid.length === 1 ? "" : "s"}`}
              </Button>
            </DialogFooter>
          </div>
        ) : null}

        {step === "summary" && summary ? (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3 text-center">
              <Stat label="Created" value={summary.created} />
              <Stat label="Emailed" value={summary.sent} />
              <Stat label="Skipped" value={summary.skipped.length} />
            </div>
            {summary.skipped.length > 0 ? (
              <Button variant="outline" onClick={downloadErrorLog}>
                <Download className="mr-2 size-4" /> Download error log
              </Button>
            ) : null}
            <DialogFooter>
              <Button
                onClick={() => {
                  setOpen(false);
                  reset();
                }}
              >
                Done
              </Button>
            </DialogFooter>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border p-3">
      <p className="text-xl font-semibold tabular-nums">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}
