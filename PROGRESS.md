# PROGRESS.md — Job Engine handoff

Written for a fresh session with zero memory of prior conversation. Read this
before touching anything.

---

## Goal

Build a fully integrated, local-first job search / application / tailoring /
interview-prep dashboard for a 21-year-old graduate (BSc Politics with
Economics, University of Bath) targeting public policy roles (Civil Service,
think tanks, NGOs). The explicit brief: "don't be shy, don't do a half-assed
job" — a comprehensive tool, not an MVP.

---

## Status — what's done and verified working

**Everything is built, committed, pushed, and was verified running in a real
browser (Playwright) against the production build.** Branch:
`claude/document-analysis-5g1dd5`. Latest commit: `5bfe7ed`.

### Architecture (locked in, do not re-derive)

Next.js 15 App Router + React 19 + Tailwind v4 + Prisma 6 + SQLite. No cloud
services. Anthropic SDK is an optional dependency (see AI section below).

- `prisma/schema.prisma` — the full data model. 20 models. Read this file
  first in any new session — it is the map of everything else.
- SQLite via `DATABASE_URL="file:./dev.db"` in `.env` (gitignored — see
  Gotchas).

### The two design principles everything follows from

1. **One experience bank, three registers.** `ExperienceAtom` (one job/project/
   dissertation/etc.) has `BulletVariant` children tagged by `register`
   (`CV`, `CV_SHORT`, `COVER_LETTER`, `INTERVIEW`). A fact is written once and
   reused everywhere — CV bullets, cover-letter lines, and spoken interview
   answers are all pulled from the same atom rather than maintained separately.
   STAR fields (`starSituation/Task/Action/Result`) live directly on the atom
   for the same reason — no separate story bank.

2. **Deterministic core, optional AI layer.** Match scoring
   (`src/lib/matching.ts`), red-flag detection (`src/lib/redflags.ts`), ATS
   analysis (`src/lib/ats.ts`), requirement extraction (`src/lib/text.ts`), and
   baseline CV composition (`composeCv` in `src/app/actions/documents.ts`) are
   **all pure functions with zero AI dependency**. Verified: composing a CV
   from the seeded bank with no AI call produces a 96/100 ATS score and 100%
   keyword coverage. AI only adds phrasing/judgment on top; it is never required
   for the app to be useful.

### Pages (all built, all routes return 200, all smoke-tested)

| Route | File | Purpose |
|---|---|---|
| `/` | `src/app/(app)/page.tsx` | Command centre — computed action queue, funnel, weekly activity chart |
| `/experience` | `src/app/(app)/experience/page.tsx` | Experience bank list |
| `/experience/[id]` | `.../experience/[id]/page.tsx` | Atom editor + bullet register editor |
| `/experience/new` | `.../experience/new/page.tsx` | New atom form |
| `/experience/import` | `.../experience/import/page.tsx` | Paste-a-CV → AI extraction into atoms |
| `/experience/skills` | `.../experience/skills/page.tsx` | Skill claiming/proficiency + market-gap panel |
| `/jobs` | `.../jobs/page.tsx` | Job list, filterable/sortable by score/status/deadline |
| `/jobs/new` | `.../jobs/new/page.tsx` | Paste-a-JD capture form |
| `/jobs/[id]` | `.../jobs/[id]/page.tsx` | Job detail: score breakdown, gaps, red/green flags, JD viewer with highlighting |
| `/jobs/[id]/tailor` | `.../jobs/[id]/tailor/page.tsx` | Tailoring studio — the centrepiece |
| `/pipeline` | `.../pipeline/page.tsx` | Drag-and-drop kanban (native HTML5 DnD, no library) |
| `/companies` , `/companies/[id]`, `/companies/new` | | Company dossiers |
| `/interview` | `.../interview/page.tsx` | Predicted questions + practice mode + STAR library |
| `/contacts` | `.../contacts/page.tsx` | CRM |
| `/analytics` | `.../analytics/page.tsx` | Funnel, source conversion, match-score-vs-reply-rate, market gaps |
| `/settings` | `.../settings/page.tsx` | Profile form, AI mode status, bridge queue, danger zone |
| `/print/[id]` | `src/app/print/[id]/page.tsx` | Bare (no nav) print view → browser "Save as PDF" |
| `/api/export/[id]` | `src/app/api/export/[id]/route.ts` | `.docx` (via `docx` npm package) and `.txt` export |
| `/api/backup` | `src/app/api/backup/route.ts` | Full JSON data export |

