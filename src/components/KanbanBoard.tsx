"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ScoreChip, Badge, Dot } from "./ui";
import { IconAlert, IconFile, IconMic } from "./icons";
import { cn, relativeDays, truncate } from "@/lib/utils";

// Native HTML5 drag and drop rather than a library: this is a desktop tool,
// the interaction is a simple card-to-column move, and a drag-drop dependency
// is a lot of weight for that.

export interface KanbanCard {
  id: string;
  title: string;
  companyName: string;
  status: string;
  matchScore: number | null;
  deadline: string | null;
  idleDays: number;
  documents: number;
  interviews: number;
  redFlags: number;
  priority: number;
}

export function KanbanBoard({
  stages,
  cards,
  onMove,
  compact = false,
}: {
  stages: { key: string; label: string }[];
  cards: KanbanCard[];
  onMove: (jobId: string, status: string) => Promise<{ ok?: boolean; error?: string }>;
  compact?: boolean;
}) {
  const router = useRouter();
  const [, start] = useTransition();
  const [dragging, setDragging] = useState<string | null>(null);
  const [over, setOver] = useState<string | null>(null);
  // Optimistic placement so the card lands immediately rather than after the
  // round trip — a kanban that lags on drop feels broken.
  const [moved, setMoved] = useState<Record<string, string>>({});

  function statusOf(card: KanbanCard) {
    return moved[card.id] ?? card.status;
  }

  function drop(stageKey: string) {
    if (!dragging) return;
    const card = cards.find((c) => c.id === dragging);
    setOver(null);
    setDragging(null);
    if (!card || statusOf(card) === stageKey) return;

    setMoved((prev) => ({ ...prev, [card.id]: stageKey }));
    start(async () => {
      await onMove(card.id, stageKey);
      router.refresh();
    });
  }

  return (
    <div className="flex gap-3 overflow-x-auto pb-2">
      {stages.map((stage) => {
        const stageCards = cards.filter((c) => statusOf(c) === stage.key);
        return (
          <div
            key={stage.key}
            onDragOver={(e) => {
              e.preventDefault();
              setOver(stage.key);
            }}
            onDragLeave={() => setOver((v) => (v === stage.key ? null : v))}
            onDrop={() => drop(stage.key)}
            className={cn(
              "flex w-[248px] shrink-0 flex-col rounded-lg border transition-colors",
              over === stage.key
                ? "border-[var(--accent)] bg-[var(--accent-soft)]"
                : "border-[var(--line)] bg-[var(--panel)]"
            )}
          >
            <header className="flex items-center justify-between gap-2 border-b border-[var(--line)] px-3 py-2">
              <span className="text-[12px] font-medium">{stage.label}</span>
              <span className="tnum text-[11px] text-[var(--muted)]">{stageCards.length}</span>
            </header>

            <div className={cn("flex flex-col gap-2 p-2", compact ? "min-h-[60px]" : "min-h-[180px]")}>
              {stageCards.map((card) => (
                <article
                  key={card.id}
                  draggable
                  onDragStart={() => setDragging(card.id)}
                  onDragEnd={() => {
                    setDragging(null);
                    setOver(null);
                  }}
                  className={cn(
                    "cursor-grab rounded-md border border-[var(--line)] bg-[var(--surface)] p-2.5 transition-opacity active:cursor-grabbing",
                    dragging === card.id && "opacity-40"
                  )}
                >
                  <div className="flex items-start gap-2">
                    <ScoreChip score={card.matchScore} size="sm" />
                    <div className="min-w-0 flex-1">
                      <Link
                        href={`/jobs/${card.id}`}
                        className="block text-[12px] font-medium leading-snug hover:underline"
                        draggable={false}
                      >
                        {truncate(card.title, 52)}
                      </Link>
                      <p className="mt-0.5 truncate text-[10.5px] text-[var(--muted)]">
                        {card.companyName || "—"}
                      </p>
                    </div>
                  </div>

                  <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[10px] text-[var(--muted)]">
                    {card.deadline && (
                      <span
                        style={{
                          color:
                            new Date(card.deadline).getTime() - Date.now() < 3 * 86400000
                              ? "var(--critical)"
                              : undefined,
                        }}
                      >
                        closes {relativeDays(card.deadline)}
                      </span>
                    )}
                    {card.idleDays >= 10 && ["APPLIED", "SCREENING", "INTERVIEW", "FINAL"].includes(statusOf(card)) && (
                      <span className="flex items-center gap-1">
                        <Dot tone={card.idleDays >= 21 ? "serious" : "warning"} />
                        {card.idleDays}d quiet
                      </span>
                    )}
                    {card.documents > 0 && (
                      <span className="flex items-center gap-0.5">
                        <IconFile size={9} /> {card.documents}
                      </span>
                    )}
                    {card.interviews > 0 && (
                      <span className="flex items-center gap-0.5">
                        <IconMic size={9} /> {card.interviews}
                      </span>
                    )}
                    {card.redFlags > 0 && (
                      <span className="flex items-center gap-0.5" style={{ color: "var(--serious)" }}>
                        <IconAlert size={9} /> {card.redFlags}
                      </span>
                    )}
                  </div>
                </article>
              ))}

              {stageCards.length === 0 && (
                <p className="px-1 py-3 text-center text-[10.5px] text-[var(--muted)]">
                  {over === stage.key ? "Drop here" : "Empty"}
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
