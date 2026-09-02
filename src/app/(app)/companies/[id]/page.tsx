import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { PageHeader, Panel, Badge, Tag, ScoreChip, LinkButton, DataList, EmptyState } from "@/components/ui";
import { CompanyForm, type CompanyFormData } from "@/components/CompanyForm";
import { CompanyResearch } from "@/components/CompanyResearch";
import { IconExternal, IconAlert } from "@/components/icons";
import { saveCompany, deleteCompany, researchCompany } from "@/app/actions/crm";
import { COMPANY_SECTOR_LABELS, JOB_STATUS_LABELS, type CompanySector, type JobStatus } from "@/lib/constants";
import { parseJson, formatDate, relativeDays } from "@/lib/utils";
import { aiMode } from "@/lib/ai/client";

export default async function CompanyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const [company, domains] = await Promise.all([
    prisma.company.findUnique({
      where: { id },
      include: {
        domains: true,
        jobs: { orderBy: { createdAt: "desc" } },
        contacts: true,
      },
    }),
    prisma.domain.findMany({ orderBy: { name: "asc" } }),
  ]);

  if (!company) notFound();

  const keyPeople = parseJson<{ name: string; role: string; note: string }[]>(company.keyPeople, []);
  const sources = parseJson<{ label: string; url: string; note?: string }[]>(company.sources, []);
  const uncertainty = sources.find((s) => s.label === "Model uncertainty")?.note;

  const formData: CompanyFormData = {
    id: company.id,
    name: company.name,
    website: company.website,
    sector: company.sector,
    size: company.size,
    hq: company.hq,
    whatTheyDo: company.whatTheyDo,
    recentNews: company.recentNews,
    policyPositions: company.policyPositions,
    cultureNotes: company.cultureNotes,
    whyThisOrg: company.whyThisOrg,
    competitors: company.competitors,
    domainIds: company.domains.map((d) => d.id),
  };

  async function save(fd: FormData) {
    "use server";
    return saveCompany(id, fd);
  }
  async function remove() {
    "use server";
    await deleteCompany(id);
  }
  async function research(pastedMaterial: string) {
    "use server";
    return researchCompany(id, pastedMaterial);
  }

  return (
    <>
      <PageHeader
        title={company.name}
        description={
          [COMPANY_SECTOR_LABELS[company.sector as CompanySector] ?? company.sector, company.hq]
            .filter(Boolean)
            .join(" · ") || undefined
        }
        actions={
          company.website ? (
            <a
              href={company.website}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-md border border-[var(--line-strong)] bg-[var(--panel)] px-3 py-1.5 text-[13px] font-medium hover:bg-[var(--raised)]"
            >
              <IconExternal size={13} /> Website
            </a>
          ) : null
        }
      />

      <div className="mb-4 grid gap-4 xl:grid-cols-[1fr_340px]">
        <CompanyResearch
          companyName={company.name}
          researchedAt={company.researchedAt ? company.researchedAt.toISOString() : null}
          action={research}
          mode={aiMode()}
        />

        <div className="flex flex-col gap-4">
          {uncertainty && (
            <Panel className="border-[color-mix(in_srgb,var(--warning)_35%,transparent)]">
              <div className="flex items-start gap-2">
                <IconAlert size={14} className="mt-0.5 shrink-0" style={{ color: "var(--warning)" }} />
                <div>
                  <p className="text-[12px] font-medium">Verify before interview</p>
                  <p className="mt-1 text-[11.5px] leading-snug text-[var(--ink-2)]">{uncertainty}</p>
                </div>
              </div>
            </Panel>
          )}

          {keyPeople.length > 0 && (
            <Panel title="Key people" padded={false}>
              <ul className="divide-y divide-[var(--line)]">
                {keyPeople.map((person, i) => (
                  <li key={i} className="px-4 py-2.5">
                    <p className="text-[12.5px] font-medium">{person.name}</p>
                    {person.role && <p className="text-[11px] text-[var(--muted)]">{person.role}</p>}
                    {person.note && <p className="mt-1 text-[11.5px] text-[var(--ink-2)]">{person.note}</p>}
                  </li>
                ))}
              </ul>
            </Panel>
          )}

          <Panel title="Roles here" padded={false}>
            {company.jobs.length === 0 ? (
              <EmptyState title="No roles captured" detail="Jobs captured for this employer appear here." />
            ) : (
              <ul className="divide-y divide-[var(--line)]">
                {company.jobs.map((job) => (
                  <li key={job.id} className="hover-row flex items-center gap-3 px-4 py-2.5">
                    <ScoreChip score={job.matchScore} size="sm" />
                    <div className="min-w-0 flex-1">
                      <Link href={`/jobs/${job.id}`} className="block truncate text-[12.5px] hover:underline">
                        {job.title}
                      </Link>
                      <p className="text-[11px] text-[var(--muted)]">
                        {JOB_STATUS_LABELS[job.status as JobStatus]} · {relativeDays(job.createdAt)}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          {company.contacts.length > 0 && (
            <Panel title="Contacts" padded={false}>
              <ul className="divide-y divide-[var(--line)]">
                {company.contacts.map((contact) => (
                  <li key={contact.id} className="px-4 py-2.5">
                    <p className="text-[12.5px]">{contact.name}</p>
                    <p className="text-[11px] text-[var(--muted)]">{contact.role || contact.relationship}</p>
                  </li>
                ))}
              </ul>
            </Panel>
          )}

          <Panel title="Record">
            <DataList
              rows={[
                { label: "Added", value: formatDate(company.createdAt) },
                { label: "Researched", value: company.researchedAt ? formatDate(company.researchedAt) : "Never" },
                { label: "Domains", value: company.domains.map((d) => d.name).join(", ") || "—" },
              ]}
            />
          </Panel>
        </div>
      </div>

      <CompanyForm company={formData} domains={domains} action={save} onDelete={remove} />
    </>
  );
}
