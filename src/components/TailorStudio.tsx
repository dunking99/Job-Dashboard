"use client";

import { useState, useTransition, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Panel, Button, Badge, Tag, ScoreChip, EmptyState, Dot, buttonClass } from "./ui";
import { BridgeDialog, type AiActionResult } from "./AiAction";
import { Modal } from "./Modal";
import {
  IconPlus, IconSparkle, IconTrash, IconCopy, IconCheck, IconFile,
  IconDownload, IconAlert, IconArrowRight,
} from "./icons";
import {
  renderCvText, renderCvMarkdown, renderCoverLetterText, sectionForCategory,
  cvHeadlineFor, SECTION_HEADINGS,
  type CvStructure, type CvSection, type CoverLetterStructure,
} from "@/lib/cv";
import type { ExtractedSkill } from "@/lib/text";
import type { AtsIssue, KeywordCoverage } from "@/lib/ats";
import { cn, wordCount } from "@/lib/utils";

interface DocumentView {
  id: string;
  kind: "CV" | "COVER_LETTER";
  label: string;
  isFinal: boolean;
  atsScore: number | null;
  structure: CvStructure | CoverLetterStructure;
  coverage: KeywordCoverage;
  issues: AtsIssue[];
  updatedAt: string;
}

interface RankedAtom {
  id: string;
  title: string;
  organisation: string;
  role: string;
  category: string;
  dates: string;
  location: string;
  metric: string;
  summary: string;
  relevance: number;
  reasons: string[];
  bullets: { id: string; text: string; register: string; isPrimary: boolean }[];
}

