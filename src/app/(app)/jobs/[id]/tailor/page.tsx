import { notFound } from "next/navigation";
import { prisma, getProfile } from "@/lib/db";
import { PageHeader, LinkButton } from "@/components/ui";
import { TailorStudio } from "@/components/TailorStudio";
import { rankAtomsForJob, type AtomForMatching } from "@/lib/matching";
import { parseJson, dateRange } from "@/lib/utils";
import { emptyCv, type CvStructure, type CoverLetterStructure, emptyCoverLetter } from "@/lib/cv";
import type { ExtractedSkill } from "@/lib/text";
import type { AtsIssue, KeywordCoverage } from "@/lib/ats";
import {
  createTailoredCv, tailorWithAi, saveDocument, deleteDocument,
  markDocumentFinal, createCoverLetter, draftCoverLetterWithAi,
} from "@/app/actions/documents";

export default async function TailorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const [job, profile, atoms] = await Promise.all([
    prisma.job.findUnique({
      where: { id },
      include: { domains: true, documents: { orderBy: { createdAt: "desc" } } },
    }),
    getProfile(),
    prisma.experienceAtom.findMany({
      where: { archived: false },
      include: { skills: { include: { skill: true } }, domains: true, bullets: true },
    }),
  ]);

  if (!job) notFound();

  const extracted = parseJson<ExtractedSkill[]>(job.extractedSkills, []);
  const ranked = rankAtomsForJob(
    atoms as unknown as AtomForMatching[],
    extracted,
    job.domains.map((d) => d.slug)
  );

  const rankedAtoms = ranked.map((r) => {
    const atom = atoms.find((a) => a.id === r.atomId)!;
    return {
      id: atom.id,
      title: atom.title,
      organisation: atom.organisation,
      role: atom.role,
      category: atom.category,
      dates: dateRange(atom.startDate, atom.endDate, atom.ongoing),
      location: atom.location,
      metric: atom.metric,
      summary: atom.summary,
      relevance: r.score,
      reasons: r.reasons,
      bullets: atom.bullets.map((b) => ({
        id: b.id,
        text: b.text,
        register: b.register,
        isPrimary: b.isPrimary,
      })),
    };
  });

  const documents = job.documents.map((doc) => ({
    id: doc.id,
    kind: doc.kind as "CV" | "COVER_LETTER",
    label: doc.label,
    isFinal: doc.isFinal,
    atsScore: doc.atsScore,
    structure:
      doc.kind === "CV"
        ? parseJson<CvStructure>(doc.structure, emptyCv())
        : parseJson<CoverLetterStructure>(doc.structure, emptyCoverLetter(profile.fullName)),
    coverage: parseJson<KeywordCoverage>(doc.keywordCoverage, {
      matched: [], missing: [], missingRequired: [], percentage: 0,
    }),
    issues: parseJson<AtsIssue[]>(doc.atsIssues, []),
    updatedAt: doc.updatedAt.toISOString(),
  }));

  // --- Server actions bound to this job -----------------------------------
  async function newCv() {
    "use server";
    return createTailoredCv(id);
  }
  async function newLetter() {
    "use server";
    return createCoverLetter(id);
  }
  async function aiTailor(documentId: string) {
    "use server";
    return tailorWithAi(id, documentId);
  }
  async function aiLetter(documentId: string) {
    "use server";
    return draftCoverLetterWithAi(id, documentId);
  }
  async function save(documentId: string, structure: unknown, kind: "CV" | "COVER_LETTER") {
    "use server";
    return saveDocument(documentId, structure, kind);
  }
  async function remove(documentId: string) {
    "use server";
    return deleteDocument(documentId);
  }
  async function finalise(documentId: string) {
    "use server";
    return markDocumentFinal(documentId);
  }

  return (
    <>
      <PageHeader
        title="Tailoring studio"
        description={`${job.title}${job.companyName ? ` · ${job.companyName}` : ""}`}
        actions={<LinkButton href={`/jobs/${job.id}`}>Back to job</LinkButton>}
      />

      <TailorStudio
        jobId={job.id}
        jobTitle={job.title}
        companyName={job.companyName}
        jdText={job.rawDescription}
        extractedSkills={extracted}
        positioningAngle={job.positioningAngle}
        riskNotes={job.riskNotes}
        documents={documents}
        rankedAtoms={rankedAtoms}
        actions={{ newCv, newLetter, aiTailor, aiLetter, save, remove, finalise }}
      />
    </>
  );
}
