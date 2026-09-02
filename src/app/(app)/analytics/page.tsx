import Link from "next/link";
import { getProfile, prisma } from "@/lib/db";
import { PageHeader, Panel, StatTile, Badge, Tag, EmptyState } from "@/components/ui";
import { Funnel, ActivityChart, StackedStrip, MiniStat } from "@/components/charts";
import { IconChart } from "@/components/icons";
import {
  getDashboardStats, getWeeklyActivity, getFunnelData,
  getSourcePerformance, getMarketGaps,
} from "@/lib/analytics";
import { pct } from "@/lib/utils";

export default async function AnalyticsPage() {
  const profile = await getProfile();

  const [stats, activity, funnel, sources, gaps, scored] = await Promise.all([
    getDashboardStats(profile.weeklyApplicationTarget),
    getWeeklyActivity(16),
    getFunnelData(),
    getSourcePerformance(),
    getMarketGaps(),
    prisma.job.findMany({
      where: { matchScore: { not: null } },
      select: { matchScore: true, status: true, appliedAt: true },
    }),
  ]);

  // Does applying to better-matched roles actually produce more replies? With a
  // small sample this is indicative rather than conclusive, and it is labelled
  // as such — a graduate search rarely has the volume for a real signal.
  const bands = [
    { label: "75+", min: 75, max: 101 },
    { label: "55–74", min: 55, max: 75 },
    { label: "35–54", min: 35, max: 55 },
    { label: "under 35", min: 0, max: 35 },
  ].map((band) => {
    const inBand = scored.filter((j) => (j.matchScore ?? 0) >= band.min && (j.matchScore ?? 0) < band.max);
    const applied = inBand.filter((j) => j.appliedAt);
    const responded = applied.filter((j) =>
      ["SCREENING", "INTERVIEW", "FINAL", "OFFER", "REJECTED"].includes(j.status)
    );
    return {
      ...band,
      total: inBand.length,
      applied: applied.length,
      responded: responded.length,
      rate: pct(responded.length, applied.length),
    };
  });

  const totalApplied = stats.applied;

  return (
    <>
      <PageHeader
        title="Analytics"
        description="What is actually working. With a graduate-sized sample most of these are directional rather than significant — treat them as prompts to look closer, not as proof."
      />

      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <StatTile label="Captured" value={stats.totalJobs} />
        <StatTile label="Applied" value={stats.applied} />
        <StatTile
          label="Response rate"
          value={stats.applied ? `${stats.responseRate}%` : "—"}
          tone={stats.applied >= 5 ? (stats.responseRate >= 25 ? "good" : stats.responseRate >= 10 ? "warning" : "serious") : undefined}
        />
        <StatTile
          label="Interview rate"
          value={stats.applied ? `${stats.interviewRate}%` : "—"}
        />
        <StatTile label="Offers" value={stats.offers} tone={stats.offers > 0 ? "good" : undefined} />
        <StatTile
          label="Median reply"
          value={stats.medianDaysToResponse !== null ? `${stats.medianDaysToResponse}d` : "—"}
          sub="after applying"
        />
      </div>

      {totalApplied === 0 ? (
        <Panel>
          <EmptyState
            icon={<IconChart size={28} />}
            title="Nothing to analyse yet"
            detail="Move a job to Applied and these fill in. The most useful views need roughly ten applications before they say anything meaningful."
          />
        </Panel>
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          <Panel title="Funnel" subtitle="Where applications stop.">
            <Funnel data={funnel} />
          </Panel>

          <Panel title="Applications per week" subtitle="Last 16 weeks against your target.">
            <ActivityChart data={activity} target={stats.weeklyTarget} height={140} />
            <div className="mt-5 flex items-center justify-between gap-4 border-t border-[var(--line)] pt-3">
              <MiniStat label="This week" value={stats.appliedThisWeek} />
              <MiniStat label="Target" value={stats.weeklyTarget} />
              <MiniStat
                label="Weeks on target"
                value={activity.filter((w) => w.value >= stats.weeklyTarget).length}
              />
              <MiniStat label="No reply 28d+" value={stats.ghosted} />
            </div>
          </Panel>

          <Panel
            title="Does match score predict replies?"
            subtitle="Response rate by the score the role had when you applied."
            padded={false}
          >
            <ul className="divide-y divide-[var(--line)]">
              {bands.map((band) => (
                <li key={band.label} className="px-4 py-2.5">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-[12.5px] font-medium">{band.label}</span>
                    <span className="tnum text-[11px] text-[var(--muted)]">
                      {band.applied ? `${band.rate}% of ${band.applied}` : "none applied"}
                    </span>
                  </div>
                  <div className="mt-1.5">
                    <StackedStrip
                      segments={[
                        { label: "Replied", value: band.responded, color: "var(--s1)" },
                        { label: "No reply", value: band.applied - band.responded, color: "var(--line)" },
                      ]}
                    />
                  </div>
                </li>
              ))}
            </ul>
            <p className="border-t border-[var(--line)] px-4 py-2.5 text-[11px] leading-snug text-[var(--muted)]">
              If the top band is not outperforming the bottom one, either the scoring needs better inputs — more
              tagged skills in the bank — or something other than fit is driving rejections.
            </p>
          </Panel>

          <Panel title="Sources" subtitle="Which boards actually convert, not just which produce applications." padded={false}>
            {sources.length === 0 ? (
              <EmptyState title="No sources recorded" detail="Set the source when capturing a job." />
            ) : (
              <table className="w-full text-[12px]">
                <thead>
                  <tr className="border-b border-[var(--line)] text-[10px] uppercase tracking-wide text-[var(--muted)]">
                    <th className="px-4 py-2 text-left font-medium">Source</th>
                    <th className="px-2 py-2 text-right font-medium">Saved</th>
                    <th className="px-2 py-2 text-right font-medium">Applied</th>
                    <th className="px-2 py-2 text-right font-medium">Replied</th>
                    <th className="px-4 py-2 text-right font-medium">Interview</th>
                  </tr>
                </thead>
                <tbody>
                  {sources.map((source) => (
                    <tr key={source.source} className="border-b border-[var(--line)] last:border-0">
                      <td className="px-4 py-2">{source.source}</td>
                      <td className="tnum px-2 py-2 text-right text-[var(--muted)]">{source.total}</td>
                      <td className="tnum px-2 py-2 text-right">{source.applied}</td>
                      <td className="tnum px-2 py-2 text-right">
                        {source.applied ? `${source.responseRate}%` : "—"}
                      </td>
                      <td className="tnum px-4 py-2 text-right">
                        {source.applied ? `${source.interviewRate}%` : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Panel>

          <Panel
            title="What the market wants that you cannot evidence"
            subtitle="Skills named across captured jobs with nothing in your bank demonstrating them."
            padded={false}
            className="xl:col-span-2"
          >
            {gaps.length === 0 ? (
              <EmptyState
                title="No unmet demand"
                detail="Every skill named across your captured jobs is evidenced by at least one entry."
              />
            ) : (
              <>
                <ul className="divide-y divide-[var(--line)]">
                  {gaps.slice(0, 12).map((gap) => (
                    <li key={gap.name} className="flex items-center gap-3 px-4 py-2">
                      <span className="min-w-0 flex-1 text-[12.5px]">{gap.name}</span>
                      <div className="w-40 shrink-0">
                        <StackedStrip
                          segments={[
                            { label: "Essential", value: gap.required, color: "var(--serious)" },
                            { label: "Desirable", value: gap.jobs - gap.required, color: "var(--ramp-3)" },
                          ]}
                          height={6}
                        />
                      </div>
                      <span className="tnum w-28 shrink-0 text-right text-[11px] text-[var(--muted)]">
                        {gap.jobs} job{gap.jobs === 1 ? "" : "s"}
                        {gap.required > 0 && (
                          <span style={{ color: "var(--serious)" }}> · {gap.required} essential</span>
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
                <p className="border-t border-[var(--line)] px-4 py-2.5 text-[11px] leading-snug text-[var(--muted)]">
                  This is the most actionable view here. Anything marked essential across several roles is worth
                  either acquiring, or evidencing properly from experience you already have but have not written
                  up — check the{" "}
                  <Link href="/experience" className="underline hover:text-[var(--ink)]">
                    bank
                  </Link>{" "}
                  before assuming it is a real gap.
                </p>
              </>
            )}
          </Panel>
        </div>
      )}
    </>
  );
}