### AI dual-mode (both paths tested end-to-end)

Every AI action goes through `runAi()` in `src/lib/ai/client.ts`:
- **API mode**: `ANTHROPIC_API_KEY` set in `.env` → calls Anthropic directly,
  one click.
- **Bridge mode** (default, no key): builds the exact same prompt, stores it as
  a `PENDING` `AiCall` row, returns it to the client. `AiAction.tsx` /
  `BridgeDialog` shows a copy-this-prompt box + paste-the-reply-back box.
  Submitting calls `submitBridgeResponse()` in `src/app/actions/ai.ts`, which
  routes to the same `apply*()` function the API path would have called
  (`applyJobAnalysis`, `applyCvImport`, `applyTailoring`, etc.) — **one code
  path, not two**. This was tested with a fake pasted JSON response and
  confirmed it writes through correctly (fitSummary, positioning angle, and
  domain tags all applied).

Prompt builders live in `src/lib/ai/prompts.ts` — 8 prompt types
(`JOB_ANALYSIS`, `CV_TAILOR`, `COVER_LETTER`, `COMPANY_DOSSIER`, `QUESTIONS`,
`ANSWER_FEEDBACK`, `ATOM_EXTRACT`, `BULLET_REWRITE`), each with a Zod schema
for validating the response. All prompts share a `HOUSE_RULES` system prompt
block that explicitly forbids fabricating metrics/dates/employers and
instructs the model to be blunt about weak fit rather than encouraging.

### Match scoring (5 components, `src/lib/matching.ts::computeMatch`)

| Component | Max | Notes |
|---|---|---|
| Skill coverage | 35 | Essentials weighted double |
| Evidence depth | 25 | Skill claimed on a `Skill` row is not enough — must be linked via `AtomSkill` to an actual bullet |
| Domain alignment | 15 | Overlap between job's tagged `Domain`s and atoms' `Domain`s |
| Seniority fit | 15 | `yearsOfExperience()` in `src/lib/candidate.ts` vs. years extracted from JD text |
| Target alignment | 10 | Job title/sector vs. `Profile.targetRoles`/`targetSectors` |

Gaps are classified `NO_SKILL` (not claimed) / `NO_EVIDENCE` (claimed, no
bullet) / `WEAK_EVIDENCE` — this distinction is intentional and drives the UI
copy ("claimed, no bullet" is flagged as the easy fix).

### Verified via browser automation (Playwright + Chromium, headless)

- Every route returns 200, dark and light theme, no console/page errors.
- Full tailoring flow: compose CV from bank (no AI) → 10 bullets, 96 ATS score,
  100% coverage.
- Export formats: `.txt` (plain), `.docx` (confirmed via `file` command as a
  genuine "Microsoft Word 2007+" zip, not garbage), print route 200s.
- `/api/backup` returns valid JSON (~110KB with demo data).
- Bridge-mode round trip: opened dialog, filled fake AI JSON response, applied
  it, confirmed the job page updated with the new fitSummary/positioning
  angle/domain tags.
- Cold `npm run setup` (with `.env` deleted first) succeeds and creates a
  working `.env`.

---

## In progress

**Nothing is mid-implementation.** The last two turns of the previous session
were UI polish, not partial features:
- Removed then **reverted** a placeholder string in
  `src/components/AtomForm.tsx` line 91 (the Title field placeholder
  `"Dissertation — regional inflation and voting"`) — the user only wanted to
  know the file location, not have it edited. It is back in place as of commit
  `5bfe7ed`. **Do not remove it again unless explicitly asked to.**

There is no unfinished feature branch, no half-wired component, nothing
stubbed out. If you're picking this up, the codebase is in a complete,
working state.

---

## Next steps (only if the user asks — nothing here is queued/expected)

If the user wants to keep building, likely asks in rough priority order based
on the conversation:
1. **Deploy it to a real URL.** Discussed but not started. See "Open
   questions" below — needs a hosting decision first.
2. **Add authentication.** Currently zero auth — anyone with the URL/localhost
   port sees and can edit everything. Only matters once it's deployed publicly
   (see Gotchas).
3. Whatever UI polish the user asks for as they actually use it with real data
   — the demo dataset was only ever a smoke-test fixture, not a design
   reference.

---

## Key decisions and why

