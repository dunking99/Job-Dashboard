"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Panel, Button, Tag } from "./ui";
import { BridgeDialog } from "./AiAction";
import { IconArrowRight, IconTrash } from "./icons";
import { buildBridgePromptClient } from "@/lib/bridge";
import { relativeDays } from "@/lib/utils";

// Prompts waiting for a pasted response. Without this, a bridge-mode request
// abandoned mid-flow would be invisible and would keep the pending badge lit
// forever with no way to clear it.

export function BridgeQueue({
  calls,
  onDismiss,
}: {
  calls: {
    id: string;
    kind: string;
    kindLabel: string;
    createdAt: string;
    systemPrompt: string;
    userPrompt: string;
  }[];
  onDismiss: (callId: string) => Promise<{ ok?: boolean }>;
}) {
  const router = useRouter();
  const [, start] = useTransition();
  const [open, setOpen] = useState<string | null>(null);

  const active = calls.find((c) => c.id === open);

  return (
    <>
      <Panel
        title={`Awaiting a pasted response (${calls.length})`}
        subtitle="Requests you started but have not pasted Claude's reply back into yet."
        padded={false}
        className="border-[color-mix(in_srgb,var(--serious)_35%,transparent)]"
      >
        <ul className="divide-y divide-[var(--line)]">
          {calls.map((call) => (
            <li key={call.id} className="hover-row flex items-center gap-2 px-4 py-2.5">
              <div className="min-w-0 flex-1">
                <p className="text-[12.5px]">{call.kindLabel}</p>
                <p className="text-[11px] text-[var(--muted)]">started {relativeDays(call.createdAt)}</p>
              </div>
              <Button size="sm" onClick={() => setOpen(call.id)}>
                Resume <IconArrowRight size={11} />
              </Button>
              <button
                onClick={() =>
                  start(async () => {
                    await onDismiss(call.id);
                    router.refresh();
                  })
                }
                className="grid size-6 place-items-center rounded text-[var(--muted)] hover:text-[var(--critical)]"
                title="Discard"
              >
                <IconTrash size={11} />
              </button>
            </li>
          ))}
        </ul>
      </Panel>

      {active && (
        <BridgeDialog
          callId={active.id}
          prompt={buildBridgePromptClient(active.systemPrompt, active.userPrompt)}
          title={active.kindLabel}
          onClose={() => setOpen(null)}
          onApplied={() => {
            setOpen(null);
            router.refresh();
          }}
        />
      )}
    </>
  );
}
