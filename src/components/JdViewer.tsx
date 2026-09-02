"use client";

import { useMemo, useState } from "react";
import { Tag } from "./ui";
import { cn } from "@/lib/utils";
import type { ExtractedSkill } from "@/lib/text";

// Renders the job description with recognised requirements highlighted.
//
// Highlighting is done by splitting on matched spans rather than injecting
// HTML, so the posting text is never interpreted as markup — a pasted job ad is
// untrusted input and must stay inert.

interface Span {
  start: number;
  end: number;
  skill: ExtractedSkill;
}

export function JdViewer({ text, skills }: { text: string; skills: ExtractedSkill[] }) {
  const [expanded, setExpanded] = useState(false);
  const [highlight, setHighlight] = useState(true);

  const segments = useMemo(() => {
    if (!highlight || skills.length === 0) return [{ text, skill: null as ExtractedSkill | null }];

    const lower = text.toLowerCase();
    const spans: Span[] = [];

    for (const skill of skills) {
      const needle = skill.matchedAs;
      if (!needle) continue;
      let from = 0;
      while (from < lower.length) {
        const index = lower.indexOf(needle, from);
        if (index === -1) break;
        // Word boundaries, so "r" inside "research" is not highlighted.
        const before = index === 0 ? " " : lower[index - 1];
        const after = index + needle.length >= lower.length ? " " : lower[index + needle.length];
        if (!/[a-z0-9]/.test(before) && !/[a-z0-9]/.test(after)) {
          spans.push({ start: index, end: index + needle.length, skill });
        }
        from = index + needle.length;
      }
    }

    spans.sort((a, b) => a.start - b.start || b.end - a.end);

    // Drop overlaps — the first (longest at a position) wins.
    const kept: Span[] = [];
    let cursor = 0;
    for (const span of spans) {
      if (span.start < cursor) continue;
      kept.push(span);
      cursor = span.end;
    }

    const out: { text: string; skill: ExtractedSkill | null }[] = [];
    let pos = 0;
    for (const span of kept) {
      if (span.start > pos) out.push({ text: text.slice(pos, span.start), skill: null });
      out.push({ text: text.slice(span.start, span.end), skill: span.skill });
      pos = span.end;
    }
    if (pos < text.length) out.push({ text: text.slice(pos), skill: null });
    return out;
  }, [text, skills, highlight]);

  const essential = skills.filter((s) => s.required);
  const desirable = skills.filter((s) => !s.required);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--line)] px-4 py-2.5">
        <div className="flex flex-wrap items-center gap-1.5">
          {essential.length > 0 && (
            <>
              <span className="text-[10px] uppercase tracking-wide text-[var(--muted)]">Essential</span>
              {essential.slice(0, 8).map((s) => (
                <Tag key={s.name} className="border-[color-mix(in_srgb,var(--accent)_45%,transparent)]">
                  {s.name}
                </Tag>
              ))}
            </>
          )}
          {desirable.length > 0 && (
            <>
              <span className="ml-1 text-[10px] uppercase tracking-wide text-[var(--muted)]">Desirable</span>
              {desirable.slice(0, 6).map((s) => (
                <Tag key={s.name}>{s.name}</Tag>
              ))}
            </>
          )}
          {skills.length === 0 && (
            <span className="text-[11px] text-[var(--muted)]">
              No recognised skills — the posting may be unusually vague, or written in language the lexicon does
              not cover yet.
            </span>
          )}
        </div>

        <label className="flex shrink-0 cursor-pointer items-center gap-1.5 text-[11px] text-[var(--muted)]">
          <input
            type="checkbox"
            checked={highlight}
            onChange={(e) => setHighlight(e.target.checked)}
            className="size-3 accent-[var(--accent)]"
          />
          Highlight
        </label>
      </div>

      <div
        className={cn(
          "overflow-y-auto px-4 py-3 text-[12.5px] leading-relaxed whitespace-pre-wrap",
          expanded ? "max-h-none" : "max-h-[420px]"
        )}
      >
        {segments.map((segment, i) =>
          segment.skill ? (
            <mark
              key={i}
              title={`${segment.skill.name}${segment.skill.required ? " — marked essential" : ""}`}
              className={cn(
                "rounded-[2px] bg-transparent px-0.5",
                segment.skill.required
                  ? "underline decoration-2 underline-offset-2"
                  : ""
              )}
              style={{
                background: segment.skill.required
                  ? "color-mix(in srgb, var(--accent) 20%, transparent)"
                  : "color-mix(in srgb, var(--accent) 9%, transparent)",
                color: "var(--ink)",
                textDecorationColor: "var(--accent)",
              }}
            >
              {segment.text}
            </mark>
          ) : (
            <span key={i}>{segment.text}</span>
          )
        )}
      </div>

      {text.length > 1800 && (
        <button
          onClick={() => setExpanded((v) => !v)}
          className="w-full border-t border-[var(--line)] py-2 text-[11px] text-[var(--muted)] transition-colors hover:bg-[var(--accent-soft)] hover:text-[var(--ink)]"
        >
          {expanded ? "Collapse" : "Show full posting"}
        </button>
      )}
    </div>
  );
}