**SQLite over Postgres.** Chosen because this is explicitly a local-first,
single-user tool — no need for concurrent-write handling, and SQLite means
zero setup (no separate DB server, no connection string juggling) for a
non-technical end user running this on their own laptop. Trade-off (relevant
if deploying): most serverless hosts (Vercel) don't give SQLite a persistent
disk. Documented but not acted on — see Open Questions.

**Deterministic scoring before AI.** Decided early and never revisited: if the
match score, ATS check, and gap analysis required an API call, the tool would
be useless the moment a key wasn't configured or a rate limit hit, and every
re-score would cost money and vary run-to-run. All five score components are
pure functions over the database state. AI is additive judgment, never
load-bearing.

**Bridge mode instead of "AI features disabled without a key."** The user
explicitly said they'd rather pipe AI calls through their existing Claude Pro
subscription than pay per-API-call (see original planning conversation).
Rather than build a second, worse code path for "no key" mode, `runAi()`
persists the prompt as a `PENDING` AiCall and both the API response and the
pasted-back bridge response flow through the identical `apply*()` functions.
This was a deliberate architectural choice, not a fallback bolted on later.

**CV headline uses `cvHeadlineFor()` (`src/lib/cv.ts`), not `atom.role`.** For
`ACADEMIC`/`PROJECT`/`CERTIFICATION` category atoms, the role field is usually
generic ("Student", "Undergraduate researcher") while `title` carries the
actual substance ("Dissertation — regional inflation exposure..."). For
`WORK`/`LEADERSHIP`/`VOLUNTEER`, it's the reverse — role ("Research &
Casework Intern") is the meaningful headline. This was a real bug found during
verification (see Gotchas) and fixed by branching on category.

**Route group `(app)`** (`src/app/(app)/`) separates the app shell (nav
sidebar, theme) from `/print/[id]`, which must render bare with nothing but
the document — that's literally what gets saved as the PDF via the browser's
print dialog. `src/app/layout.tsx` is now just the HTML document shell;
`src/app/(app)/layout.tsx` adds the `<Nav>` and scroll container.

**No categorical color palette needed** — every chart in this app is
single-series or ordinal (funnel stages, weekly activity, score bands), so
the dataviz work used the validated *ordinal blue ramp* + *status palette*
only, not the 8-hue categorical set. Palette tokens are in
`src/app/globals.css` as CSS custom properties (`--ramp-1` through `--ramp-7`,
`--good/warning/serious/critical`, `--s1/s2/s3` for the ≤3-series cases).
Validated via the dataviz skill's `validate_palette.js` script before use —
don't re-invent colors, reuse these tokens.

---

## Rejected approaches — don't re-litigate these

- **Chrome extension for job capture.** Considered (it was in the original
  Gemini-transcript brainstorm the user shared). Rejected: real build surface
  for marginal gain over paste-in, which works on every site including PDFs
  and emailed job packs that a scraper couldn't touch anyway.
- **Live multi-board job scraping** ("pull from every job board automatically",
  requested in the original planning chat). Rejected: fragile, ToS-risky for a
  solo local tool, high maintenance. Paste-in was chosen instead.
- **LinkedIn network/alumni mapping.** Rejected for the same ToS/fragility
  reason.
- **Voice-mode mock interviews.** Deferred as a v2 nice-to-have; text-based
  practice with structural + AI feedback was built instead
  (`src/lib/answers.ts` + `QuestionBank.tsx` practice dialog).
- **A drag-and-drop library for the kanban board.** Used native HTML5
  drag-and-drop instead (`KanbanBoard.tsx`) — this is a desktop tool with a
  simple card-to-column interaction; a DnD dependency was judged unnecessary
  weight.
- **Nesting the AI result under a wrapper key** (`{ ai: result }` instead of
  spreading `result` at the top level). This was a real bug — see Gotchas —
  fixed by always spreading AI action results at the top level of whatever the
  server action returns, because `AiAction.tsx` / `TailorStudio.tsx` look for
  `mode`/`bridgePrompt`/`callId` directly on the returned object.

---

## Gotchas — non-obvious things discovered the hard way

1. **`.env` is gitignored but the app hard-depends on it for `DATABASE_URL`.**
   A fresh clone with no `.env` fails every Prisma command with a validation
   error before the user has done anything wrong. Fixed with
   `scripts/ensure-env.mjs`, wired into `npm run env`, which runs ahead of
   `dev`/`setup`/`db:push` in `package.json` and copies `.env.example` →
   `.env` if missing. **If you add a new required env var, it needs to go in
   `.env.example` too or this bootstrap won't help.**