export function TailorStudio({
  jobId,
  jobTitle,
  companyName,
  jdText,
  extractedSkills,
  positioningAngle,
  riskNotes,
  documents,
  rankedAtoms,
  actions,
}: {
  jobId: string;
  jobTitle: string;
  companyName: string;
  jdText: string;
  extractedSkills: ExtractedSkill[];
  positioningAngle: string;
  riskNotes: string;
  documents: DocumentView[];
  rankedAtoms: RankedAtom[];
  actions: {
    newCv: () => Promise<{ ok?: boolean; documentId?: string; error?: string }>;
    newLetter: () => Promise<{ ok?: boolean; documentId?: string; error?: string }>;
    aiTailor: (documentId: string) => Promise<AiActionResult>;
    aiLetter: (documentId: string) => Promise<AiActionResult>;
    save: (
      documentId: string,
      structure: unknown,
      kind: "CV" | "COVER_LETTER"
    ) => Promise<{ ok?: boolean; error?: string; atsScore?: number; coverage?: KeywordCoverage; issues?: AtsIssue[] }>;
    remove: (documentId: string) => Promise<{ ok?: boolean }>;
    finalise: (documentId: string) => Promise<{ ok?: boolean; error?: string }>;
  };
}) {
  const router = useRouter();
  const [, start] = useTransition();
  const [activeId, setActiveId] = useState<string | null>(documents[0]?.id ?? null);
  const [bridge, setBridge] = useState<{ callId: string; prompt: string; title: string } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [showJd, setShowJd] = useState(false);
  const [pickerFor, setPickerFor] = useState<string | null>(null);
  const [exportOpen, setExportOpen] = useState(false);

  const active = documents.find((d) => d.id === activeId) ?? null;

  // Local editable copy. Re-seeded whenever the server sends a new version of
  // this document, so an AI pass or a save is reflected without losing focus.
  const [draft, setDraft] = useState<CvStructure | CoverLetterStructure | null>(active?.structure ?? null);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    setDraft(active?.structure ?? null);
    setDirty(false);
  }, [active?.id, active?.updatedAt]);

  const cvs = documents.filter((d) => d.kind === "CV");
  const letters = documents.filter((d) => d.kind === "COVER_LETTER");

  function runAi(fn: () => Promise<AiActionResult>, title: string, key: string) {
    setBusy(key);
    start(async () => {
      const result = await fn();
      setBusy(null);
      if (result?.mode === "BRIDGE" && result.bridgePrompt && result.callId) {
        setBridge({ callId: result.callId, prompt: result.bridgePrompt, title });
        return;
      }
      router.refresh();
    });
  }

  function create(fn: () => Promise<{ documentId?: string }>, key: string) {
    setBusy(key);
    start(async () => {
      const result = await fn();
      setBusy(null);
      if (result?.documentId) setActiveId(result.documentId);
      router.refresh();
    });
  }

  function persist() {
    if (!active || !draft) return;
    setBusy("save");
    start(async () => {
      await actions.save(active.id, draft, active.kind);
      setBusy(null);
      setDirty(false);
      router.refresh();
    });
  }

  return (
    <>
      {/* Document tabs */}
      <div className="mb-4 flex flex-wrap items-center gap-2 border-b border-[var(--line)] pb-3">
        {documents.map((doc) => (
          <button
            key={doc.id}
            onClick={() => setActiveId(doc.id)}
            className={cn(
              "flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-[12px] transition-colors",
              doc.id === activeId
                ? "border-[var(--accent)] bg-[var(--accent-soft)] font-medium"
                : "border-[var(--line)] text-[var(--ink-2)] hover:border-[var(--line-strong)]"
            )}
          >
            <IconFile size={12} />
            {doc.label}
            {doc.isFinal && <Dot tone="good" />}
            {doc.kind === "CV" && doc.atsScore !== null && (
              <span className="tnum text-[10px] text-[var(--muted)]">{doc.atsScore}</span>
            )}
          </button>
        ))}

        <div className="ml-auto flex items-center gap-2">
          <Button size="sm" onClick={() => create(actions.newCv, "newcv")} disabled={busy === "newcv"}>
            <IconPlus size={12} /> {busy === "newcv" ? "Composing…" : cvs.length ? "New CV" : "Compose CV"}
          </Button>
          <Button size="sm" onClick={() => create(actions.newLetter, "newletter")} disabled={busy === "newletter"}>
            <IconPlus size={12} /> New letter
          </Button>
          <Button size="sm" onClick={() => setShowJd(true)}>
            View JD
          </Button>
        </div>
      </div>

      {!active || !draft ? (
        <Panel>
          <EmptyState
            icon={<IconFile size={28} />}
            title="No draft yet"
            detail="Composing a CV ranks every entry in your bank against this posting and assembles the strongest ones. That happens with no AI involved — the AI pass afterwards only improves phrasing and ordering."
            action={
              <Button variant="primary" onClick={() => create(actions.newCv, "newcv")} disabled={busy === "newcv"}>
                {busy === "newcv" ? "Composing…" : "Compose a CV from the bank"}
              </Button>
            }
          />
        </Panel>
      ) : active.kind === "CV" ? (
        <CvWorkspace
          doc={active}
          draft={draft as CvStructure}
          setDraft={(next) => {
            setDraft(next);
            setDirty(true);
          }}
          rankedAtoms={rankedAtoms}
          extractedSkills={extractedSkills}
          positioningAngle={positioningAngle}
          riskNotes={riskNotes}
          dirty={dirty}
          busy={busy}
          onSave={persist}
          onAi={() => runAi(() => actions.aiTailor(active.id), "Tailor this CV", "ai")}
          onFinalise={() =>
            start(async () => {
              await actions.finalise(active.id);
              router.refresh();
            })
          }
          onDelete={() =>
            start(async () => {
              if (!window.confirm(`Delete ${active.label}?`)) return;
              await actions.remove(active.id);
              setActiveId(null);
              router.refresh();
            })
          }
          onExport={() => setExportOpen(true)}
          pickerFor={pickerFor}
          setPickerFor={setPickerFor}
        />
      ) : (
        <LetterWorkspace
          doc={active}
          draft={draft as CoverLetterStructure}
          setDraft={(next) => {
            setDraft(next);
            setDirty(true);
          }}
          jobTitle={jobTitle}
          companyName={companyName}
          positioningAngle={positioningAngle}
          dirty={dirty}
          busy={busy}
          onSave={persist}
          onAi={() => runAi(() => actions.aiLetter(active.id), "Draft this cover letter", "ai")}
          onDelete={() =>
            start(async () => {
              if (!window.confirm(`Delete ${active.label}?`)) return;
              await actions.remove(active.id);
              setActiveId(null);
              router.refresh();
            })
          }
          onExport={() => setExportOpen(true)}
        />
      )}

      {/* JD reference */}
      <Modal open={showJd} onClose={() => setShowJd(false)} title="Job description" width="lg">
        <pre className="text-[12px] leading-relaxed whitespace-pre-wrap">{jdText}</pre>
      </Modal>

      {/* Export */}
      {active && draft && (
        <ExportDialog
          open={exportOpen}
          onClose={() => setExportOpen(false)}
          documentId={active.id}
          label={active.label}
          text={
            active.kind === "CV"
              ? renderCvText(draft as CvStructure)
              : renderCoverLetterText(draft as CoverLetterStructure)
          }
          markdown={active.kind === "CV" ? renderCvMarkdown(draft as CvStructure) : undefined}
        />
      )}

      {bridge && (
        <BridgeDialog
          callId={bridge.callId}
          prompt={bridge.prompt}
          title={bridge.title}
          onClose={() => setBridge(null)}
          onApplied={() => {
            setBridge(null);
            router.refresh();
          }}
        />
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// CV workspace
// ---------------------------------------------------------------------------

function CvWorkspace({
  doc, draft, setDraft, rankedAtoms, extractedSkills, positioningAngle, riskNotes,
  dirty, busy, onSave, onAi, onFinalise, onDelete, onExport, pickerFor, setPickerFor,
}: {
  doc: DocumentView;
  draft: CvStructure;
  setDraft: (next: CvStructure) => void;
  rankedAtoms: RankedAtom[];
  extractedSkills: ExtractedSkill[];
  positioningAngle: string;
  riskNotes: string;
  dirty: boolean;
  busy: string | null;
  onSave: () => void;
  onAi: () => void;
  onFinalise: () => void;
  onDelete: () => void;
  onExport: () => void;
  pickerFor: string | null;
  setPickerFor: (v: string | null) => void;
}) {
  const usedAtomIds = useMemo(() => {
    const ids = new Set<string>();
    for (const section of draft.sections) {
      for (const item of section.items) if (item.atomId) ids.add(item.atomId);
    }
    return ids;
  }, [draft]);

  const liveText = renderCvText(draft);
  const words = wordCount(liveText);

  function mutate(fn: (next: CvStructure) => void) {
    const next: CvStructure = JSON.parse(JSON.stringify(draft));
    fn(next);
    setDraft(next);
  }

  function addAtom(atom: RankedAtom) {
    mutate((next) => {
      const kind = sectionForCategory(atom.category);
      let section = next.sections.find((s) => s.kind === kind);
      if (!section) {
        section = { id: kind.toLowerCase(), kind, heading: SECTION_HEADINGS[kind], items: [] };
        next.sections.push(section);
      }
      const primary = atom.bullets.find((b) => b.register === "CV" && b.isPrimary)
        ?? atom.bullets.find((b) => b.register === "CV")
        ?? atom.bullets[0];
      section.items.push({
        id: atom.id,
        atomId: atom.id,
        headline: cvHeadlineFor(atom),
        subheadline: atom.organisation,
        dates: atom.dates,
        location: atom.location,
        bullets: [{ text: primary?.text ?? atom.summary, atomId: atom.id }],
      });
    });
    setPickerFor(null);
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[260px_1fr_300px]">
      {/* Atom picker */}
      <div className="flex flex-col gap-4">
        <Panel
          title="Your bank, ranked"
          subtitle="Ordered by relevance to this posting."
          padded={false}
          className="xl:sticky xl:top-4"
        >
          <ul className="max-h-[560px] divide-y divide-[var(--line)] overflow-y-auto">
            {rankedAtoms.map((atom) => {
              const used = usedAtomIds.has(atom.id);
              return (
                <li key={atom.id} className={cn("px-3 py-2.5", used && "opacity-45")}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-[12px] font-medium leading-snug">{atom.title}</p>
                      <p className="mt-0.5 text-[10.5px] text-[var(--muted)]">
                        {[atom.organisation, atom.dates].filter(Boolean).join(" · ")}
                      </p>
                    </div>
                    <button
                      onClick={() => addAtom(atom)}
                      disabled={used}
                      className="mt-0.5 grid size-5 shrink-0 place-items-center rounded border border-[var(--line-strong)] text-[var(--muted)] transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)] disabled:cursor-not-allowed"
                      title={used ? "Already on this CV" : "Add to CV"}
                    >
                      {used ? <IconCheck size={10} /> : <IconPlus size={10} />}
                    </button>
                  </div>
                  {atom.reasons.length > 0 && (
                    <p className="mt-1 text-[10px] leading-snug text-[var(--muted)]">
                      {atom.reasons.slice(0, 2).join(" · ")}
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        </Panel>
      </div>

      {/* CV editor */}
      <div className="flex flex-col gap-4">
        <Panel
          title={doc.label}
          subtitle={`${words} words · ${liveText.split("\n").filter((l) => l.startsWith("- ")).length} bullets`}
          action={
            <div className="flex items-center gap-1.5">
              <Button size="sm" onClick={onAi} disabled={busy === "ai"}>
                <IconSparkle size={12} className={busy === "ai" ? "pulse-soft" : undefined} />
                {busy === "ai" ? "Tailoring…" : "AI tailor"}
              </Button>
              <Button size="sm" onClick={onExport}>
                <IconDownload size={12} /> Export
              </Button>
            </div>
          }
        >
          {/* Header */}
          <div className="mb-4 border-b border-[var(--line)] pb-3">
            <input
              value={draft.header.fullName}
              onChange={(e) => mutate((n) => { n.header.fullName = e.target.value; })}
              placeholder="Your name"
              className="w-full border-0 bg-transparent p-0 text-[17px] font-semibold outline-none"
            />
            <input
              value={draft.header.headline}
              onChange={(e) => mutate((n) => { n.header.headline = e.target.value; })}
              placeholder="Headline"
              className="mt-0.5 w-full border-0 bg-transparent p-0 text-[12px] text-[var(--ink-2)] outline-none"
            />
            <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-[var(--muted)]">
              {(["email", "phone", "location", "linkedIn"] as const).map((field) => (
                <input
                  key={field}
                  value={draft.header[field]}
                  onChange={(e) => mutate((n) => { n.header[field] = e.target.value; })}
                  placeholder={field}
                  className="border-0 bg-transparent p-0 outline-none"
                  size={Math.max(8, draft.header[field].length || 8)}
                />
              ))}
            </div>
          </div>

          {/* Sections */}
          <div className="flex flex-col gap-5">
            {draft.sections.map((section, sIndex) => (
              <SectionEditor
                key={section.id}
                section={section}
                onChange={(next) => mutate((n) => { n.sections[sIndex] = next; })}
                onRemoveItem={(itemIndex) =>
                  mutate((n) => { n.sections[sIndex].items.splice(itemIndex, 1); })
                }
                onMoveItem={(itemIndex, direction) =>
                  mutate((n) => {
                    const items = n.sections[sIndex].items;
                    const target = itemIndex + direction;
                    if (target < 0 || target >= items.length) return;
                    [items[itemIndex], items[target]] = [items[target], items[itemIndex]];
                  })
                }
              />
            ))}
          </div>
        </Panel>
      </div>

      {/* ATS panel */}
      <div className="flex flex-col gap-4">
        <div className="xl:sticky xl:top-4 flex flex-col gap-4">
          <Panel title="ATS check" subtitle="Recomputed every time you save.">
            <div className="mb-3 flex items-center gap-3">
              <ScoreChip score={doc.atsScore} />
              <div className="min-w-0">
                <p className="text-[12px] font-medium">
                  {doc.coverage.percentage}% keyword coverage
                </p>
                <p className="text-[11px] text-[var(--muted)]">
                  {doc.coverage.matched.length} of{" "}
                  {doc.coverage.matched.length + doc.coverage.missing.length} named skills present
                </p>
              </div>
            </div>

            {doc.coverage.missingRequired.length > 0 && (
              <div className="mb-3">
                <p className="mb-1 text-[10px] uppercase tracking-wide" style={{ color: "var(--critical)" }}>
                  Essential, not mentioned
                </p>
                <div className="flex flex-wrap gap-1">
                  {doc.coverage.missingRequired.map((k) => (
                    <Badge key={k} tone="critical">{k}</Badge>
                  ))}
                </div>
              </div>
            )}

            {doc.coverage.missing.length > 0 && (
              <div className="mb-3">
                <p className="mb-1 text-[10px] uppercase tracking-wide text-[var(--muted)]">Not mentioned</p>
                <div className="flex flex-wrap gap-1">
                  {doc.coverage.missing
                    .filter((k) => !doc.coverage.missingRequired.includes(k))
                    .slice(0, 12)
                    .map((k) => (
                      <Tag key={k}>{k}</Tag>
                    ))}
                </div>
              </div>
            )}

            {doc.issues.length > 0 ? (
              <ul className="flex flex-col gap-2 border-t border-[var(--line)] pt-3">
                {doc.issues.map((issue, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <Dot tone={issue.severity} className="mt-1.5" />
                    <div>
                      <p className="text-[11.5px] font-medium leading-snug">{issue.label}</p>
                      <p className="mt-0.5 text-[11px] leading-snug text-[var(--muted)]">{issue.hint}</p>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="flex items-center gap-1.5 border-t border-[var(--line)] pt-3 text-[12px]">
                <IconCheck size={13} style={{ color: "var(--good)" }} /> No structural issues found.
              </p>
            )}
          </Panel>

          {(positioningAngle || riskNotes) && (
            <Panel title="Keep in mind">
              {positioningAngle && (
                <p className="text-[12px] leading-relaxed">{positioningAngle}</p>
              )}
              {riskNotes && (
                <p className="mt-2 border-t border-[var(--line)] pt-2 text-[11.5px] leading-relaxed text-[var(--ink-2)]">
                  {riskNotes}
                </p>
              )}
            </Panel>
          )}

          <div className="flex flex-col gap-2">
            <Button
              variant="primary"
              onClick={onSave}
              disabled={!dirty || busy === "save"}
              className="w-full justify-center"
            >
              {busy === "save" ? "Saving…" : dirty ? "Save and rescan" : "Saved"}
            </Button>
            <div className="flex gap-2">
              <Button size="sm" onClick={onFinalise} className="flex-1 justify-center">
                {doc.isFinal ? "Marked final" : "Mark final"}
              </Button>
              <Button size="sm" variant="danger" onClick={onDelete}>
                <IconTrash size={12} />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function SectionEditor({
  section,
  onChange,
  onRemoveItem,
  onMoveItem,
}: {
  section: CvSection;
  onChange: (next: CvSection) => void;
  onRemoveItem: (index: number) => void;
  onMoveItem: (index: number, direction: number) => void;
}) {
  const hasContent = section.items.length > 0 || section.body?.trim();
  if (!hasContent && section.kind !== "PROFILE" && section.kind !== "SKILLS") return null;

  return (
    <section>
      <h3 className="mb-2 border-b border-[var(--line)] pb-1 text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)]">
        {section.heading}
      </h3>

      {(section.kind === "PROFILE" || section.kind === "SKILLS") && (
        <textarea
          value={section.body ?? ""}
          onChange={(e) => onChange({ ...section, body: e.target.value })}
          rows={section.kind === "PROFILE" ? 3 : 2}
          placeholder={
            section.kind === "PROFILE"
              ? "A short profile paragraph tailored to this role…"
              : "Skills, separated by ·"
          }
          className="w-full resize-none rounded border border-transparent bg-transparent px-1 py-0.5 text-[12.5px] leading-relaxed outline-none hover:border-[var(--line)] focus:border-[var(--accent)]"
        />
      )}

      <div className="flex flex-col gap-3">
        {section.items.map((item, index) => (
          <div key={`${item.id}-${index}`} className="group">
            <div className="flex items-baseline justify-between gap-2">
              <div className="flex min-w-0 flex-1 items-baseline gap-1.5">
                <input
                  value={item.headline}
                  onChange={(e) => {
                    const items = [...section.items];
                    items[index] = { ...item, headline: e.target.value };
                    onChange({ ...section, items });
                  }}
                  className="min-w-0 border-0 bg-transparent p-0 text-[12.5px] font-medium outline-none"
                  size={Math.max(10, item.headline.length)}
                />
                {item.subheadline && (
                  <input
                    value={item.subheadline}
                    onChange={(e) => {
                      const items = [...section.items];
                      items[index] = { ...item, subheadline: e.target.value };
                      onChange({ ...section, items });
                    }}
                    className="min-w-0 border-0 bg-transparent p-0 text-[12px] text-[var(--ink-2)] outline-none"
                    size={Math.max(8, item.subheadline.length)}
                  />
                )}
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <span className="text-[11px] text-[var(--muted)]">{item.dates}</span>
                <div className="flex opacity-0 transition-opacity group-hover:opacity-100">
                  <button
                    onClick={() => onMoveItem(index, -1)}
                    className="grid size-5 place-items-center rounded text-[var(--muted)] hover:text-[var(--ink)]"
                    title="Move up"
                  >
                    ↑
                  </button>
                  <button
                    onClick={() => onMoveItem(index, 1)}
                    className="grid size-5 place-items-center rounded text-[var(--muted)] hover:text-[var(--ink)]"
                    title="Move down"
                  >
                    ↓
                  </button>
                  <button
                    onClick={() => onRemoveItem(index)}
                    className="grid size-5 place-items-center rounded text-[var(--muted)] hover:text-[var(--critical)]"
                    title="Remove"
                  >
                    <IconTrash size={11} />
                  </button>
                </div>
              </div>
            </div>

            <ul className="mt-1 flex flex-col gap-1">
              {item.bullets.map((bullet, bIndex) => (
                <li key={bIndex} className="group/bullet flex items-start gap-1.5">
                  <span className="mt-[7px] block size-1 shrink-0 rounded-full bg-[var(--muted)]" />
                  <div className="min-w-0 flex-1">
                    <textarea
                      value={bullet.text}
                      onChange={(e) => {
                        const items = [...section.items];
                        const bullets = [...item.bullets];
                        bullets[bIndex] = { ...bullet, text: e.target.value };
                        items[index] = { ...item, bullets };
                        onChange({ ...section, items });
                      }}
                      rows={Math.max(1, Math.ceil(bullet.text.length / 90))}
                      className="w-full resize-none rounded border border-transparent bg-transparent px-1 py-0.5 text-[12.5px] leading-snug outline-none hover:border-[var(--line)] focus:border-[var(--accent)]"
                    />
                    {bullet.answersRequirement && (
                      <p className="px-1 text-[10px] text-[var(--muted)]">
                        <IconArrowRight size={9} className="inline" /> answers: {bullet.answersRequirement}
                      </p>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-1 pt-1 opacity-0 transition-opacity group-hover/bullet:opacity-100">
                    <span className="text-[10px] text-[var(--muted)]">{wordCount(bullet.text)}w</span>
                    <button
                      onClick={() => {
                        const items = [...section.items];
                        const bullets = item.bullets.filter((_, i) => i !== bIndex);
                        items[index] = { ...item, bullets };
                        onChange({ ...section, items });
                      }}
                      className="grid size-4 place-items-center rounded text-[var(--muted)] hover:text-[var(--critical)]"
                    >
                      <IconTrash size={10} />
                    </button>
                  </div>
                </li>
              ))}
              <li>
                <button
                  onClick={() => {
                    const items = [...section.items];
                    items[index] = {
                      ...item,
                      bullets: [...item.bullets, { text: "", atomId: item.atomId }],
                    };
                    onChange({ ...section, items });
                  }}
                  className="ml-3 text-[10.5px] text-[var(--muted)] opacity-0 transition-opacity hover:text-[var(--ink)] group-hover:opacity-100"
                >
                  + bullet
                </button>
              </li>
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Cover letter workspace
// ---------------------------------------------------------------------------

function LetterWorkspace({
  doc, draft, setDraft, jobTitle, companyName, positioningAngle,
  dirty, busy, onSave, onAi, onDelete, onExport,
}: {
  doc: DocumentView;
  draft: CoverLetterStructure;
  setDraft: (next: CoverLetterStructure) => void;
  jobTitle: string;
  companyName: string;
  positioningAngle: string;
  dirty: boolean;
  busy: string | null;
  onSave: () => void;
  onAi: () => void;
  onDelete: () => void;
  onExport: () => void;
}) {
  const words = draft.paragraphs.reduce((sum, p) => sum + wordCount(p), 0);

  function mutate(fn: (next: CoverLetterStructure) => void) {
    const next: CoverLetterStructure = JSON.parse(JSON.stringify(draft));
    fn(next);
    setDraft(next);
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[1fr_300px]">
      <Panel
        title={doc.label}
        subtitle={`${words} words${words > 450 ? " — long for a cover letter" : ""}`}
        action={
          <div className="flex items-center gap-1.5">
            <Button size="sm" onClick={onAi} disabled={busy === "ai"}>
              <IconSparkle size={12} className={busy === "ai" ? "pulse-soft" : undefined} />
              {busy === "ai" ? "Drafting…" : "AI draft"}
            </Button>
            <Button size="sm" onClick={onExport}>
              <IconDownload size={12} /> Export
            </Button>
          </div>
        }
      >
        <div className="mb-3 grid grid-cols-2 gap-2">
          <input
            value={draft.recipient}
            onChange={(e) => mutate((n) => { n.recipient = e.target.value; })}
            placeholder="Recipient name (if known)"
            className="field text-[12px]"
          />
          <input
            value={draft.subject}
            onChange={(e) => mutate((n) => { n.subject = e.target.value; })}
            placeholder="Subject line"
            className="field text-[12px]"
          />
        </div>

        <input
          value={draft.salutation}
          onChange={(e) => mutate((n) => { n.salutation = e.target.value; })}
          className="mb-3 w-full border-0 bg-transparent p-0 text-[13px] outline-none"
        />

        <div className="flex flex-col gap-3">
          {draft.paragraphs.map((paragraph, i) => (
            <div key={i} className="group flex items-start gap-2">
              <textarea
                value={paragraph}
                onChange={(e) => mutate((n) => { n.paragraphs[i] = e.target.value; })}
                rows={Math.max(3, Math.ceil(paragraph.length / 95))}
                placeholder={
                  i === 0
                    ? "Open with the specific reason for applying to this role at this organisation…"
                    : "…"
                }
                className="flex-1 resize-none rounded border border-transparent bg-transparent px-1 py-0.5 text-[13px] leading-relaxed outline-none hover:border-[var(--line)] focus:border-[var(--accent)]"
              />
              <button
                onClick={() => mutate((n) => { n.paragraphs.splice(i, 1); })}
                className="mt-1 grid size-5 shrink-0 place-items-center rounded text-[var(--muted)] opacity-0 transition-opacity hover:text-[var(--critical)] group-hover:opacity-100"
              >
                <IconTrash size={11} />
              </button>
            </div>
          ))}
          <button
            onClick={() => mutate((n) => { n.paragraphs.push(""); })}
            className="self-start text-[11px] text-[var(--muted)] hover:text-[var(--ink)]"
          >
            + paragraph
          </button>
        </div>

        <div className="mt-4 border-t border-[var(--line)] pt-3">
          <input
            value={draft.signOff}
            onChange={(e) => mutate((n) => { n.signOff = e.target.value; })}
            className="w-full border-0 bg-transparent p-0 text-[13px] outline-none"
          />
          <input
            value={draft.senderName}
            onChange={(e) => mutate((n) => { n.senderName = e.target.value; })}
            placeholder="Your name"
            className="w-full border-0 bg-transparent p-0 text-[13px] outline-none"
          />
        </div>

        {draft.notes && (
          <p className="mt-4 rounded-md border border-[color-mix(in_srgb,var(--warning)_35%,transparent)] bg-[color-mix(in_srgb,var(--warning)_8%,transparent)] p-2.5 text-[11.5px] leading-snug">
            <strong>Before sending:</strong> {draft.notes}
          </p>
        )}
      </Panel>

      <div className="flex flex-col gap-4">
        <Panel title="Target">
          <p className="text-[12px] font-medium">{jobTitle}</p>
          <p className="text-[11px] text-[var(--muted)]">{companyName || "Employer not set"}</p>
          {positioningAngle && (
            <p className="mt-2 border-t border-[var(--line)] pt-2 text-[11.5px] leading-relaxed">
              {positioningAngle}
            </p>
          )}
        </Panel>

        <Panel title="What to avoid">
          <ul className="flex flex-col gap-1.5 text-[11.5px] text-[var(--ink-2)]">
            <li>&ldquo;I am writing to apply for…&rdquo; as an opener</li>
            <li>Praise of the organisation you cannot substantiate</li>
            <li>&ldquo;Passionate about&rdquo;, &ldquo;hit the ground running&rdquo;, &ldquo;team player&rdquo;</li>
            <li>Listing three examples in passing instead of developing one</li>
            <li>Thanking them for their time as the closing line</li>
          </ul>
        </Panel>

        <div className="flex flex-col gap-2">
          <Button variant="primary" onClick={onSave} disabled={!dirty || busy === "save"} className="w-full justify-center">
            {busy === "save" ? "Saving…" : dirty ? "Save" : "Saved"}
          </Button>
          <Button size="sm" variant="danger" onClick={onDelete} className="w-full justify-center">
            <IconTrash size={12} /> Delete draft
          </Button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

function ExportDialog({
  open, onClose, documentId, label, text, markdown,
}: {
  open: boolean;
  onClose: () => void;
  documentId: string;
  label: string;
  text: string;
  markdown?: string;
}) {
  const [copied, setCopied] = useState<string | null>(null);

  async function copy(what: string, value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(what);
      window.setTimeout(() => setCopied(null), 2000);
    } catch {
      setCopied("failed");
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Export ${label}`}
      subtitle="Plain text is the ATS-safe format — single column, standard headings, contact details in the body."
      width="md"
      footer={<Button onClick={onClose}>Close</Button>}
    >
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap gap-2">
          <button onClick={() => copy("text", text)} className={buttonClass("default", "sm")}>
            {copied === "text" ? <IconCheck size={12} style={{ color: "var(--good)" }} /> : <IconCopy size={12} />}
            Copy plain text
          </button>
          {markdown && (
            <button onClick={() => copy("md", markdown)} className={buttonClass("default", "sm")}>
              {copied === "md" ? <IconCheck size={12} style={{ color: "var(--good)" }} /> : <IconCopy size={12} />}
              Copy Markdown
            </button>
          )}
          <a href={`/api/export/${documentId}?format=docx`} className={buttonClass("default", "sm")} download>
            <IconDownload size={12} /> .docx
          </a>
          <a href={`/api/export/${documentId}?format=txt`} className={buttonClass("default", "sm")} download>
            <IconDownload size={12} /> .txt
          </a>
          <a href={`/print/${documentId}`} target="_blank" rel="noopener noreferrer" className={buttonClass("default", "sm")}>
            <IconFile size={12} /> Print / PDF
          </a>
        </div>

        {copied === "failed" && (
          <p className="flex items-center gap-1 text-[11px]" style={{ color: "var(--critical)" }}>
            <IconAlert size={12} /> Clipboard blocked — select the text below and copy manually.
          </p>
        )}

        <pre className="max-h-72 overflow-auto rounded-md border border-[var(--line)] bg-[var(--surface)] p-3 text-[11px] leading-relaxed whitespace-pre-wrap">
          {text}
        </pre>
      </div>
    </Modal>
  );
}
