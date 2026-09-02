"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Panel, Button, Badge, Labelled, EmptyState, Dot, Tag } from "./ui";
import { Modal } from "./Modal";
import { IconPlus, IconTrash, IconUsers, IconMail, IconExternal, IconEdit } from "./icons";
import { RELATIONSHIPS, RELATIONSHIP_LABELS, INTERACTION_KINDS, type Relationship } from "@/lib/constants";
import { formatDate, relativeDays, daysAgo, cn } from "@/lib/utils";

interface InteractionView {
  id: string;
  kind: string;
  direction: string;
  subject: string;
  body: string;
  occurredAt: string;
}

interface ContactView {
  id: string;
  name: string;
  role: string;
  companyId: string | null;
  companyName: string;
  email: string;
  phone: string;
  linkedIn: string;
  relationship: string;
  notes: string;
  lastContactedAt: string | null;
  nextActionAt: string | null;
  nextActionNote: string;
  interactions: InteractionView[];
}

const RELATIONSHIP_TONE: Record<string, "good" | "warning" | "neutral" | "accent"> = {
  COLD: "neutral",
  OUTREACH_SENT: "warning",
  WARM: "good",
  MET: "good",
  REFERRER: "accent",
  RECRUITER: "accent",
  INTERVIEWER: "accent",
};