2. **Server Action modules (`"use server"` files) cannot export non-async
   functions.** `analyseAnswerStructure()` was originally inline in
   `src/app/actions/interview.ts` and broke the build with "Server Actions
   must be async functions." Moved to `src/lib/answers.ts` (a plain module) and
   imported. If you add a pure helper to any `src/app/actions/*.ts` file, it
   must itself be `async`, or it needs to live outside that file.

3. **Route-group folder names `(app)` don't cause routing bugs but caused a
   very confusing false alarm during verification.** After a rebuild while an
   old `next start` process was still running on the same port, the old HTML
   referenced JS chunk hashes that no longer existed on disk → every client
   component silently failed to hydrate (looked like "AI bridge dialog never
   opens", was actually "the button's onClick handler never attached"). Fix:
   always kill the old `next start`/`next-server` process before rebuilding,
   confirm the port is free, restart clean. Not an app bug — a test-process
   hygiene issue — but cost real debugging time before being understood
   correctly, so worth documenting.

4. **The AI result-shape bug.** `analyseJob()` in `src/app/actions/jobs.ts`
   originally returned `{ ok: true, score, ai: result }`. `AiAction.tsx`'s
   generic bridge-handling logic checks `result.mode === "BRIDGE"` at the
   top level of whatever the action returns. Nesting under `ai:` meant bridge
   mode silently never opened the paste-back dialog — no error, just nothing
   happened on click. Fixed by spreading: `return { ...result, ok: true,
   score: match.score }`. **Any new AI-triggering server action must spread
   the `runAi()` result at the top level of its return value, not nest it.**

5. **`extractSkills()` in `src/lib/text.ts` originally missed "Essential:"
   list-header requirements** — it only looked for requirement language
   ("must have", "essential") in the same sentence as a skill mention, which
   misses the extremely common JD pattern of a heading followed by a bulleted
   list. Fixed with `classifyLines()`, which tracks a running "current
   section" (`ESSENTIAL`/`DESIRABLE`/`NONE`) as it walks the JD line by line.
   If you touch skill extraction, preserve this — it's why "Essential: Stata"
   now correctly marks Stata as required even though the word "essential"
   isn't in the same sentence as "Stata".

6. **Prisma's `db push --force-reset` requires explicit user consent via an
   env var** (`PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION`) — it will not run
   from an agent session without it, even on an obviously-disposable local
   dev database. When you need to wipe demo data, delete rows directly via a
   script instead of trying to force-reset the schema (see how `prisma/seed.ts`
   itself avoids this — it upserts reference data and only ever creates/skips
   demo content, never resets).

7. **The seed script must self-score demo jobs.** Originally
   `prisma/seed.ts` created demo `Job` rows with `matchScore: null`
   (score only gets set by `analyseJobInternal()`, which is a server action
   the seed script — running outside Next.js — can't call). Fixed by adding
   `scoreAllJobs()` directly in the seed file, duplicating the scoring logic
   inline (imports `computeMatch`/`detectRedFlags`/`yearsOfExperience`
   directly rather than the server action). **If `computeMatch()`'s signature
   changes, `scoreAllJobs()` in `prisma/seed.ts` needs updating in lockstep —
   there's no shared call path between seed-time and runtime scoring.**

8. **Playwright wasn't preinstalled for this project** — had to
   `npm install --no-save playwright@1.56.0` to verification-test in a real
   browser. Chromium itself is already at `/opt/pw-browsers` per the sandbox
   env docs, so only the `playwright` npm package was missing.

---

## Open questions — unresolved, needs a decision before acting

1. **Where/how to deploy for a permanent URL.** Discussed at length but not
   decided or started. Two real options on the table:
   - **Fly.io / Railway with a persistent volume** — keeps SQLite exactly as
     built, minimal changes (Dockerfile + `fly.toml` + one volume command).
     This was the recommendation given, but the user hadn't confirmed it.
   - **Vercel + hosted Postgres** (Neon/Supabase) — more "standard" but
     requires changing `provider = "sqlite"` → `"postgresql"` in
     `prisma/schema.prisma` and repointing `DATABASE_URL`. Not started.
   Do not assume either — ask, since the trade-off (SQLite simplicity vs.
   Vercel familiarity) is a genuine user preference, not a technical
   correctness question.

2. **Authentication for a public deployment.** Flagged as a hard prerequisite
   for going live ("not optional" was said explicitly) but zero auth code
   exists. No decision made on approach (simple password middleware was
   suggested as sufficient for single-user, but not agreed or built).

3. **Custom domain.** Not purchased, not discussed beyond "you'd need one,
   ~£8-12/year."

None of these block anything — the app is fully functional locally via
`npm run dev` — they only block "a permanent link."

---

## File map

```
prisma/
  schema.prisma          # THE DATA MODEL. Read first. 20 models — Profile,
                          # ExperienceAtom, BulletVariant, Skill, AtomSkill,
                          # Domain, Competency, Company, Job, Document,
                          # Contact, Interaction, InterviewEvent,
                          # PredictedQuestion, PracticeAnswer, Task, AiCall,
                          # Setting.
  seed.ts                 # Seeds 16 policy domains, 14 competencies, 48-entry
                          # skill lexicon (always), + optional demo dataset
                          # (7 atoms, 3 companies, 3 pre-scored jobs, 1
                          # contact) unless SEED_DEMO=0. Self-scores demo jobs
                          # inline (see Gotcha #7).

scripts/
  ensure-env.mjs          # Bootstraps .env from .env.example if missing.
                          # Runs via `npm run env`, wired ahead of dev/setup.

src/lib/                  # DETERMINISTIC ENGINES — no AI, no React, pure
                          # functions over data. Read these to understand what
                          # the app actually computes.
  constants.ts             # All status/category vocabularies (JOB_STATUSES,
                          # ATOM_CATEGORIES, etc.) — single source of truth
                          # since SQLite has no native enums.
  db.ts                    # Prisma client singleton + getProfile()/getSetting()
  utils.ts                 # Date/string/number helpers (formatDate, pct, cn, etc.)
  text.ts                  # Requirement extraction: extractSkills(),
                          # extractYearsRequired(), extractSalary(),
                          # extractWorkMode(), extractDeadline(),
                          # SKILL_LEXICON (48 policy/econ/quant skills).
                          # classifyLines() is the essential/desirable
                          # section-tracker (Gotcha #5).
  matching.ts               # computeMatch() — the 5-component score.
                          # rankAtomsForJob() — ranks bank entries for tailoring.
                          # scoreBand() — 75+/55+/35+/under bands for UI.
  redflags.ts               # detectRedFlags() / detectGreenFlags() — regex
                          # rules over JD text, each returns quoted evidence.
  ats.ts                    # analyseAts() — CV-vs-JD keyword coverage +
                          # structural issues (length, passive openers, no
                          # quantified bullets, non-standard headings, tables).
  cv.ts                     # CV/cover-letter STRUCTURE types (not prose) —
                          # composable sections/items/bullets.
                          # cvHeadlineFor() — category-aware headline logic
                          # (Key Decisions above). renderCvText/Markdown(),
                          # renderCoverLetterText().
  candidate.ts               # yearsOfExperience() (excludes ACADEMIC atoms
                          # deliberately — see inline comment),
                          # buildCandidateSummary()/buildProfileSummary() —
                          # the prose descriptions fed to every AI prompt.
  analytics.ts               # getDashboardStats(), getWeeklyActivity(),
                          # getFunnelData(), getSourcePerformance(),
                          # getMarketGaps().
  actionQueue.ts             # buildActionQueue() — computed, NEVER stored
                          # (see design note in the file). buildFunnel().
  answers.ts                 # analyseAnswerStructure() — STAR/word-count/
                          # filler detection for interview practice, pure,
                          # no AI. Moved out of actions/interview.ts (Gotcha #2).
  bridge.ts                  # buildBridgePromptClient() — the one function
                          # both client and server bridge code need; kept
                          # dependency-free so it's importable client-side.

src/lib/ai/
  client.ts                 # runAi() — the dual-mode (API/bridge) adapter.
                          # extractJson() — robust JSON extraction from LLM
                          # text (handles fences, preamble, brace-matching).
                          # completeBridgeCall().
  prompts.ts                 # All 8 prompt builders + their Zod schemas.
                          # HOUSE_RULES shared system-prompt block (honesty >
                          # encouragement, no fabrication).

src/app/actions/          # SERVER ACTIONS — all mutations live here, grouped
                          # by domain. Every file starts "use server".
  jobs.ts                   # ingestJob(), analyseJobInternal() (the
                          # deterministic+optional-AI scoring pipeline),
                          # applyJobAnalysis(), updateJobStatus(),
                          # setJobDomains(), deleteJob().
  experience.ts              # saveAtom(), saveBullet(), generateBulletVariants(),
                          # importFromCv()/applyCvImport() (AI CV extraction),
                          # upsertSkill().
  documents.ts               # composeCv() (deterministic baseline — see Key
                          # Decisions), createTailoredCv(), tailorWithAi()/
                          # applyTailoring(), createCoverLetter(),
                          # draftCoverLetterWithAi()/applyCoverLetter().
  crm.ts                     # Company + Contact + Interaction CRUD,
                          # researchCompany()/applyDossier() (AI dossier gen).
  interview.ts                # Interview scheduling, generateQuestions()/
                          # applyQuestions(), savePracticeAnswer()/
                          # applyAnswerFeedback().
  ai.ts                       # submitBridgeResponse() — THE ROUTER that
                          # dispatches a pasted bridge reply to the correct
                          # apply*() function by AiCall.kind. Central to the
                          # dual-mode design.
  settings.ts                  # saveProfile(), clearAllContent() (wipes user
                          # data, keeps reference vocab), exportEverything().
  tasks.ts                     # Manual Task CRUD (used by action queue).

src/app/(app)/             # ALL APP PAGES (nav-wrapped). See Status table
                          # above for the full route list.
  layout.tsx                  # Adds <Nav> + scroll container.

src/app/print/[id]/page.tsx  # Bare print view — NOT in the (app) group,
                          # deliberately, so it renders with no nav for
                          # browser print-to-PDF.
src/app/layout.tsx           # Root HTML shell only (theme script, <html>/<body>).

src/app/api/
  export/[id]/route.ts     # .docx (via `docx` npm lib) / .txt export.
  backup/route.ts           # Full JSON dump of all user data.

src/components/            # UI. Notable non-obvious ones:
  ui.tsx                     # Design-system primitives: Panel, Badge, Button,
                          # StatTile, Meter, ScoreChip, DataList, EmptyState.
  charts.tsx                  # Funnel, ActivityChart, ScoreBreakdown,
                          # StackedStrip, Sparkline — all single-series/
                          # ordinal, validated palette tokens only.
  AiAction.tsx                # THE shared AI-trigger button + BridgeDialog.
                          # Any new AI-triggering UI should reuse this rather
                          # than reimplementing bridge handling.
  TailorStudio.tsx             # THE centrepiece component — CV/cover-letter
                          # workspace with ranked-bank picker + live ATS panel.
  KanbanBoard.tsx              # Native HTML5 drag-and-drop pipeline board.
  AtomForm.tsx                  # Experience entry editor. Line 91 = the Title
                          # placeholder discussed in Gotchas/recent history.
  JdViewer.tsx                   # Renders JD text with requirement highlighting
                          # (splits on matched spans, never injects HTML —
                          # pasted JD text is untrusted input).

.env.example                # Template for .env — DATABASE_URL +
                          # ANTHROPIC_API_KEY (commented out) +
                          # ANTHROPIC_MODEL. Keep in sync with any new env var.
README.md                   # User-facing docs — setup, AI modes, page
                          # descriptions, match-score explanation.
```

---

## How to verify the app still works after changes

```bash
npm install
npm run setup      # generates client, creates db, seeds reference + demo data
npm run build      # must succeed with no TS errors
npx tsc --noEmit    # typecheck in isolation
npm run start       # production server on :3000
```

Smoke-test checklist used in the last verification pass (all passed):
- Every route in the Status table returns 200 in both themes, no console errors.
- `/jobs/[id]/tailor` → "Compose CV" produces a scored document with no AI.
- `/api/export/[id]?format=docx` returns a file `file` identifies as
  "Microsoft Word 2007+".
- Bridge dialog opens on an AI action button click and applying a pasted JSON
  response updates the underlying record.
- `rm .env && npm run setup` succeeds from a clean state.

If you have Playwright available (`npm install --no-save playwright@1.56.0` —
Chromium is already at `/opt/pw-browsers` in this sandbox), drive it headless
against `localhost:3000` rather than trusting `npm run build` alone — the
build passing does not catch client-side hydration failures (see Gotcha #3).
