import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { parseJson } from "@/lib/utils";
import { emptyCv, emptyCoverLetter, type CvStructure, type CoverLetterStructure } from "@/lib/cv";
import { PrintTrigger } from "@/components/PrintTrigger";

// The print route is the PDF export path: the browser's own "Save as PDF" gives
// a properly typeset, selectable-text document, which is exactly what an ATS
// needs — and better than anything a client-side PDF library would produce.

export default async function PrintPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const doc = await prisma.document.findUnique({ where: { id } });
  if (!doc) notFound();

  if (doc.kind === "COVER_LETTER") {
    const letter = parseJson<CoverLetterStructure>(doc.structure, emptyCoverLetter());
    return (
      <Sheet>
        {letter.subject && <p className="mb-6 font-semibold">{letter.subject}</p>}
        <p className="mb-5">{letter.salutation}</p>
        {letter.paragraphs.filter((p) => p.trim()).map((p, i) => (
          <p key={i} className="mb-4 leading-relaxed">{p}</p>
        ))}
        <p className="mt-6">{letter.signOff}</p>
        <p>{letter.senderName}</p>
      </Sheet>
    );
  }

  const cv = parseJson<CvStructure>(doc.structure, emptyCv());
  const h = cv.header;
  const contact = [h.email, h.phone, h.location, h.linkedIn, h.website].filter(Boolean);

  return (
    <Sheet>
      <header className="mb-5">
        {h.fullName && <h1 className="text-[22pt] font-bold leading-tight">{h.fullName}</h1>}
        {h.headline && <p className="mt-0.5 text-[11pt]">{h.headline}</p>}
        {contact.length > 0 && (
          <p className="mt-1 text-[9.5pt]">{contact.join(" | ")}</p>
        )}
      </header>

      {cv.sections.map((section) => {
        const hasBody = Boolean(section.body?.trim());
        if (!hasBody && section.items.length === 0) return null;
        return (
          <section key={section.id} className="mb-4">
            <h2 className="mb-1.5 border-b border-black/30 pb-0.5 text-[11pt] font-bold uppercase tracking-wide">
              {section.heading}
            </h2>

            {hasBody && <p className="mb-2 leading-relaxed">{section.body}</p>}

            {section.items.map((item, i) => (
              <div key={i} className="mb-2.5">
                <div className="flex items-baseline justify-between gap-3">
                  <p className="font-semibold">
                    {[item.headline, item.subheadline].filter(Boolean).join(", ")}
                  </p>
                  <p className="shrink-0 text-[9.5pt] italic">
                    {[item.location, item.dates].filter(Boolean).join(" | ")}
                  </p>
                </div>
                <ul className="mt-0.5 list-disc pl-5">
                  {item.bullets
                    .filter((b) => b.text.trim())
                    .map((bullet, bi) => (
                      <li key={bi} className="mb-0.5 leading-snug">{bullet.text}</li>
                    ))}
                </ul>
              </div>
            ))}
          </section>
        );
      })}
    </Sheet>
  );
}

function Sheet({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-[190mm] bg-white p-10 text-[10.5pt] text-black print-sheet">
      <PrintTrigger />
      {children}
    </div>
  );
}
