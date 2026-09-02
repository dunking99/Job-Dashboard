"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Panel, Button, Badge, Tag, EmptyState, Dot, buttonClass } from "./ui";
import { Modal } from "./Modal";
import { BridgeDialog, type AiActionResult } from "./AiAction";
import { IconSparkle, IconTrash, IconPlus, IconMic, IconCheck, IconAlert } from "./icons";
import { QUESTION_KINDS, QUESTION_KIND_LABELS, type QuestionKind } from "@/lib/constants";
import { cn, wordCount, relativeDays } from "@/lib/utils";

interface AnswerView {
  id: string;
  answerText: string;
  score: number | null;
  analysis: Record<string, unknown>;
  feedback: { strengths?: string[]; problems?: string[]; rewrite?: string; followUp?: string };
  createdAt: string;
}

interface QuestionView {
  id: string;
  text: string;
  kind: string;
  difficulty: number;
  rationale: string;
  competency: string;
  jobId: string | null;
  jobLabel: string;
  suggestedAtomIds: string[];
  answers: AnswerView[];
}

interface AtomView {
  id: string;
  title: string;
  metric: string;
  hasStar: boolean;
  star: { situation: string; task: string; action: string; result: string };
  competencies: string[];
}

export function QuestionBank({
  questions, atoms, jobs, competencies, selectedJobId, mode,
  onGenerate, onPractise, onDelete, onAdd,
}: {
  questions: QuestionView[];
  atoms: AtomView[];
  jobs: { id: string; title: string; companyName: string }[];
  competencies: { id: string; name: string }[];
  selectedJobId: string | null;
  mode: "API" | "BRIDGE";
  onGenerate: (jobId: string, kind: string, count: number) => Promise<AiActionResult>;
  onPractise: (
    questionId: string,
    answer: string,
    withAi: boolean
  ) => Promise<AiActionResult & { structure?: Record<string, unknown> }>;
  onDelete: (questionId: string) => Promise<{ ok?: boolean }>;
  onAdd: (formData: FormData) => Promise<{ ok?: boolean; error?: string }>;
}) {
  const router = useRouter();
  const [, start] = useTransition();
  const [jobFilter, setJobFilter] = useState<string>(selectedJobId ?? "");
  const [kindFilter, setKindFilter] = useState<string>("");
  const [bridge, setBridge] = useState<{ callId: string; prompt: string; title: string } | null>(null);
  const [generating, setGenerating] = useState(false);
  const [practising, setPractising] = useState<QuestionView | null>(null);
  const [adding, setAdding] = useState(false);

  const filtered = questions.filter((q) => {
    if (jobFilter && q.jobId !== jobFilter) return false;
    if (kindFilter && q.kind !== kindFilter) return false;
    return true;
  });

  function generate() {
    if (!jobFilter) return;
    setGenerating(true);
    start(async () => {
      const result = await onGenerate(jobFilter, "SCREENING", 10);
      setGenerating(false);
      if (result?.mode === "BRIDGE" && result.bridgePrompt && result.callId) {
        setBridge({ callId: result.callId, prompt: result.bridgePrompt, title: "Predict interview questions" });
        return;
      }
      router.refresh();
    });
  }

  return (
    <>
      <Panel
        title="Question bank"
        subtitle="Predicted from the posting, mapped to the entries that answer them."
        padded={false}
        action={
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setAdding(true)}
              className="flex items-center gap-1 rounded px-1.5 py-1 text-[11px] text-[var(--muted)] hover:bg-[var(--accent-soft)] hover:text-[var(--ink)]"
            >
              <IconPlus size={12} /> Add
            </button>
            <Button size="sm" onClick={generate} disabled={!jobFilter || generating}>
              <IconSparkle size={12} className={generating ? "pulse-soft" : undefined} />
              {generating ? "Predicting…" : "Predict"}
            </Button>
          </div>
        }
      >
        <div className="flex flex-wrap items-center gap-2 border-b border-[var(--line)] px-4 py-2.5">
          <select value={jobFilter} onChange={(e) => setJobFilter(e.target.value)} className="field w-auto flex-1">
            <option value="">All roles</option>
            {jobs.map((job) => (
              <option key={job.id} value={job.id}>
                {job.title}
                {job.companyName ? ` — ${job.companyName}` : ""}
              </option>
            ))}
          </select>
          <select value={kindFilter} onChange={(e) => setKindFilter(e.target.value)} className="field w-auto">
            <option value="">All types</option>
            {QUESTION_KINDS.map((k) => (
              <option key={k} value={k}>
                {QUESTION_KIND_LABELS[k as QuestionKind]}
              </option>
            ))}
          </select>
        </div>

        {filtered.length === 0 ? (
          <EmptyState
            icon={<IconMic size={26} />}
            title={questions.length === 0 ? "No questions yet" : "Nothing matches those filters"}
            detail={
              questions.length === 0
                ? "Pick a role above and predict the questions it will actually ask. Each one is mapped to the entries in your bank that answer it."
                : "Try clearing the type filter."
            }
          />
        ) : (
          <ul className="divide-y divide-[var(--line)]">
            {filtered.map((question) => {
              const best = question.answers[0];
              const suggested = atoms.filter((a) => question.suggestedAtomIds.includes(a.id));
              return (
                <li key={question.id} className="px-4 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] leading-snug">{question.text}</p>

                      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                        <Tag>{QUESTION_KIND_LABELS[question.kind as QuestionKind] ?? question.kind}</Tag>
                        {question.competency && <Tag>{question.competency}</Tag>}
                        <span
                          className="flex items-center gap-0.5"
                          title={`Difficulty ${question.difficulty}/5`}
                        >
                          {[1, 2, 3, 4, 5].map((n) => (
                            <span
                              key={n}
                              className="block size-1 rounded-full"
                              style={{
                                background: n <= question.difficulty ? "var(--serious)" : "var(--line)",
                              }}
                            />
                          ))}
                        </span>
                        {best?.score !== null && best?.score !== undefined && (
                          <Badge tone={best.score >= 70 ? "good" : best.score >= 50 ? "warning" : "serious"}>
                            last scored {best.score}
                          </Badge>
                        )}
                        {question.answers.length > 0 && (
                          <span className="text-[10.5px] text-[var(--muted)]">
                            {question.answers.length} attempt{question.answers.length === 1 ? "" : "s"}
                          </span>
                        )}
                      </div>

                      {question.rationale && (
                        <p className="mt-1.5 text-[11px] leading-snug text-[var(--muted)]">{question.rationale}</p>
                      )}

                      {suggested.length > 0 && (
                        <div className="mt-2 flex flex-wrap items-center gap-1.5">
                          <span className="text-[10px] uppercase tracking-wide text-[var(--muted)]">
                            Answer with
                          </span>
                          {suggested.map((atom) => (
                            <Badge key={atom.id} tone={atom.hasStar ? "good" : "warning"}>
                              {atom.title.length > 34 ? `${atom.title.slice(0, 33)}…` : atom.title}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="flex shrink-0 flex-col items-end gap-1.5">
                      <Button size="sm" onClick={() => setPractising(question)}>
                        Practise
                      </Button>
                      <button
                        onClick={() =>
                          start(async () => {
                            await onDelete(question.id);
                            router.refresh();
                          })
                        }
                        className="grid size-5 place-items-center rounded text-[var(--muted)] hover:text-[var(--critical)]"
                      >
                        <IconTrash size={11} />
                      </button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Panel>

      {practising && (
        <PracticeDialog
          question={practising}
          atoms={atoms.filter((a) => practising.suggestedAtomIds.includes(a.id))}
          mode={mode}
          onClose={() => setPractising(null)}
          onSubmit={onPractise}
          onBridge={(b) => {
            setPractising(null);
            setBridge({ ...b, title: "Assess this answer" });
          }}
        />
      )}

      <Modal open={adding} onClose={() => setAdding(false)} title="Add a question" width="md">
        <form
          action={(formData) =>
            start(async () => {
              await onAdd(formData);
              setAdding(false);
              router.refresh();
            })
          }
          className="flex flex-col gap-3"
        >
          <textarea
            name="text"
            required
            rows={3}
            placeholder="The question, as an interviewer would ask it"
            className="field"
            autoFocus
          />
          <div className="grid grid-cols-2 gap-3">
            <select name="kind" className="field">
              {QUESTION_KINDS.map((k) => (
                <option key={k} value={k}>
                  {QUESTION_KIND_LABELS[k as QuestionKind]}
                </option>
              ))}
            </select>
            <select name="competencyId" className="field">
              <option value="">No competency</option>
              {competencies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <select name="jobId" defaultValue={jobFilter} className="field">
            <option value="">Not role-specific</option>
            {jobs.map((job) => (
              <option key={job.id} value={job.id}>
                {job.title}
              </option>
            ))}
          </select>
          <label className="flex items-center gap-2 text-[12px]">
            <input type="checkbox" name="isCore" className="size-3.5 accent-[var(--accent)]" />
            Keep in the standing bank
          </label>
          <div className="flex justify-end gap-2">
            <Button type="button" onClick={() => setAdding(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary">
              Add
            </Button>
          </div>
        </form>
      </Modal>

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
// Practice
// ---------------------------------------------------------------------------

function PracticeDialog({
  question, atoms, mode, onClose, onSubmit, onBridge,
}: {
  question: QuestionView;
  atoms: AtomView[];
  mode: "API" | "BRIDGE";
  onClose: () => void;
  onSubmit: (
    questionId: string,
    answer: string,
    withAi: boolean
  ) => Promise<AiActionResult & { structure?: Record<string, unknown> }>;
  onBridge: (bridge: { callId: string; prompt: string }) => void;
}) {
  const [answer, setAnswer] = useState("");
  const [pending, start] = useTransition();
  const [structure, setStructure] = useState<Record<string, unknown> | null>(null);
  const [showStar, setShowStar] = useState(false);

  const latest = question.answers[0];

  function run(withAi: boolean) {
    start(async () => {
      const result = await onSubmit(question.id, answer, withAi);
      if (result?.mode === "BRIDGE" && result.bridgePrompt && result.callId) {
        onBridge({ callId: result.callId, prompt: result.bridgePrompt });
        return;
      }
      if (result?.structure) setStructure(result.structure);
    });
  }

  const check = (label: string, ok: boolean) => (
    <span className="flex items-center gap-1 text-[11px]">
      <Dot tone={ok ? "good" : "serious"} />
      {label}
    </span>
  );

  return (
    <Modal
      open
      onClose={onClose}
      title="Practise"
      subtitle={question.text}
      width="lg"
      footer={
        <>
          <Button onClick={onClose}>Close</Button>
          <Button onClick={() => run(false)} disabled={pending || !answer.trim()}>
            Check structure
          </Button>
          <Button variant="primary" onClick={() => run(true)} disabled={pending || !answer.trim()}>
            <IconSparkle size={13} className={pending ? "pulse-soft" : undefined} />
            {pending ? "Assessing…" : "Get feedback"}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {atoms.length > 0 && (
          <div>
            <button
              onClick={() => setShowStar((v) => !v)}
              className="mb-1.5 text-[11px] text-[var(--muted)] underline hover:text-[var(--ink)]"
            >
              {showStar ? "Hide" : "Show"} the {atoms.length} suggested {atoms.length === 1 ? "story" : "stories"}
            </button>
            {showStar && (
              <ul className="flex flex-col gap-2">
                {atoms.map((atom) => (
                  <li key={atom.id} className="rounded-md border border-[var(--line)] p-2.5">
                    <p className="text-[12px] font-medium">{atom.title}</p>
                    {atom.hasStar ? (
                      <dl className="mt-1.5 flex flex-col gap-1 text-[11.5px]">
                        {(["situation", "task", "action", "result"] as const).map((key) =>
                          atom.star[key] ? (
                            <div key={key}>
                              <dt className="inline font-medium capitalize text-[var(--muted)]">{key}: </dt>
                              <dd className="inline">{atom.star[key]}</dd>
                            </div>
                          ) : null
                        )}
                      </dl>
                    ) : (
                      <p className="mt-1 text-[11px]" style={{ color: "var(--warning)" }}>
                        No STAR fields filled in — worth doing before you rely on this in a room.
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        <div>
          <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-wide text-[var(--muted)]">
            Your answer — write it as you would say it
          </label>
          <textarea
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            rows={10}
            className="field text-[12.5px] leading-relaxed"
            placeholder="Talk through the situation, what you were responsible for, what you actually did, and what changed as a result…"
            autoFocus
          />
          <p className="mt-1 text-[11px] text-[var(--muted)]">
            {wordCount(answer)} words
            {wordCount(answer) > 0 &&
              ` · roughly ${Math.round(wordCount(answer) / 130)} min ${
                wordCount(answer) < 90 ? "— short for a competency answer" : wordCount(answer) > 380 ? "— long, they will cut you off" : ""
              }`}
          </p>
        </div>

        {structure && (
          <div className="rise-in rounded-md border border-[var(--line)] p-3">
            <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-[var(--muted)]">
              Structural check
            </p>
            <div className="flex flex-wrap gap-3">
              {check("Situation", Boolean(structure.hasSituation))}
              {check("Task", Boolean(structure.hasTask))}
              {check("Action", Boolean(structure.hasAction))}
              {check("Result", Boolean(structure.hasResult))}
              {check("Contains a number", Boolean(structure.hasNumber))}
            </div>
            {Number(structure.fillers) > 2 && (
              <p className="mt-2 text-[11.5px]" style={{ color: "var(--warning)" }}>
                {String(structure.fillers)} filler words — fine in speech, but they usually mean the point is not
                yet sharp.
              </p>
            )}
          </div>
        )}

        {latest?.feedback?.problems && latest.feedback.problems.length > 0 && (
          <div className="rounded-md border border-[var(--line)] p-3">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-[11px] font-medium uppercase tracking-wide text-[var(--muted)]">
                Last assessment
              </p>
              <span className="text-[11px] text-[var(--muted)]">{relativeDays(latest.createdAt)}</span>
            </div>

            {latest.score !== null && (
              <p className="mb-2 text-[13px] font-semibold">
                {latest.score}
                <span className="text-[var(--muted)]">/100</span>
              </p>
            )}

            {latest.feedback.strengths && latest.feedback.strengths.length > 0 && (
              <ul className="mb-2 flex flex-col gap-1">
                {latest.feedback.strengths.map((s, i) => (
                  <li key={i} className="flex items-start gap-1.5 text-[11.5px]">
                    <IconCheck size={11} className="mt-0.5 shrink-0" style={{ color: "var(--good)" }} />
                    {s}
                  </li>
                ))}
              </ul>
            )}

            <ul className="flex flex-col gap-1">
              {latest.feedback.problems.map((p, i) => (
                <li key={i} className="flex items-start gap-1.5 text-[11.5px]">
                  <IconAlert size={11} className="mt-0.5 shrink-0" style={{ color: "var(--serious)" }} />
                  {p}
                </li>
              ))}
            </ul>

            {latest.feedback.followUp && (
              <p className="mt-2 border-t border-[var(--line)] pt-2 text-[11.5px]">
                <span className="text-[var(--muted)]">They would then ask: </span>
                {latest.feedback.followUp}
              </p>
            )}

            {latest.feedback.rewrite && (
              <details className="mt-2">
                <summary className="cursor-pointer text-[11px] text-[var(--muted)] hover:text-[var(--ink)]">
                  Show the restructured version
                </summary>
                <p className="mt-1.5 whitespace-pre-wrap text-[11.5px] leading-relaxed">
                  {latest.feedback.rewrite}
                </p>
              </details>
            )}
          </div>
        )}

        {mode === "BRIDGE" && (
          <p className="text-[11px] text-[var(--muted)]">
            No API key set — &ldquo;Get feedback&rdquo; will produce a prompt to paste into Claude. The structural
            check runs locally either way.
          </p>
        )}
      </div>
    </Modal>
  );
}
