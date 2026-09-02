"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Panel, Button } from "./ui";
import { IconRefresh, IconTrash, IconDownload } from "./icons";

export function DangerZone({
  onRescore,
  onClear,
  onClearHistory,
}: {
  onRescore: () => Promise<{ ok?: boolean; count?: number }>;
  onClear: () => Promise<{ ok?: boolean }>;
  onClearHistory: () => Promise<{ ok?: boolean }>;
}) {
  const router = useRouter();
  const [, start] = useTransition();
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  return (
    <Panel title="Maintenance">
      <div className="flex flex-col gap-3">
        <div>
          <Button
            className="w-full justify-center"
            disabled={busy === "rescore"}
            onClick={() => {
              setBusy("rescore");
              start(async () => {
                const result = await onRescore();
                setBusy(null);
                setMessage(`Rescored ${result?.count ?? 0} jobs.`);
                router.refresh();
              });
            }}
          >
            <IconRefresh size={13} /> {busy === "rescore" ? "Rescoring…" : "Rescore every job"}
          </Button>
          <p className="mt-1 text-[11px] leading-snug text-[var(--muted)]">
            Match scores are computed against the bank as it was at capture time. Run this after adding several
            entries so old jobs reflect what you can now evidence.
          </p>
        </div>

        <div>
          <a
            href="/api/backup"
            download
            className="flex w-full items-center justify-center gap-1.5 rounded-md border border-[var(--line-strong)] bg-[var(--panel)] px-3 py-1.5 text-[13px] font-medium hover:bg-[var(--raised)]"
          >
            <IconDownload size={13} /> Export everything as JSON
          </a>
          <p className="mt-1 text-[11px] leading-snug text-[var(--muted)]">
            A complete dump of your data. The database is also just a file — <code className="font-mono">prisma/dev.db</code> — so copying that works as a backup too.
          </p>
        </div>

        <div className="border-t border-[var(--line)] pt-3">
          <Button
            variant="ghost"
            className="w-full justify-center"
            disabled={busy === "history"}
            onClick={() => {
              setBusy("history");
              start(async () => {
                await onClearHistory();
                setBusy(null);
                setMessage("AI call history cleared.");
                router.refresh();
              });
            }}
          >
            Clear AI call history
          </Button>

          <Button
            variant="danger"
            className="mt-2 w-full justify-center"
            disabled={busy === "clear"}
            onClick={() => {
              const confirmed = window.confirm(
                "This deletes every experience entry, job, document, contact and interview permanently. Skills, domains and competencies are kept. This cannot be undone — export first if you are unsure.\n\nContinue?"
              );
              if (!confirmed) return;
              if (!window.confirm("Really delete everything? There is no undo.")) return;

              setBusy("clear");
              start(async () => {
                await onClear();
                setBusy(null);
                setMessage("All content cleared.");
                router.refresh();
              });
            }}
          >
            <IconTrash size={13} /> {busy === "clear" ? "Clearing…" : "Delete all content"}
          </Button>
          <p className="mt-1 text-[11px] leading-snug text-[var(--muted)]">
            Use this to clear the demo dataset before putting your own material in.
          </p>
        </div>

        {message && (
          <p className="rise-in text-[12px]" style={{ color: "var(--good)" }}>
            {message}
          </p>
        )}
      </div>
    </Panel>
  );
}
