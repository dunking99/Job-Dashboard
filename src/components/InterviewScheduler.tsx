"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Panel, Button, Badge, Labelled, EmptyState } from "./ui";
import { Modal } from "./Modal";
import { IconPlus, IconTrash, IconCalendar } from "./icons";
import { INTERVIEW_KINDS, INTERVIEW_KIND_LABELS, type InterviewKind } from "@/lib/constants";
import { formatDateTime, relativeDays, daysBetween } from "@/lib/utils";

interface InterviewView {
  id: string;
  jobId: string;
  jobTitle: string;
  companyName: string;
  kind: string;
  scheduledAt: string;
  durationMins: number;
  format: string;
  locationOrLink: string;
  prepStatus: string;
  prepNotes: string;
}

const PREP_STATES = [
  { key: "NOT_STARTED", label: "Not started", tone: "serious" as const },
  { key: "IN_PROGRESS", label: "Prepping", tone: "warning" as const },
  { key: "READY", label: "Ready", tone: "good" as const },
];

export function InterviewScheduler({
  jobs,
  interviews,
  defaultJobId,
  onSave,
  onDelete,
  onPrepStatus,
}: {
  jobs: { id: string; title: string; companyName: string }[];
  interviews: InterviewView[];
  defaultJobId: string | null;
  onSave: (interviewId: string | null, formData: FormData) => Promise<{ ok?: boolean; error?: string }>;
  onDelete: (interviewId: string) => Promise<{ ok?: boolean }>;
  onPrepStatus: (interviewId: string, status: string) => Promise<{ ok?: boolean }>;
}) {
  const router = useRouter();
  const [, start] = useTransition();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<InterviewView | null>(null);
  const [error, setError] = useState<string | null>(null);

  function submit(formData: FormData) {
    start(async () => {
      const result = await onSave(editing?.id ?? null, formData);
      if (result?.error) {
        setError(result.error);
        return;
      }
      setOpen(false);
      setEditing(null);
      setError(null);
      router.refresh();
    });
  }

  return (
    <>
      <Panel
        title="Scheduled interviews"
        padded={false}
        action={
          <button
            onClick={() => {
              setEditing(null);
              setOpen(true);
            }}
            className="flex items-center gap-1 rounded px-1.5 py-1 text-[11px] text-[var(--muted)] hover:bg-[var(--accent-soft)] hover:text-[var(--ink)]"
          >
            <IconPlus size={12} /> Schedule
          </button>
        }
      >
        {interviews.length === 0 ? (
          <EmptyState
            icon={<IconCalendar size={24} />}
            title="Nothing booked"
            detail="Scheduling one moves the job to the interview stage and starts the prep countdown on your command centre."
          />
        ) : (
          <ul className="divide-y divide-[var(--line)]">
            {interviews.map((iv) => {
              const days = daysBetween(new Date(), new Date(iv.scheduledAt));
              const urgent = days <= 3 && iv.prepStatus !== "READY";
              return (
                <li key={iv.id} className="px-4 py-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <Link href={`/jobs/${iv.jobId}`} className="block text-[12.5px] font-medium hover:underline">
                        {iv.jobTitle}
                      </Link>
                      <p className="text-[11px] text-[var(--muted)]">
                        {iv.companyName || "—"} ·{" "}
                        {INTERVIEW_KIND_LABELS[iv.kind as InterviewKind] ?? iv.kind}
                      </p>
                    </div>
                    <span
                      className="shrink-0 text-[11px]"
                      style={{ color: urgent ? "var(--serious)" : "var(--muted)" }}
                    >
                      {relativeDays(iv.scheduledAt)}
                    </span>
                  </div>

                  <p className="mt-1 text-[11px] text-[var(--muted)]">
                    {formatDateTime(iv.scheduledAt)} · {iv.durationMins} min · {iv.format.toLowerCase()}
                    {iv.locationOrLink ? ` · ${iv.locationOrLink}` : ""}
                  </p>

                  <div className="mt-2 flex items-center gap-1.5">
                    {PREP_STATES.map((state) => (
                      <button
                        key={state.key}
                        onClick={() =>
                          start(async () => {
                            await onPrepStatus(iv.id, state.key);
                            router.refresh();
                          })
                        }
                        className="cursor-pointer"
                        title={`Mark ${state.label.toLowerCase()}`}
                      >
                        <Badge tone={iv.prepStatus === state.key ? state.tone : "neutral"}>{state.label}</Badge>
                      </button>
                    ))}
                    <div className="ml-auto flex gap-1">
                      <button
                        onClick={() => {
                          setEditing(iv);
                          setOpen(true);
                        }}
                        className="rounded px-1.5 py-0.5 text-[10.5px] text-[var(--muted)] hover:text-[var(--ink)]"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() =>
                          start(async () => {
                            if (!window.confirm("Remove this interview?")) return;
                            await onDelete(iv.id);
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

      <Modal
        open={open}
        onClose={() => {
          setOpen(false);
          setEditing(null);
        }}
        title={editing ? "Edit interview" : "Schedule an interview"}
        width="md"
      >
        <form action={submit} className="flex flex-col gap-3">
          <Labelled label="Job">
            <select name="jobId" defaultValue={editing?.jobId ?? defaultJobId ?? ""} required className="field">
              <option value="">Choose a role…</option>
              {jobs.map((job) => (
                <option key={job.id} value={job.id}>
                  {job.title}
                  {job.companyName ? ` — ${job.companyName}` : ""}
                </option>
              ))}
            </select>
          </Labelled>

          <div className="grid grid-cols-2 gap-3">
            <Labelled label="Stage">
              <select name="kind" defaultValue={editing?.kind ?? "SCREENING"} className="field">
                {INTERVIEW_KINDS.map((k) => (
                  <option key={k} value={k}>
                    {INTERVIEW_KIND_LABELS[k as InterviewKind]}
                  </option>
                ))}
              </select>
            </Labelled>
            <Labelled label="Format">
              <select name="format" defaultValue={editing?.format ?? "VIDEO"} className="field">
                <option value="VIDEO">Video</option>
                <option value="PHONE">Phone</option>
                <option value="IN_PERSON">In person</option>
              </select>
            </Labelled>
          </div>

          <div className="grid grid-cols-[1fr_auto] gap-3">
            <Labelled label="Date and time">
              <input
                type="datetime-local"
                name="scheduledAt"
                required
                defaultValue={
                  editing ? new Date(editing.scheduledAt).toISOString().slice(0, 16) : ""
                }
                className="field"
              />
            </Labelled>
            <Labelled label="Minutes">
              <input
                type="number"
                name="durationMins"
                min={10}
                step={5}
                defaultValue={editing?.durationMins ?? 45}
                className="field w-24"
              />
            </Labelled>
          </div>

          <Labelled label="Location or link">
            <input name="locationOrLink" defaultValue={editing?.locationOrLink} className="field" />
          </Labelled>

          <Labelled label="Prep notes">
            <textarea name="prepNotes" defaultValue={editing?.prepNotes} rows={3} className="field" />
          </Labelled>

          <input type="hidden" name="prepStatus" value={editing?.prepStatus ?? "NOT_STARTED"} />

          {error && (
            <p className="text-[12px]" style={{ color: "var(--critical)" }}>
              {error}
            </p>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <Button
              type="button"
              onClick={() => {
                setOpen(false);
                setEditing(null);
              }}
            >
              Cancel
            </Button>
            <Button type="submit" variant="primary">
              {editing ? "Save" : "Schedule"}
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
