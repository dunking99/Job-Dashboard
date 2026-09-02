import { prisma } from "@/lib/db";
import { PageHeader, LinkButton, StatTile } from "@/components/ui";
import { KanbanBoard } from "@/components/KanbanBoard";
import { IconPlus } from "@/components/icons";
import { updateJobStatus } from "@/app/actions/jobs";
import { BOARD_STAGES, CLOSED_STATUSES, JOB_STATUS_LABELS, type JobStatus } from "@/lib/constants";
import { parseJson, daysAgo } from "@/lib/utils";
import type { RedFlag } from "@/lib/redflags";

export default async function PipelinePage() {
  const jobs = await prisma.job.findMany({
    orderBy: [{ boardOrder: "asc" }, { stageChangedAt: "desc" }],
    include: { _count: { select: { documents: true, interviews: true } } },
  });

  const cards = jobs.map((job) => ({
    id: job.id,
    title: job.title,
    companyName: job.companyName,
    status: job.status,
    matchScore: job.matchScore,
    deadline: job.deadline ? job.deadline.toISOString() : null,
    idleDays: daysAgo(job.stageChangedAt),
    documents: job._count.documents,
    interviews: job._count.interviews,
    redFlags: parseJson<RedFlag[]>(job.redFlags, []).filter(
      (f) => f.severity === "critical" || f.severity === "serious"
    ).length,
    priority: job.priority,
  }));

  const closed = cards.filter((c) => CLOSED_STATUSES.includes(c.status as JobStatus));
  const live = cards.filter((c) => !CLOSED_STATUSES.includes(c.status as JobStatus));

  async function move(jobId: string, status: string) {
    "use server";
    return updateJobStatus(jobId, status);
  }

  const offers = cards.filter((c) => c.status === "OFFER").length;
  const interviewing = cards.filter((c) => ["INTERVIEW", "FINAL"].includes(c.status)).length;
  const stale = live.filter((c) => c.idleDays >= 10 && ["APPLIED", "SCREENING"].includes(c.status)).length;

  return (
    <>
      <PageHeader
        title="Pipeline"
        description="Drag a card to move it. Moving to Applied stamps the date, which is what the response-rate and timing analytics are computed from."
        actions={
          <LinkButton href="/jobs/new" variant="primary">
            <IconPlus size={14} /> Capture a job
          </LinkButton>
        }
      />

      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatTile label="Live" value={live.length} sub="not closed out" />
        <StatTile label="Interviewing" value={interviewing} tone={interviewing > 0 ? "good" : undefined} />
        <StatTile label="Offers" value={offers} tone={offers > 0 ? "good" : undefined} />
        <StatTile
          label="Gone quiet"
          value={stale}
          sub="10+ days, no movement"
          tone={stale > 0 ? "warning" : undefined}
        />
      </div>

      <KanbanBoard
        stages={BOARD_STAGES.map((s) => ({ key: s, label: JOB_STATUS_LABELS[s as JobStatus] }))}
        cards={live}
        onMove={move}
      />

      {closed.length > 0 && (
        <div className="mt-6">
          <h2 className="mb-3 text-[13px] font-semibold">Closed out ({closed.length})</h2>
          <KanbanBoard
            stages={CLOSED_STATUSES.map((s) => ({ key: s, label: JOB_STATUS_LABELS[s as JobStatus] }))}
            cards={closed}
            onMove={move}
            compact
          />
        </div>
      )}
    </>
  );
}
