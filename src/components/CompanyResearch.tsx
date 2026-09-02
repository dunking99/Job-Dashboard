"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Panel, Button, Labelled } from "./ui";
import { BridgeDialog, type AiActionResult } from "./AiAction";
import { IconSparkle, IconAlert } from "./icons";
import { relativeDays } from "@/lib/utils";

export function CompanyResearch({
  companyName,
  researchedAt,
  action,
  mode,
}: {
  companyName: string;
  researchedAt: string | null;
  action: (pastedMaterial: string) => Promise<AiActionResult>;
  mode: "API" | "BRIDGE";
}) {
  const router = useRouter();
  const [material, setMaterial] = useState("");
  const [pending, start] = useTransition();
  const [bridge, setBridge] = useState<{ callId: string; prompt: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  function run() {
    setError(null);
    start(async () => {
      const result = await action(material);
      if (result?.error) {
        setError(result.error);
        return;
      }
      if (result?.mode === "BRIDGE" && result.bridgePrompt && result.callId) {
        setBridge({ callId: result.callId, prompt: result.bridgePrompt });
        return;
      }
      setMaterial("");
      router.refresh();
    });
  }

  return (
    <>
      <Panel
        title="Generate a dossier"
        subtitle={
          researchedAt
            ? `Last generated ${relativeDays(researchedAt)}. Running it again overwrites the dossier fields below.`
            : "Fills in what this organisation does, its priorities, a specific 'why here' answer, and questions worth asking."
        }
      >
        <Labelled
          label="Paste anything you have (optional)"
          hint="Their about page, a recent report, a news article, the JD's organisational blurb. Pasted material is treated as fact; anything else comes from the model's own knowledge and is flagged as uncertain."
        >
          <textarea
            value={material}
            onChange={(e) => setMaterial(e.target.value)}
            rows={7}
            placeholder={`Paste source material about ${companyName}…`}
            className="field text-[12px] leading-relaxed"
          />
        </Labelled>

        <div className="mt-3 flex items-center justify-between gap-3">
          <p className="text-[11px] text-[var(--muted)]">
            {mode === "API" ? "Runs in one click." : "Produces a prompt to paste into Claude."} No live web access —
            it will say so where its knowledge may be stale.
          </p>
          <Button variant="primary" onClick={run} disabled={pending}>
            <IconSparkle size={14} className={pending ? "pulse-soft" : undefined} />
            {pending ? "Researching…" : researchedAt ? "Regenerate" : "Generate dossier"}
          </Button>
        </div>

        {error && (
          <p className="mt-2 flex items-center gap-1.5 text-[12px]" style={{ color: "var(--critical)" }}>
            <IconAlert size={13} /> {error}
          </p>
        )}
      </Panel>

      {bridge && (
        <BridgeDialog
          callId={bridge.callId}
          prompt={bridge.prompt}
          title={`Research ${companyName}`}
          onClose={() => setBridge(null)}
          onApplied={() => {
            setBridge(null);
            setMaterial("");
            router.refresh();
          }}
        />
      )}
    </>
  );
}
