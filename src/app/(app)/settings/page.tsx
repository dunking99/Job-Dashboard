import { getProfile, prisma } from "@/lib/db";
import { PageHeader, Panel, Badge, Tag } from "@/components/ui";
import { ProfileForm } from "@/components/ProfileForm";
import { BridgeQueue } from "@/components/BridgeQueue";
import { DangerZone } from "@/components/DangerZone";
import { aiMode, aiModel } from "@/lib/ai/client";
import { clearAllContent, saveProfile } from "@/app/actions/settings";
import { reanalyseAllJobs } from "@/app/actions/jobs";
import { dismissAiCall, clearAiHistory } from "@/app/actions/ai";
import { AI_KIND_LABELS, type AiKind } from "@/lib/constants";
import { parseJson, formatDateTime, relativeDays } from "@/lib/utils";

export default async function SettingsPage() {
  const [profile, pending, recent, counts] = await Promise.all([
    getProfile(),
    prisma.aiCall.findMany({
      where: { status: "PENDING" },
      orderBy: { createdAt: "desc" },
    }),
    prisma.aiCall.findMany({
      where: { status: { in: ["COMPLETE", "FAILED"] } },
      orderBy: { createdAt: "desc" },
      take: 12,
    }),
    Promise.all([
      prisma.experienceAtom.count(),
      prisma.job.count(),
      prisma.company.count(),
      prisma.contact.count(),
      prisma.document.count(),
      prisma.predictedQuestion.count(),
    ]),
  ]);

  const [atomCount, jobCount, companyCount, contactCount, documentCount, questionCount] = counts;
  const mode = aiMode();

  const totalTokens = recent.reduce(
    (sum, call) => sum + (call.inputTokens ?? 0) + (call.outputTokens ?? 0),
    0
  );

  async function save(formData: FormData) {
    "use server";
    await saveProfile(formData);
  }
  async function rescoreAll() {
    "use server";
    return reanalyseAllJobs();
  }
  async function wipe() {
    "use server";
    return clearAllContent();
  }
  async function dismiss(callId: string) {
    "use server";
    return dismissAiCall(callId);
  }
  async function clearHistory() {
    "use server";
    return clearAiHistory();
  }

  return (
    <>
      <PageHeader
        title="Settings"
        description="Your profile feeds every generated document and every AI prompt describing you. Everything lives in a local SQLite file — nothing is uploaded unless you set an API key and run an AI action."
      />

      <div className="grid gap-4 xl:grid-cols-[1fr_360px]">
        <ProfileForm
          profile={{
            fullName: profile.fullName,
            headline: profile.headline,
            email: profile.email,
            phone: profile.phone,
            location: profile.location,
            linkedIn: profile.linkedIn,
            website: profile.website,
            summary: profile.summary,
            degree: profile.degree,
            university: profile.university,
            graduationYear: profile.graduationYear,
            classification: profile.classification,
            targetRoles: parseJson<string[]>(profile.targetRoles, []),
            targetSectors: parseJson<string[]>(profile.targetSectors, []),
            targetLocations: parseJson<string[]>(profile.targetLocations, []),
            voiceNotes: profile.voiceNotes,
            weeklyApplicationTarget: profile.weeklyApplicationTarget,
          }}
          action={save}
        />

        <div className="flex flex-col gap-4">
          <Panel title="AI engine">
            <div className="mb-3 flex items-center gap-2">
              <Badge tone={mode === "API" ? "good" : "warning"}>
                {mode === "API" ? "API mode" : "Bridge mode"}
              </Badge>
              {mode === "API" && <Tag>{aiModel()}</Tag>}
            </div>

            {mode === "API" ? (
              <p className="text-[12px] leading-relaxed text-[var(--ink-2)]">
                An API key is set, so every AI action runs in one click. Costs are per-call and small — a job
                analysis is a fraction of a penny. Job descriptions and your experience bank are sent to
                Anthropic when you trigger an action; nothing is sent otherwise.
              </p>
            ) : (
              <p className="text-[12px] leading-relaxed text-[var(--ink-2)]">
                No API key set. AI actions still work: each one builds a complete prompt for you to paste into
                Claude, and pasting the reply back writes it to exactly the same place an API response would.
                Nothing leaves this machine automatically.
              </p>
            )}

            <p className="mt-2 text-[11px] leading-snug text-[var(--muted)]">
              To switch to one-click mode, put <code className="font-mono">ANTHROPIC_API_KEY</code> in{" "}
              <code className="font-mono">.env</code> and restart. Match scoring, red flags, ATS analysis and CV
              composition are all deterministic and never needed a key.
            </p>

            {totalTokens > 0 && (
              <p className="mt-2 border-t border-[var(--line)] pt-2 text-[11px] text-[var(--muted)]">
                {totalTokens.toLocaleString()} tokens across the last {recent.length} calls.
              </p>
            )}
          </Panel>

          {pending.length > 0 && (
            <BridgeQueue
              calls={pending.map((call) => ({
                id: call.id,
                kind: call.kind,
                kindLabel: AI_KIND_LABELS[call.kind as AiKind] ?? call.kind,
                createdAt: call.createdAt.toISOString(),
                systemPrompt: call.systemPrompt,
                userPrompt: call.userPrompt,
              }))}
              onDismiss={dismiss}
            />
          )}

          <Panel title="Stored data" padded={false}>
            <ul className="divide-y divide-[var(--line)]">
              {[
                { label: "Experience entries", value: atomCount },
                { label: "Jobs", value: jobCount },
                { label: "Organisations", value: companyCount },
                { label: "Contacts", value: contactCount },
                { label: "Documents", value: documentCount },
                { label: "Questions", value: questionCount },
              ].map((row) => (
                <li key={row.label} className="flex items-center justify-between gap-3 px-4 py-2 text-[12px]">
                  <span>{row.label}</span>
                  <span className="tnum text-[var(--muted)]">{row.value}</span>
                </li>
              ))}
            </ul>
          </Panel>

          {recent.length > 0 && (
            <Panel title="Recent AI calls" padded={false}>
              <ul className="max-h-64 divide-y divide-[var(--line)] overflow-y-auto">
                {recent.map((call) => (
                  <li key={call.id} className="flex items-center justify-between gap-2 px-4 py-2">
                    <div className="min-w-0">
                      <p className="truncate text-[12px]">
                        {AI_KIND_LABELS[call.kind as AiKind] ?? call.kind}
                      </p>
                      <p className="text-[10.5px] text-[var(--muted)]">
                        {relativeDays(call.createdAt)} · {call.mode.toLowerCase()}
                        {call.durationMs ? ` · ${(call.durationMs / 1000).toFixed(1)}s` : ""}
                      </p>
                    </div>
                    <Badge tone={call.status === "COMPLETE" ? "good" : "critical"}>
                      {call.status === "COMPLETE" ? "ok" : "failed"}
                    </Badge>
                  </li>
                ))}
              </ul>
            </Panel>
          )}

          <DangerZone onRescore={rescoreAll} onClear={wipe} onClearHistory={clearHistory} />
        </div>
      </div>
    </>
  );
}
