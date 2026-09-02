# Job Engine

A local-first job search, tailoring and interview-prep system. Runs on your own
machine, stores everything in a single SQLite file, and works with or without an
AI API key.

Built for a graduate search in politics/public policy — the skill lexicon, policy
domain tags and Civil Service competency framework reflect that — but nothing in
the architecture is specific to one field.

---

## The idea it is built around

Everything downstream is a **projection of one experience bank**.

A CV bullet, a cover-letter sentence and a spoken interview answer are three
*registers* of the same fact. So facts are stored once, as tagged atomic entries,
and documents are **composed** from them rather than hand-maintained in parallel.
That is what makes tailoring cheap: given a job description, the engine ranks
which entries to lead with instead of rewriting a document from scratch.

The second principle: **the useful parts do not need AI.** Match scoring, gap
analysis, red-flag detection, ATS scanning and CV composition are all
deterministic. They give the same answer twice, they explain their working, and
they run with no key and no network. AI improves phrasing and adds judgement on
top — it is never load-bearing.

---

## Getting started

```bash
npm install
npm run setup     # generate client, create the database, seed reference data + a demo dataset
npm run dev       # http://localhost:3000
```

`npm run setup` seeds 16 policy domains, 14 competencies, a 48-entry skill
lexicon, and a small worked example (7 experience entries, 3 scored jobs) so the
app is alive on first run. Clear the demo content from **Settings → Delete all
content** when you are ready to put your own material in, or seed without it:

```bash
SEED_DEMO=0 npm run setup
```

To start from your own CV instead of typing everything in, use
**Experience → Import from CV** and paste it.

### The two AI modes

| | |
|---|---|
| **Bridge mode** (default, no key) | Every AI action builds a complete prompt for you to copy into Claude. Paste the reply back and it lands in exactly the same place an API response would. Nothing leaves your machine automatically. |
| **API mode** | Put `ANTHROPIC_API_KEY` in `.env` and restart. The same actions run in one click. Costs a fraction of a penny per call. |

Bridge mode is not a degraded fallback bolted on afterwards — it is why every AI
result is persisted as an `AiCall` row with a target. Both modes write back
through the same `apply*` function, so there is no second, weaker code path.

---

## The pages

| Page | What it is for |
|---|---|
| **Command** | Today's state. A computed action queue (deadlines, stale applications, unprepped interviews), the funnel, weekly pace against target. |
| **Experience** | The source of truth. Atomic entries, each tagged with skills, policy domains and competencies, with phrasings per register and STAR fields. |
| **Jobs** | Everything captured, scored and sorted by match. Paste a description; requirements, salary, work mode and closing date are extracted automatically. |
| **Tailoring studio** | Split view: your ranked bank, the CV being composed, and a live ATS panel. Every bullet is traceable to the entry it came from. |
| **Pipeline** | Drag-and-drop kanban. Moving to Applied stamps the date the analytics are computed from. |
| **Companies** | A dossier per employer, kept separate from any one application so research pays off again next time. |
| **Interview** | Predicted questions mapped to the entries that answer them, plus practice with structural checking and honest feedback. |
| **Contacts** | Recruiters, referrers, conversation log. Logging contact updates "last contacted" so follow-up prompts stay honest. |
| **Analytics** | Funnel, weekly pace, source conversion, whether match score actually predicts replies, and what the market wants that you cannot yet evidence. |

---

## How the match score works

Five components, each reported with its evidence, out of 100:

| Component | Max | What it measures |
|---|---|---|
| Skill coverage | 35 | Named skills present in your claimed set. Essentials count double. |
| Evidence depth | 25 | How many of the top requirements are backed by an actual bullet, not just a claim. |
| Domain alignment | 15 | Overlap between the job's policy domains and your experience. |
| Seniority fit | 15 | Years demanded vs. years held. A grad applying to a 5-year role is told plainly. |
| Target alignment | 10 | Whether the title and sector match your stated targets. |

A single opaque number is not actionable, so the score is always decomposed. Low
evidence depth means *go and write bullets*; a seniority penalty means the role is
a genuine stretch and you should decide that consciously. Gaps distinguish
"not claimed" from "claimed but nothing demonstrates it" — the second is a
ten-minute fix and the first usually is not.

Scoring runs against the bank *as it is now*, so after adding several entries use
**Settings → Rescore every job**.

---

## Notable behaviour

- **Red flags quote their evidence.** Every warning shows the phrase in the
  posting that triggered it, so you can disagree with it.
- **The action queue is computed, never stored.** Items vanish on their own when
  the underlying fact changes. Stored to-do lists drift and then get ignored.
- **Nothing is invented.** Every AI prompt forbids fabricating metrics, dates or
  employers. The CV importer transcribes vagueness faithfully and flags what
  needs a number rather than quietly upgrading it into a claim you would have to
  defend in an interview.
- **AI is told to be honest, not encouraging.** A tool that rates every job a
  strong match and every practice answer "great, just add detail" costs you the
  ability to triage.
- **Exports are ATS-shaped.** Single column, literal standard headings, contact
  details in the body — the things that actually scramble parsers. `.docx`,
  `.txt`, Markdown, and print-to-PDF (which keeps text selectable).

---

## Stack

Next.js (App Router) · React · Tailwind v4 · Prisma + SQLite · Anthropic SDK
(optional). No cloud services, no accounts, no telemetry.

Chart colours come from a palette validated for colour-vision deficiency
separation, lightness band, chroma floor and contrast against both the light and
dark surfaces. Substituting a hue means re-running that validation.

```
prisma/schema.prisma   data model — read this first
src/lib/               the deterministic engines (matching, ats, redflags, text, cv)
src/lib/ai/            prompt builders and the dual-mode adapter
src/app/actions/       server actions (all mutations)
src/app/(app)/         the application pages
src/components/        UI
```

## Your data

It is a file: `prisma/dev.db`. Copy it to back it up. **Settings → Export
everything as JSON** produces a complete dump. Both are gitignored.
