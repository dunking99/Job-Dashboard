import Link from "next/link";
import { prisma } from "@/lib/db";
import { PageHeader, Panel, LinkButton, Badge, Tag, EmptyState, StatTile } from "@/components/ui";
import { IconPlus, IconBuilding, IconExternal } from "@/components/icons";
import { COMPANY_SECTOR_LABELS, type CompanySector } from "@/lib/constants";
import { relativeDays, truncate } from "@/lib/utils";

export default async function CompaniesPage() {
  const companies = await prisma.company.findMany({
    orderBy: { name: "asc" },
    include: {
      domains: true,
      _count: { select: { jobs: true, contacts: true } },
    },
  });

  const researched = companies.filter((c) => c.researchedAt);
  const withJobs = companies.filter((c) => c._count.jobs > 0);

  return (
    <>
      <PageHeader
        title="Companies"
        description="A dossier per employer, kept separate from any one application — so research done for one role still pays off when the next vacancy opens."
        actions={
          <LinkButton href="/companies/new" variant="primary">
            <IconPlus size={14} /> Add organisation
          </LinkButton>
        }
      />

      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatTile label="Organisations" value={companies.length} />
        <StatTile label="Researched" value={researched.length} sub="have a dossier" />
        <StatTile label="With live roles" value={withJobs.length} />
        <StatTile
          label="Contacts"
          value={companies.reduce((sum, c) => sum + c._count.contacts, 0)}
          href="/contacts"
        />
      </div>

      {companies.length === 0 ? (
        <Panel>
          <EmptyState
            icon={<IconBuilding size={28} />}
            title="No organisations yet"
            detail="Capturing a job creates its employer automatically. You can also add one directly to start researching before a vacancy appears."
            action={
              <LinkButton href="/companies/new" variant="primary">
                <IconPlus size={14} /> Add one
              </LinkButton>
            }
          />
        </Panel>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {companies.map((company) => (
            <Panel key={company.id} className="flex flex-col">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <Link href={`/companies/${company.id}`} className="text-[13.5px] font-medium hover:underline">
                    {company.name}
                  </Link>
                  <p className="mt-0.5 text-[11px] text-[var(--muted)]">
                    {[COMPANY_SECTOR_LABELS[company.sector as CompanySector] ?? company.sector, company.hq]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </div>
                {company.website && (
                  <a
                    href={company.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="shrink-0 text-[var(--muted)] hover:text-[var(--ink)]"
                    title="Website"
                  >
                    <IconExternal size={13} />
                  </a>
                )}
              </div>

              {company.whatTheyDo && (
                <p className="mt-2 flex-1 text-[12px] leading-snug text-[var(--ink-2)]">
                  {truncate(company.whatTheyDo, 150)}
                </p>
              )}

              <div className="mt-3 flex flex-wrap items-center gap-1.5">
                {company.researchedAt ? (
                  <Badge tone="good">Researched {relativeDays(company.researchedAt)}</Badge>
                ) : (
                  <Badge tone="warning">No dossier</Badge>
                )}
                {company._count.jobs > 0 && (
                  <Tag>
                    {company._count.jobs} role{company._count.jobs === 1 ? "" : "s"}
                  </Tag>
                )}
                {company._count.contacts > 0 && (
                  <Tag>
                    {company._count.contacts} contact{company._count.contacts === 1 ? "" : "s"}
                  </Tag>
                )}
                {company.domains.slice(0, 2).map((d) => (
                  <Tag key={d.id}>{d.name}</Tag>
                ))}
              </div>
            </Panel>
          ))}
        </div>
      )}
    </>
  );
}
