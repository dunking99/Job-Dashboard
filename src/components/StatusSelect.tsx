"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateJobStatus } from "@/app/actions/jobs";
import { JOB_STATUSES, JOB_STATUS_LABELS, type JobStatus } from "@/lib/constants";

export function StatusSelect({ jobId, status }: { jobId: string; status: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();

  return (
    <select
      value={status}
      disabled={pending}
      onChange={(e) => {
        const next = e.target.value;
        start(async () => {
          await updateJobStatus(jobId, next);
          router.refresh();
        });
      }}
      className="field w-auto py-1.5 text-[13px] font-medium disabled:opacity-50"
      aria-label="Pipeline stage"
    >
      {JOB_STATUSES.map((s) => (
        <option key={s} value={s}>
          {JOB_STATUS_LABELS[s as JobStatus]}
        </option>
      ))}
    </select>
  );
}
