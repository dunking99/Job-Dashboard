import { prisma } from "@/lib/db";
import { PageHeader, StatTile } from "@/components/ui";
import { ContactsManager } from "@/components/ContactsManager";
import { saveContact, deleteContact, logInteraction, deleteInteraction } from "@/app/actions/crm";
import { daysAgo } from "@/lib/utils";

export default async function ContactsPage() {
  const [contacts, companies, jobs, interactions] = await Promise.all([
    prisma.contact.findMany({
      orderBy: [{ nextActionAt: "asc" }, { name: "asc" }],
      include: { company: { select: { id: true, name: true } } },
    }),
    prisma.company.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.job.findMany({
      where: { status: { notIn: ["REJECTED", "WITHDRAWN", "ARCHIVED"] } },
      select: { id: true, title: true, companyName: true },
    }),
    prisma.interaction.findMany({
      where: { contactId: { not: null } },
      orderBy: { occurredAt: "desc" },
    }),
  ]);

  const now = new Date();
  const dueNow = contacts.filter((c) => c.nextActionAt && c.nextActionAt <= now);
  const warm = contacts.filter((c) => ["WARM", "MET", "REFERRER"].includes(c.relationship));
  const awaiting = contacts.filter(
    (c) => c.relationship === "OUTREACH_SENT" && c.lastContactedAt && daysAgo(c.lastContactedAt) >= 7
  );

  return (
    <>
      <PageHeader
        title="Contacts"
        description="Recruiters, referrers and people you have spoken to. Logging a conversation updates when you last made contact, so the follow-up prompts stay honest without a second field to maintain."
      />

      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatTile label="Contacts" value={contacts.length} />
        <StatTile label="Warm or better" value={warm.length} tone={warm.length > 0 ? "good" : undefined} />
        <StatTile
          label="Follow-up due"
          value={dueNow.length}
          tone={dueNow.length > 0 ? "serious" : undefined}
        />
        <StatTile
          label="Outreach gone quiet"
          value={awaiting.length}
          sub="7+ days, no reply"
          tone={awaiting.length > 0 ? "warning" : undefined}
        />
      </div>

      <ContactsManager
        contacts={contacts.map((c) => ({
          id: c.id,
          name: c.name,
          role: c.role,
          companyId: c.companyId,
          companyName: c.company?.name ?? c.companyName,
          email: c.email,
          phone: c.phone,
          linkedIn: c.linkedIn,
          relationship: c.relationship,
          notes: c.notes,
          lastContactedAt: c.lastContactedAt ? c.lastContactedAt.toISOString() : null,
          nextActionAt: c.nextActionAt ? c.nextActionAt.toISOString() : null,
          nextActionNote: c.nextActionNote,
          interactions: interactions
            .filter((i) => i.contactId === c.id)
            .map((i) => ({
              id: i.id,
              kind: i.kind,
              direction: i.direction,
              subject: i.subject,
              body: i.body,
              occurredAt: i.occurredAt.toISOString(),
            })),
        }))}
        companies={companies}
        jobs={jobs}
        onSave={async (contactId, formData) => {
          "use server";
          return saveContact(contactId, formData);
        }}
        onDelete={async (contactId) => {
          "use server";
          return deleteContact(contactId);
        }}
        onLog={async (formData) => {
          "use server";
          return logInteraction(formData);
        }}
        onDeleteLog={async (interactionId) => {
          "use server";
          return deleteInteraction(interactionId);
        }}
      />
    </>
  );
}
