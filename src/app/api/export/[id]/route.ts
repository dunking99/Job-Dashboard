import { NextResponse } from "next/server";
import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } from "docx";
import { prisma } from "@/lib/db";
import { parseJson, slugify } from "@/lib/utils";
import { emptyCv, type CvStructure, type CoverLetterStructure } from "@/lib/cv";

// Export a document as .docx or .txt.
//
// The .docx is deliberately plain: one column, no tables, no text boxes, no
// header/footer regions. Those are the things that scramble ATS parsing, and a
// CV that looks striking but parses to gibberish is worse than a plain one.

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const format = searchParams.get("format") ?? "txt";

  const doc = await prisma.document.findUnique({ where: { id } });
  if (!doc) return new NextResponse("Not found", { status: 404 });

  const base = slugify(doc.label || "document") || "document";

  if (format === "txt") {
    return new NextResponse(doc.renderedText, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Content-Disposition": `attachment; filename="${base}.txt"`,
      },
    });
  }

  if (format === "md") {
    return new NextResponse(doc.renderedText, {
      headers: {
        "Content-Type": "text/markdown; charset=utf-8",
        "Content-Disposition": `attachment; filename="${base}.md"`,
      },
    });
  }

  if (format !== "docx") {
    return new NextResponse("Unsupported format", { status: 400 });
  }

  const children: Paragraph[] =
    doc.kind === "CV"
      ? buildCvParagraphs(parseJson<CvStructure>(doc.structure, emptyCv()))
      : buildLetterParagraphs(parseJson<CoverLetterStructure>(doc.structure, {
          recipient: "", organisation: "", subject: "", salutation: "",
          paragraphs: [], signOff: "", senderName: "",
        }));

  const file = new Document({
    styles: {
      default: {
        document: {
          run: { font: "Calibri", size: 22 }, // 11pt
          paragraph: { spacing: { line: 276 } },
        },
      },
    },
    sections: [
      {
        properties: {
          page: { margin: { top: 850, bottom: 850, left: 850, right: 850 } },
        },
        children,
      },
    ],
  });

  const buffer = await Packer.toBuffer(file);

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="${base}.docx"`,
    },
  });
}

function buildCvParagraphs(cv: CvStructure): Paragraph[] {
  const out: Paragraph[] = [];
  const h = cv.header;

  if (h.fullName) {
    out.push(
      new Paragraph({
        children: [new TextRun({ text: h.fullName, bold: true, size: 32 })],
        alignment: AlignmentType.LEFT,
        spacing: { after: 60 },
      })
    );
  }
  if (h.headline) {
    out.push(
      new Paragraph({
        children: [new TextRun({ text: h.headline, size: 22 })],
        spacing: { after: 60 },
      })
    );
  }

  const contact = [h.email, h.phone, h.location, h.linkedIn, h.website].filter(Boolean);
  if (contact.length) {
    out.push(
      new Paragraph({
        children: [new TextRun({ text: contact.join(" | "), size: 20 })],
        spacing: { after: 200 },
      })
    );
  }

  for (const section of cv.sections) {
    const hasBody = Boolean(section.body?.trim());
    if (!hasBody && section.items.length === 0) continue;

    out.push(
      new Paragraph({
        text: section.heading,
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 240, after: 100 },
      })
    );

    if (hasBody) {
      out.push(new Paragraph({ text: section.body!.trim(), spacing: { after: 120 } }));
    }

    for (const item of section.items) {
      const heading = [item.headline, item.subheadline].filter(Boolean).join(", ");
      const right = [item.location, item.dates].filter(Boolean).join(" | ");
      out.push(
        new Paragraph({
          children: [
            new TextRun({ text: heading, bold: true }),
            ...(right ? [new TextRun({ text: `  —  ${right}`, italics: true })] : []),
          ],
          spacing: { before: 120, after: 40 },
        })
      );
      for (const bullet of item.bullets) {
        if (!bullet.text.trim()) continue;
        out.push(
          new Paragraph({
            text: bullet.text.trim(),
            bullet: { level: 0 },
            spacing: { after: 40 },
          })
        );
      }
    }
  }

  return out;
}

function buildLetterParagraphs(letter: CoverLetterStructure): Paragraph[] {
  const out: Paragraph[] = [];

  if (letter.subject) {
    out.push(
      new Paragraph({
        children: [new TextRun({ text: letter.subject, bold: true })],
        spacing: { after: 240 },
      })
    );
  }
  if (letter.salutation) {
    out.push(new Paragraph({ text: letter.salutation, spacing: { after: 200 } }));
  }
  for (const paragraph of letter.paragraphs) {
    if (!paragraph.trim()) continue;
    out.push(new Paragraph({ text: paragraph.trim(), spacing: { after: 200 } }));
  }
  if (letter.signOff) {
    out.push(new Paragraph({ text: letter.signOff, spacing: { before: 120, after: 40 } }));
  }
  if (letter.senderName) {
    out.push(new Paragraph({ text: letter.senderName }));
  }

  return out;
}