export function ContactsManager({
  contacts, companies, jobs, onSave, onDelete, onLog, onDeleteLog,
}: {
  contacts: ContactView[];
  companies: { id: string; name: string }[];
  jobs: { id: string; title: string; companyName: string }[];
  onSave: (contactId: string | null, formData: FormData) => Promise<{ ok?: boolean; error?: string }>;
  onDelete: (contactId: string) => Promise<{ ok?: boolean }>;
  onLog: (formData: FormData) => Promise<{ ok?: boolean }>;
  onDeleteLog: (interactionId: string) => Promise<{ ok?: boolean }>;
}) {
  const router = useRouter();
  const [, start] = useTransition();
  const [editing, setEditing] = useState<ContactView | null>(null);
  const [creating, setCreating] = useState(false);
  const [logging, setLogging] = useState<ContactView | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [filter, setFilter] = useState("");

  const visible = contacts.filter((c) => {
    if (!filter) return true;
    const haystack = `${c.name} ${c.role} ${c.companyName} ${c.notes}`.toLowerCase();
    return haystack.includes(filter.toLowerCase());
  });

  function submit(formData: FormData) {
    start(async () => {
      await onSave(editing?.id ?? null, formData);
      setEditing(null);
      setCreating(false);
      router.refresh();
    });
  }

  return (
    <>
      <Panel
        padded={false}
        title="Directory"
        action={
          <button
            onClick={() => {
              setEditing(null);
              setCreating(true);
            }}
            className="flex items-center gap-1 rounded px-1.5 py-1 text-[11px] text-[var(--muted)] hover:bg-[var(--accent-soft)] hover:text-[var(--ink)]"
          >
            <IconPlus size={12} /> Add contact
          </button>
        }
      >
        <div className="border-b border-[var(--line)] px-4 py-2.5">
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Search name, organisation, notes…"
            className="field"
          />
        </div>

        {visible.length === 0 ? (
          <EmptyState
            icon={<IconUsers size={26} />}
            title={contacts.length === 0 ? "No contacts yet" : "Nothing matches"}
            detail={
              contacts.length === 0
                ? "Recruiters, people who replied to outreach, anyone who interviewed you. Warm contacts convert far better than cold applications, and this is where you keep track of them."
                : "Try a different search."
            }
            action={
              contacts.length === 0 ? (
                <Button variant="primary" onClick={() => setCreating(true)}>
                  <IconPlus size={14} /> Add one
                </Button>
              ) : undefined
            }
          />
        ) : (
          <ul className="divide-y divide-[var(--line)]">
            {visible.map((contact) => {
              const overdue = contact.nextActionAt && new Date(contact.nextActionAt) <= new Date();
              const quiet =
                contact.relationship === "OUTREACH_SENT" &&
                contact.lastContactedAt &&
                daysAgo(new Date(contact.lastContactedAt)) >= 7;
              const isOpen = expanded === contact.id;

              return (
                <li key={contact.id}>
                  <div className="hover-row px-4 py-3">
                    <div className="flex items-start justify-between gap-3">
                      <button
                        onClick={() => setExpanded(isOpen ? null : contact.id)}
                        className="min-w-0 flex-1 text-left"
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-[13px] font-medium">{contact.name}</span>
                          <Badge tone={RELATIONSHIP_TONE[contact.relationship] ?? "neutral"}>
                            {RELATIONSHIP_LABELS[contact.relationship as Relationship] ?? contact.relationship}
                          </Badge>
                          {overdue && <Badge tone="serious">follow-up due</Badge>}
                          {quiet && !overdue && <Badge tone="warning">no reply</Badge>}
                        </div>
                        <p className="mt-0.5 text-[11.5px] text-[var(--muted)]">
                          {[contact.role, contact.companyName].filter(Boolean).join(" · ") || "—"}
                        </p>
                        {contact.nextActionNote && (
                          <p className="mt-1 text-[11.5px] text-[var(--ink-2)]">
                            Next: {contact.nextActionNote}
                            {contact.nextActionAt && (
                              <span className="text-[var(--muted)]"> ({relativeDays(contact.nextActionAt)})</span>
                            )}
                          </p>
                        )}
                      </button>

                      <div className="flex shrink-0 items-center gap-1">
                        <span className="mr-1 text-[11px] text-[var(--muted)]">
                          {contact.lastContactedAt ? relativeDays(contact.lastContactedAt) : "never"}
                        </span>
                        {contact.email && (
                          <a
                            href={`mailto:${contact.email}`}
                            className="grid size-6 place-items-center rounded text-[var(--muted)] hover:text-[var(--ink)]"
                            title={contact.email}
                          >
                            <IconMail size={12} />
                          </a>
                        )}
                        {contact.linkedIn && (
                          <a
                            href={contact.linkedIn}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="grid size-6 place-items-center rounded text-[var(--muted)] hover:text-[var(--ink)]"
                            title="LinkedIn"
                          >
                            <IconExternal size={12} />
                          </a>
                        )}
                        <button
                          onClick={() => setLogging(contact)}
                          className="rounded px-1.5 py-1 text-[11px] text-[var(--muted)] hover:bg-[var(--accent-soft)] hover:text-[var(--ink)]"
                        >
                          Log
                        </button>
                        <button
                          onClick={() => {
                            setEditing(contact);
                            setCreating(false);
                          }}
                          className="grid size-6 place-items-center rounded text-[var(--muted)] hover:text-[var(--ink)]"
                        >
                          <IconEdit size={12} />
                        </button>
                      </div>
                    </div>

                    {isOpen && (
                      <div className="rise-in mt-3 border-t border-[var(--line)] pt-3">
                        {contact.notes && (
                          <p className="mb-3 text-[12px] leading-relaxed text-[var(--ink-2)]">{contact.notes}</p>
                        )}

                        {contact.interactions.length === 0 ? (
                          <p className="text-[11.5px] text-[var(--muted)]">No conversations logged yet.</p>
                        ) : (
                          <ul className="flex flex-col gap-2">
                            {contact.interactions.map((entry) => (
                              <li key={entry.id} className="group flex items-start gap-2">
                                <Dot tone={entry.direction === "IN" ? "good" : "neutral"} className="mt-1.5" />
                                <div className="min-w-0 flex-1">
                                  <p className="text-[12px]">
                                    <span className="text-[var(--muted)]">
                                      {entry.kind.toLowerCase()} {entry.direction === "IN" ? "in" : "out"} ·{" "}
                                      {formatDate(entry.occurredAt)}
                                    </span>
                                    {entry.subject && <> — {entry.subject}</>}
                                  </p>
                                  {entry.body && (
                                    <p className="mt-0.5 text-[11.5px] leading-snug text-[var(--ink-2)]">
                                      {entry.body}
                                    </p>
                                  )}
                                </div>
                                <button
                                  onClick={() =>
                                    start(async () => {
                                      await onDeleteLog(entry.id);
                                      router.refresh();
                                    })
                                  }
                                  className="grid size-5 shrink-0 place-items-center rounded text-[var(--muted)] opacity-0 transition-opacity hover:text-[var(--critical)] group-hover:opacity-100"
                                >
                                  <IconTrash size={10} />
                                </button>
                              </li>
                            ))}
                          </ul>
                        )}

                        <button
                          onClick={() =>
                            start(async () => {
                              if (!window.confirm(`Delete ${contact.name}?`)) return;
                              await onDelete(contact.id);
                              router.refresh();
                            })
                          }
                          className="mt-3 text-[11px] text-[var(--muted)] hover:text-[var(--critical)]"
                        >
                          Delete contact
                        </button>
                      </div>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Panel>

      {/* Contact form */}
      <Modal
        open={creating || Boolean(editing)}
        onClose={() => {
          setCreating(false);
          setEditing(null);
        }}
        title={editing ? `Edit ${editing.name}` : "Add a contact"}
        width="md"
      >
        <form action={submit} className="flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-3">
            <Labelled label="Name">
              <input name="name" defaultValue={editing?.name} required className="field" autoFocus />
            </Labelled>
            <Labelled label="Role">
              <input name="role" defaultValue={editing?.role} className="field" />
            </Labelled>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Labelled label="Organisation">
              <select name="companyId" defaultValue={editing?.companyId ?? ""} className="field">
                <option value="">Not linked</option>
                {companies.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </Labelled>
            <Labelled label="Relationship">
              <select name="relationship" defaultValue={editing?.relationship ?? "COLD"} className="field">
                {RELATIONSHIPS.map((r) => (
                  <option key={r} value={r}>
                    {RELATIONSHIP_LABELS[r as Relationship]}
                  </option>
                ))}
              </select>
            </Labelled>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Labelled label="Email">
              <input name="email" type="email" defaultValue={editing?.email} className="field" />
            </Labelled>
            <Labelled label="Phone">
              <input name="phone" defaultValue={editing?.phone} className="field" />
            </Labelled>
          </div>

          <Labelled label="LinkedIn">
            <input name="linkedIn" defaultValue={editing?.linkedIn} className="field" />
          </Labelled>

          <div className="grid grid-cols-[auto_1fr] gap-3">
            <Labelled label="Next action date">
              <input
                type="date"
                name="nextActionAt"
                defaultValue={editing?.nextActionAt ? editing.nextActionAt.slice(0, 10) : ""}
                className="field"
              />
            </Labelled>
            <Labelled label="Next action">
              <input
                name="nextActionNote"
                defaultValue={editing?.nextActionNote}
                className="field"
                placeholder="Chase if no reply"
              />
            </Labelled>
          </div>

          <Labelled label="Notes">
            <textarea name="notes" defaultValue={editing?.notes} rows={3} className="field" />
          </Labelled>

          <input type="hidden" name="companyName" defaultValue={editing?.companyName} />

          <div className="flex justify-end gap-2 pt-1">
            <Button
              type="button"
              onClick={() => {
                setCreating(false);
                setEditing(null);
              }}
            >
              Cancel
            </Button>
            <Button type="submit" variant="primary">
              {editing ? "Save" : "Add"}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Interaction log */}
      <Modal
        open={Boolean(logging)}
        onClose={() => setLogging(null)}
        title={logging ? `Log a conversation with ${logging.name}` : ""}
        width="md"
      >
        {logging && (
          <form
            action={(formData) =>
              start(async () => {
                await onLog(formData);
                setLogging(null);
                router.refresh();
              })
            }
            className="flex flex-col gap-3"
          >
            <input type="hidden" name="contactId" value={logging.id} />

            <div className="grid grid-cols-3 gap-3">
              <Labelled label="Type">
                <select name="kind" className="field">
                  {INTERACTION_KINDS.map((k) => (
                    <option key={k} value={k}>
                      {k.toLowerCase()}
                    </option>
                  ))}
                </select>
              </Labelled>
              <Labelled label="Direction">
                <select name="direction" className="field">
                  <option value="OUT">Sent by me</option>
                  <option value="IN">Received</option>
                  <option value="NA">Neither</option>
                </select>
              </Labelled>
              <Labelled label="Date">
                <input
                  type="date"
                  name="occurredAt"
                  defaultValue={new Date().toISOString().slice(0, 10)}
                  className="field"
                />
              </Labelled>
            </div>

            <Labelled label="Related role (optional)">
              <select name="jobId" className="field">
                <option value="">None</option>
                {jobs.map((job) => (
                  <option key={job.id} value={job.id}>
                    {job.title}
                    {job.companyName ? ` — ${job.companyName}` : ""}
                  </option>
                ))}
              </select>
            </Labelled>

            <Labelled label="Subject">
              <input name="subject" className="field" autoFocus />
            </Labelled>

            <Labelled label="What was said">
              <textarea name="body" rows={4} className="field" />
            </Labelled>

            <div className="flex justify-end gap-2 pt-1">
              <Button type="button" onClick={() => setLogging(null)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary">
                Log it
              </Button>
            </div>
          </form>
        )}
      </Modal>
    </>
  );
}
