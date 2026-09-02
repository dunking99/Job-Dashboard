"use client";

import { useState } from "react";
import { Panel, Labelled, Button, Tag } from "./ui";
import { IconCheck } from "./icons";
import { COMPANY_SECTORS, COMPANY_SECTOR_LABELS, type CompanySector } from "@/lib/constants";
import { cn } from "@/lib/utils";

export interface ProfileData {
  fullName: string;
  headline: string;
  email: string;
  phone: string;
  location: string;
  linkedIn: string;
  website: string;
  summary: string;
  degree: string;
  university: string;
  graduationYear: string;
  classification: string;
  targetRoles: string[];
  targetSectors: string[];
  targetLocations: string[];
  voiceNotes: string;
  weeklyApplicationTarget: number;
}

export function ProfileForm({
  profile,
  action,
}: {
  profile: ProfileData;
  action: (formData: FormData) => Promise<void>;
}) {
  const [sectors, setSectors] = useState<Set<string>>(new Set(profile.targetSectors));
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function handleSubmit(formData: FormData) {
    setSaving(true);
    for (const s of sectors) formData.append("targetSectors", s);
    await action(formData);
    setSaving(false);
    setSaved(true);
    window.setTimeout(() => setSaved(false), 2500);
  }

  return (
    <form action={handleSubmit} className="flex flex-col gap-4">
      <Panel title="Contact details" subtitle="These appear at the top of every generated CV.">
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-3">
            <Labelled label="Full name">
              <input name="fullName" defaultValue={profile.fullName} className="field" />
            </Labelled>
            <Labelled label="Headline" hint="One line under your name.">
              <input
                name="headline"
                defaultValue={profile.headline}
                className="field"
                placeholder="Politics & Economics graduate — policy analysis"
              />
            </Labelled>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <Labelled label="Email">
              <input name="email" type="email" defaultValue={profile.email} className="field" />
            </Labelled>
            <Labelled label="Phone">
              <input name="phone" defaultValue={profile.phone} className="field" />
            </Labelled>
            <Labelled label="Location">
              <input name="location" defaultValue={profile.location} className="field" />
            </Labelled>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Labelled label="LinkedIn">
              <input name="linkedIn" defaultValue={profile.linkedIn} className="field" />
            </Labelled>
            <Labelled label="Website or portfolio">
              <input name="website" defaultValue={profile.website} className="field" />
            </Labelled>
          </div>

          <Labelled
            label="Profile paragraph"
            hint="The default opener. Tailoring replaces it per application, so keep this one general."
          >
            <textarea name="summary" defaultValue={profile.summary} rows={3} className="field" />
          </Labelled>
        </div>
      </Panel>

      <Panel title="Education">
        <div className="grid grid-cols-2 gap-3">
          <Labelled label="Degree">
            <input name="degree" defaultValue={profile.degree} className="field" placeholder="BSc Politics with Economics" />
          </Labelled>
          <Labelled label="Institution">
            <input name="university" defaultValue={profile.university} className="field" />
          </Labelled>
          <Labelled label="Graduation year">
            <input name="graduationYear" defaultValue={profile.graduationYear} className="field" />
          </Labelled>
          <Labelled label="Classification">
            <input name="classification" defaultValue={profile.classification} className="field" placeholder="2:1" />
          </Labelled>
        </div>
      </Panel>

      <Panel title="Targets" subtitle="Used by the target-alignment component of the match score.">
        <div className="flex flex-col gap-3">
          <Labelled label="Target roles" hint="Comma separated. Job titles containing these score higher.">
            <input
              name="targetRoles"
              defaultValue={profile.targetRoles.join(", ")}
              className="field"
              placeholder="Policy Advisor, Research Assistant, Economist"
            />
          </Labelled>

          <div>
            <span className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-[var(--muted)]">
              Target sectors
            </span>
            <div className="flex flex-wrap gap-1.5">
              {COMPANY_SECTORS.map((s) => {
                const on = sectors.has(s);
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => {
                      const next = new Set(sectors);
                      on ? next.delete(s) : next.add(s);
                      setSectors(next);
                    }}
                    className={cn(
                      "rounded border px-1.5 py-0.5 text-[11px] transition-colors",
                      on
                        ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--ink)]"
                        : "border-[var(--line)] text-[var(--ink-2)] hover:border-[var(--line-strong)]"
                    )}
                  >
                    {COMPANY_SECTOR_LABELS[s as CompanySector]}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-[1fr_auto] gap-3">
            <Labelled label="Target locations" hint="Comma separated.">
              <input
                name="targetLocations"
                defaultValue={profile.targetLocations.join(", ")}
                className="field"
                placeholder="London, Bristol, Remote"
              />
            </Labelled>
            <Labelled label="Applications per week">
              <input
                type="number"
                name="weeklyApplicationTarget"
                min={1}
                max={40}
                defaultValue={profile.weeklyApplicationTarget}
                className="field w-28"
              />
            </Labelled>
          </div>
        </div>
      </Panel>

      <Panel
        title="Writing voice"
        subtitle="Passed to every generation prompt. This is what stops drafts reading like generic application prose."
      >
        <Labelled
          label="How you write"
          hint="Describe your register honestly — sentence length, how formal, what you avoid. A paragraph is plenty."
        >
          <textarea
            name="voiceNotes"
            defaultValue={profile.voiceNotes}
            rows={4}
            className="field"
            placeholder="Direct and analytical. Prefers concrete claims over abstraction, leads with the argument rather than building to it, avoids inflated adjectives…"
          />
        </Labelled>
      </Panel>

      <div className="sticky bottom-0 flex items-center justify-end gap-3 border-t border-[var(--line)] bg-[var(--surface)] py-3">
        {saved && (
          <span className="flex items-center gap-1.5 text-[12px]" style={{ color: "var(--good)" }}>
            <IconCheck size={13} /> Saved
          </span>
        )}
        <Button type="submit" variant="primary" disabled={saving}>
          {saving ? "Saving…" : "Save profile"}
        </Button>
      </div>
    </form>
  );
}
