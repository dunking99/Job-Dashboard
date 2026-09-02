import Link from "next/link";
import { prisma } from "@/lib/db";
import { PageHeader, Panel, Badge, Tag, LinkButton, EmptyState, StatTile, Dot } from "@/components/ui";
import { InterviewScheduler } from "@/components/InterviewScheduler";
import { QuestionBank } from "@/components/QuestionBank";
import { IconMic, IconAlert } from "@/components/icons";
import {
  saveInterview, deleteInterview, setPrepStatus,
  generateQuestions, savePracticeAnswer, deleteQuestion, addQuestion,
} from "@/app/actions/interview";
import { INTERVIEW_KIND_LABELS, type InterviewKind } from "@/lib/constants";
import { parseJson, formatDateTime, relativeDays, daysBetween } from "@/lib/utils";
import { aiMode } from "@/lib/ai/client";

export default async function InterviewPage({
  searchParams,
}: {
  searchParams: Promise<{ job?: string }>;
}) {
  const { job: jobParam } = await searchParams;

  const [interviews, jobs, questions, atoms, competencies] = await Promise.all([
    prisma.interviewEvent.findMany({
      orderBy: { scheduledAt: "asc" },
      include: { job: { select: { id: true, title: true, companyName: true } } },
    }),
    prisma.job.findMany({
      where: { status: { notIn: ["REJECTED", "WITHDRAWN", "ARCHIVED"] } },
      orderBy: { stageChangedAt: "desc" },
      select: { id: true, title: true, companyName: true, status: true },
    }),
    prisma.predictedQuestion.findMany({
      orderBy: [{ difficulty: "desc" }, { createdAt: "desc" }],
      include: {
        competency: true,
        job: { select: { id: true, title: true, companyName: true } },
        answers: { orderBy: { createdAt: "desc" } },
      },
    }),
    prisma.experienceAtom.findMany({
      where: { archived: false },
      include: { competencies: true },
    }),
    prisma.competency.findMany({ orderBy: [{ framework: "asc" }, { name: "asc" }] }),
  ]);

  const now = new Date();
  const upcoming = interviews.filter((i) => i.scheduledAt >= now);
  const past = interviews.filter((i) => i.scheduledAt < now);

  const selectedJobId = jobParam ?? upcoming[0]?.jobId ?? jobs[0]?.id ?? null;

  const starReady = atoms.filter((a) => a.starAction.trim() && a.starResult.trim());
  const answeredCount = questions.filter((q) => q.answers.length > 0).length;

  // Competency coverage: which behaviours have no story attached at all. This
  // is the thing that sinks Civil Service interviews, so it is surfaced first.
  const coveredCompetencyIds = new Set(
    atoms.filter((a) => a.starAction.trim()).flatMap((a) => a.competencies.map((c) => c.id))
  );
  const uncovered = competencies.filter((c) => !coveredCompetencyIds.has(c.id));

  async function schedule(interviewId: string | null, formData: FormData) {
    "use server";
    return saveInterview(interviewId, formData);
  }
  async function removeInterview(interviewId: string) {
    "use server";
    return deleteInterview(interviewId);
  }
  async function updatePrep(interviewId: string, status: string) {
    "use server";
    return setPrepStatus(interviewId, status);
  }
  async function generate(jobId: string, kind: string, count: number) {
    "use server";
    return generateQuestions(jobId, kind, count);
  }
  async function practise(questionId: string, answer: string, withAi: boolean) {
    "use server";
    return savePracticeAnswer(questionId, answer, withAi);
  }
  async function removeQuestion(questionId: string) {
    "use server";
    return deleteQuestion(questionId);
  }
  async function addOne(formData: FormData) {
    "use server";
    return addQuestion(formData);
  }

  return (
    <>
      <PageHeader
        title="Interview preparation"
        description="STAR stories come from the same entries as your CV bullets — write a fact once, and it is available in every register. Nothing here is a second copy of your experience."
      />

      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatTile
          label="Scheduled"
          value={upcoming.length}
          sub={upcoming[0] ? `next ${relativeDays(upcoming[0].scheduledAt)}` : "none booked"}
          tone={upcoming.some((i) => i.prepStatus !== "READY" && daysBetween(now, i.scheduledAt) <= 3) ? "serious" : undefined}
        />
        <StatTile label="STAR-ready stories" value={starReady.length} href="/experience" />
        <StatTile label="Questions banked" value={questions.length} sub={`${answeredCount} practised`} />
        <StatTile
          label="Uncovered competencies"
          value={uncovered.length}
          tone={uncovered.length > 4 ? "warning" : undefined}
        />
      </div>

      {uncovered.length > 0 && (
        <Panel className="mb-4 border-[color-mix(in_srgb,var(--warning)_35%,transparent)]">
          <div className="flex items-start gap-3">
            <IconAlert size={16} className="mt-0.5 shrink-0" style={{ color: "var(--warning)" }} />
            <div className="min-w-0">
              <p className="text-[13px] font-medium">
                {uncovered.length} competenc{uncovered.length === 1 ? "y has" : "ies have"} no STAR story
              </p>
              <p className="mt-0.5 text-[12px] leading-snug text-[var(--ink-2)]">
                A competency-based panel will ask about these directly, and &ldquo;I can&rsquo;t think of an
                example&rdquo; is the worst possible answer. Tag an existing entry with the behaviour and fill in its
                STAR fields.
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {uncovered.map((c) => (
                  <Tag key={c.id}>{c.name}</Tag>
                ))}
              </div>
            </div>
          </div>
        </Panel>
      )}

      <div className="grid gap-4 xl:grid-cols-[1fr_360px]">
        <QuestionBank
          questions={questions.map((q) => ({
            id: q.id,
            text: q.text,
            kind: q.kind,
            difficulty: q.difficulty,
            rationale: q.rationale,
            competency: q.competency?.name ?? "",
            jobId: q.jobId,
            jobLabel: q.job ? `${q.job.title}${q.job.companyName ? ` · ${q.job.companyName}` : ""}` : "",
            suggestedAtomIds: parseJson<string[]>(q.suggestedAtomIds, []),
            answers: q.answers.map((a) => ({
              id: a.id,
              answerText: a.answerText,
              score: a.score,
              analysis: parseJson<Record<string, unknown>>(a.analysis, {}),
              feedback: parseJson<{
                strengths?: string[];
                problems?: string[];
                rewrite?: string;
                followUp?: string;
              }>(a.feedback, {}),
              createdAt: a.createdAt.toISOString(),
            })),
          }))}
          atoms={atoms.map((a) => ({
            id: a.id,
            title: a.title,
            metric: a.metric,
            hasStar: Boolean(a.starAction.trim() && a.starResult.trim()),
            star: {
              situation: a.starSituation,
              task: a.starTask,
              action: a.starAction,
              result: a.starResult,
            },
            competencies: a.competencies.map((c) => c.name),
          }))}
          jobs={jobs}
          competencies={competencies.map((c) => ({ id: c.id, name: c.name }))}
          selectedJobId={selectedJobId}
          mode={aiMode()}
          onGenerate={generate}
          onPractise={practise}
          onDelete={removeQuestion}
          onAdd={addOne}
        />

        <div className="flex flex-col gap-4">
          <InterviewScheduler
            jobs={jobs}
            interviews={upcoming.map((i) => ({
              id: i.id,
              jobId: i.jobId,
              jobTitle: i.job.title,
              companyName: i.job.companyName,
              kind: i.kind,
              scheduledAt: i.scheduledAt.toISOString(),
              durationMins: i.durationMins,
              format: i.format,
              locationOrLink: i.locationOrLink,
              prepStatus: i.prepStatus,
              prepNotes: i.prepNotes,
            }))}
            defaultJobId={selectedJobId}
            onSave={schedule}
            onDelete={removeInterview}
            onPrepStatus={updatePrep}
          />

          {past.length > 0 && (
            <Panel title="Past interviews" padded={false}>
              <ul className="divide-y divide-[var(--line)]">
                {past.slice(0, 8).map((iv) => (
                  <li key={iv.id} className="px-4 py-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <Link href={`/jobs/${iv.jobId}`} className="block truncate text-[12.5px] hover:underline">
                          {iv.job.title}
                        </Link>
                        <p className="text-[11px] text-[var(--muted)]">
                          {INTERVIEW_KIND_LABELS[iv.kind as InterviewKind] ?? iv.kind} ·{" "}
                          {formatDateTime(iv.scheduledAt)}
                        </p>
                      </div>
                      {iv.outcome && (
                        <Badge tone={iv.outcome === "PASSED" ? "good" : iv.outcome === "REJECTED" ? "critical" : "neutral"}>
                          {iv.outcome.toLowerCase()}
                        </Badge>
                      )}
                    </div>
                    {iv.debrief && (
                      <p className="mt-1 text-[11.5px] leading-snug text-[var(--ink-2)]">{iv.debrief}</p>
                    )}
                  </li>
                ))}
              </ul>
            </Panel>
          )}

          <Panel title="STAR library" subtitle="Entries ready to tell as a story." padded={false}>
            {starReady.length === 0 ? (
              <EmptyState
                icon={<IconMic size={24} />}
                title="No STAR stories yet"
                detail="Fill in the STAR fields on an experience entry and it becomes usable in interviews without any duplication."
                action={<LinkButton href="/experience" size="sm">Open the bank</LinkButton>}
              />
            ) : (
              <ul className="divide-y divide-[var(--line)]">
                {starReady.map((atom) => (
                  <li key={atom.id} className="px-4 py-2.5">
                    <Link href={`/experience/${atom.id}`} className="text-[12.5px] font-medium hover:underline">
                      {atom.title}
                    </Link>
                    <p className="mt-0.5 line-clamp-2 text-[11.5px] leading-snug text-[var(--ink-2)]">
                      {atom.starResult}
                    </p>
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {atom.competencies.slice(0, 3).map((c) => (
                        <Tag key={c.id}>{c.name}</Tag>
                      ))}
                      {atom.metric && <Badge tone="good">{atom.metric}</Badge>}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      </div>
    </>
  );
}
