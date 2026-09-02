"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Panel, Labelled, Button } from "./ui";
import { IconTrash } from "./icons";
import { COMPANY_SECTORS, COMPANY_SECTOR_LABELS, type CompanySector } from "@/lib/constants";
import { cn } from "@/lib/utils";

export interface CompanyFormData {
  id: string;
  name: string;
  website: string;
  sector: string;
  size: string;
  hq: string;
  whatTheyDo: string;
  recentNews: string;
  policyPositions: string;
  cultureNotes: string;
  whyThisOrg: string;
  competitors: string;
  domainIds: string[];
}

export function CompanyForm({
  company,
  domains,
  action,
  onDelete,
}: {
  company: CompanyFormData | null;
  domains: { id: string; name: string }[];
  action: (formData: FormData) => Promise<{ error?: string } | void>;
  onDelete?: () => Promise<void>;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set(company?.domainIds ?? []));

  async function handleSubmit(formData: FormData) {
    setSaving(true);
    setError(null);
    for (const id of selected) formData.append("domainIds", id);
    const result = await action(formData);
    setSaving(false);
    if (result && "error" in result && result.error) setError(result.error);
  }

  return (
    <form action={handleSubmit} className="grid gap-4 lg:grid-cols-[1fr_320px]">
      <div className="flex flex-col gap-4">
        <Panel title="Identity">
          <div className="flex flex-col gap-3">
            <Labelled label="Name">
              <input name="name" defaultValue={company?.name} required className="field" />
            </Labelled>
            <div className="grid grid-cols-2 gap-3">
              <Labelled label="Sector">
                <select name="sector" defaultValue={company?.sector ?? "OTHER"} className="field">
                  {COMPANY_SECTORS.map((s) => (
                    <option key={s} value={s}>
                      {COMPANY_SECTOR_LABELS[s as CompanySector]}
                    </option>
                  ))}
                </select>
              </Labelled>
              <Labelled label="Headquarters">
                <input name="hq" defaultValue={company?.hq} className="field" placeholder="London" />
              </Labelled>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Labelled label="Website">
                <input name="website" type="url" defaultValue={company?.website} className="field" />
              </Labelled>
              <Labelled label="Size">
                <input name="size" defaultValue={company?.size} className="field" placeholder="~60 staff" />
              </Labelled>
            </div>
          </div>
        </Panel>

        <Panel title="Dossier" subtitle="Fill in by hand, or generate it and edit afterwards.">
          <div className="flex flex-col gap-3">
            <Labelled label="What they do" hint="Funding model and who they answer to matter as much as the mission statement.">
              <textarea name="whatTheyDo" defaultValue={company?.whatTheyDo} rows={4} className="field" />
            </Labelled>
            <Labelled label="Policy positions and priorities">
              <textarea name="policyPositions" defaultValue={company?.policyPositions} rows={3} className="field" />
            </Labelled>
            <Labelled label="Recent developments">
              <textarea name="recentNews" defaultValue={company?.recentNews} rows={3} className="field" />
            </Labelled>
            <Labelled label="Culture and hiring notes">
              <textarea name="cultureNotes" defaultValue={company?.cultureNotes} rows={3} className="field" />
            </Labelled>
            <Labelled
              label="Why this organisation"
              hint="Your actual answer to the interview question. Specific to you, not flattery."
            >
              <textarea name="whyThisOrg" defaultValue={company?.whyThisOrg} rows={3} className="field" />
            </Labelled>
            <Labelled label="Comparable organisations" hint="Useful for widening the search as well as for framing.">
              <textarea name="competitors" defaultValue={company?.competitors} rows={2} className="field" />
            </Labelled>
          </div>
        </Panel>
      </div>

      <div className="flex flex-col gap-4">
        <Panel title="Policy domains">
          <div className="flex flex-wrap gap-1.5">
            {domains.map((d) => {
              const on = selected.has(d.id);
              return (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => {
                    const next = new Set(selected);
                    on ? next.delete(d.id) : next.add(d.id);
                    setSelected(next);
                  }}
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
        </Panel>

        {error && (
          <p className="text-[12px]" style={{ color: "var(--critical)" }}>
            {error}
          </p>
        )}

        <div className="flex flex-col gap-2">
          <Button type="submit" variant="primary" disabled={saving} className="w-full justify-center">
            {saving ? "Saving…" : company ? "Save changes" : "Create"}
          </Button>
          <Button type="button" onClick={() => router.back()} className="w-full justify-center">
            Cancel
          </Button>
          {onDelete && (
            <Button
              type="button"
              variant="danger"
              className="w-full justify-center"
              onClick={async () => {
                if (window.confirm("Delete this organisation? Jobs and contacts stay, but lose the link.")) {
                  await onDelete();
                }
              }}
            >
              <IconTrash size={13} /> Delete
            </Button>
          )}
        </div>
      </div>
    </form>
  );
}
