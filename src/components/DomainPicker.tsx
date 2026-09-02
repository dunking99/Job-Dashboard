"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

export function DomainPicker({
  domains,
  selected,
  action,
}: {
  domains: { id: string; name: string }[];
  selected: string[];
  action: (domainIds: string[]) => Promise<{ ok?: boolean; error?: string }>;
}) {
  const router = useRouter();
  const [chosen, setChosen] = useState<Set<string>>(new Set(selected));
  const [pending, start] = useTransition();
  const [dirty, setDirty] = useState(false);

  function toggle(id: string) {
    const next = new Set(chosen);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setChosen(next);
    setDirty(true);
  }

  function save() {
    start(async () => {
      await action([...chosen]);
      setDirty(false);
      router.refresh();
    });
  }

  return (
    <div>
      <div className="flex flex-wrap gap-1.5">
        {domains.map((d) => {
          const on = chosen.has(d.id);
          return (
            <button
              key={d.id}
              type="button"
              onClick={() => toggle(d.id)}
              className={cn(
                "rounded border px-1.5 py-0.5 text-[11px] transition-colors",
                on
                  ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--ink)]"
                  : "border-[var(--line)] text-[var(--ink-2)] hover:border-[var(--line-strong)]"
              )}
            >
              {d.name}
            </button>
          );
        })}
      </div>

      {dirty && (
        <button
          onClick={save}
          disabled={pending}
          className="mt-3 w-full rounded-md bg-[var(--accent)] px-3 py-1.5 text-[12px] font-medium text-white disabled:opacity-50"
        >
          {pending ? "Saving and rescoring…" : "Save and rescore"}
        </button>
      )}
    </div>
  );
}
