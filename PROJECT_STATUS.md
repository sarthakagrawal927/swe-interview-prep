# swe-interview-prep — PROJECT_STATUS

Last updated: 2026-09-07

## Exercise qualification

The drill editor now restores asynchronously loaded saved code without
replacing a learner's edits, and changing drills creates a fresh workspace.
[The executable evidence and limits](docs/knowledge/exercise-persistence-qualification.md)
cover actual grading, local completion storage and remount. The follow-up
[#98](https://github.com/Significant-Hobbies/swe-interview-prep/issues/98) repair
adds durable account-scoped outboxes, retry status, and atomic operation receipts
for drill/artifact/project writes. Actual handlers run against isolated SQLite
in the persistence tests, including failed writes, lost acknowledgements, delayed
responses, storage failure, reload, and account isolation. Full `pnpm quality`
passed 607 tests across 95 files; the final rollback test passed in the
11-test handler/import run.

Apply additive D1 migration `0003_record_sync_receipts.sql` before a future
approved deployment. Hosted qualification, mobile/editor interaction, and
concurrent-tab/cross-device behavior remain
[#97](https://github.com/Significant-Hobbies/swe-interview-prep/issues/97).
The repair covers one active tab and excludes notes/mastery/ELO sync.
No deployment or existing learner-data mutation occurred.

## Why/What

SWE Interview Prep is a single-platform interview prep and Fleet learning
product covering DSA, low-level design (LLD), system design (HLD), behavioral
practice, systems/platform engineering, AI-native engineering, developer tools,
application engineering, and multimodal/spatial computing. It combines Monaco
coding, Excalidraw diagramming, multi-provider AI hints, spaced repetition,
LeetCode import, progress tracking, and pattern-based learning. Deployed on
Cloudflare Pages with Pages Functions backend.

Out of scope: ATS/job-application features, Vercel/serverless migration, and new auth providers until the Cloudflare path is stable.

## Dependencies

| Layer | Choice |
|-------|--------|
| Frontend | React 19, Vite, React Router, Tailwind CSS |
| Editor / viz | Monaco Editor, Excalidraw; TypeScript runs in-browser (sucrase); Go via client-side WASM interpreter (R2-hosted) with `/api/go-run`→go.dev fallback |
| Backend | Cloudflare Pages Functions (`functions/api/[[path]].js`) — serves `auth/*`, `progress`, `learning`, `learning/reader`, `mcp/daily`, `mcp/progress`, `mcp/verification`, `ai` |
| Database | Cloudflare D1 — user progress, notes, FSRS concept mastery, imported problems |
| Auth | Google One Tap → JWT httpOnly cookie |
| AI | Vercel AI SDK via `@ai-sdk/openai-compatible` against a BYO endpoint; in-process Vite dev AI bridge (claude/codex/gemini CLIs, no keys) |
| SRS | ts-fsrs (FSRS algorithm — not SM-2) |
| Analytics | PostHog (local `posthog-js` wrapper) |
| Deploy | Cloudflare Pages (`swe-interview-prep`) + Functions |
| CI | GitHub Actions — `ci.yml` on push/PR; `deploy.yml` manual (`workflow_dispatch`) |

**Local dev:** `pnpm install && cp .env.example .env.local && pnpm dev`

**Key checks:** `pnpm build` · frontend typecheck · auth/API smoke per README

```
React SPA (Vite)
    │
    ├── Monaco + Go WASM code execution (R2 asset)
    ├── Excalidraw diagrams
    ├── AI hints (useAI) ──► OpenAI-compatible endpoint (server) OR in-process Vite dev bridge (/api/chat not served by prod Function)
    ├── Progress + FSRS hooks ──► D1 via Functions (/api/progress, /api/learning)
    └── Google One Tap ──► /api/auth/google ──► JWT cookie

D1 tables (19): users, user_progress, user_notes, user_chats, user_imported_problems, concept_mastery, activity_log, … (source: migrations/d1)
External: LeetCode API (import), multi-provider LLM APIs
```

**Dev bridge:** `vite-plugin-local-ai.js` — a dev-only Vite plugin (`apply: 'serve'`) that mounts `/api/chat` (streams the claude/codex/gemini CLIs over SSE) plus in-memory stubs for chats/progress/notes/auth. Runs in-process with Vite (no separate server, no proxy hop), ships nothing to prod. `codex` runs read-only/ephemeral on `codex login` — no API keys for local iteration. Replaced the former `local-ai` git submodule (2026-06-27).

**Security posture (post-audit):** the `/api/go-run` handler requires auth (`requireAuth`); JWT secret has no production fallback (throws if unset); progress syncs to D1 for authenticated users (localStorage offline fallback retained). Note: the legacy `api/chat.mjs`/`api/go-run.mjs` handlers are dev-only and are not deployed by the prod Pages Function.

| Concern | Detail |
|---------|--------|
| Hosting | Cloudflare Pages project `swe-interview-prep` |
| Database | Cloudflare D1 — authoritative native `DB` binding in Pages Functions; retired Turso database deleted 2026-08-02 |
| Auth | Google OAuth; set callback URLs for localhost and production Pages domain |
| R2 | `swe-interview-prep-assets` — Go WASM binary |
| AI keys | Provider keys in Pages env; dev uses in-process Vite AI bridge (CLI, no keys) |
| Deploy | Manual: `deploy.yml` (`workflow_dispatch`) or `pnpm deploy` (no push-to-`main` auto-deploy) |
| Local full stack | `pnpm dev` (Vite + in-process AI bridge) |
| Security | Never commit `.env.local`; parameterized SQL throughout |

## Timeline

| Phase | Milestone |
|-------|-----------|
| Product-owned Clarity source wiring (2026-08-31) | Added the distinct SWE Interview Prep Clarity project to the application shell and corrected the privacy surface to disclose both analytics services. No deployment ran. |
| Read-only ChatGPT learning connection (2026-08-30) | Shipped OAuth-bound `/api/mcp/daily` and `/api/mcp/progress` projections over the shared Streamable HTTP gateway. ChatGPT can retrieve one deterministic recovery, retention, or progression priority, inspect D1-backed concept/drill/explain-back/activity progress, and deep-link into the product. The connection cannot write progress or grant mastery; only product evidence, reviews, and accepted explain-backs change FSRS state. Product CI, code-only Pages deployment, gateway CI/deployment, protected-resource metadata, and unauthenticated fail-closed smokes pass. The developer-mode ChatGPT app is connected through the exact Auth0 audience and read permission; authenticated owner smokes returned a concrete daily lesson and the matching honest progress snapshot. ChatGPT's active `Daily SWE Lesson` task runs at 09:00 Asia/Kolkata and requests the progress-derived lesson, rationale, evidence, duration, and deep link without any mastery mutation. |
| Job-description role fit (2026-08-27) | Added a grounded `/learn/role-fit` workflow that maps exact phrases from a pasted job description onto canonical curriculum concepts, separates demonstrated, unverified, weak, and unsupported requirements, expands prerequisites, and activates a sanitized role target with a focused Sweep. Raw postings and provider responses are not persisted; deployment AI remains owner-only while guests may use complete BYOK configuration. |
| Fanout-inspired learning surfaces (local, 2026-08-20) | Added the complete 42-section Learn Inference companion path, searchable formula/notation reference, accessible concept topography, eight-source rotating paper programme, focused resumable study, three additional decision labs, scenario presets, and version-aware local drafts. Dashboard remains concept-first: failed practice and due retrieval still outrank progression and evidence-format selection. The size gate has since moved to per-chunk gzipped budgets on the first-load graph, which this expansion stays within. Local verification is recorded in GitHub issue #86; deployment remains separate. |
| First-paint stylesheet stability (2026-08-22) | Removed the build-only asynchronous stylesheet rewrite so production CSS loads through Vite's normal blocking link. The pinned shell reset remains as a stable React handoff instead of compensating for intentionally delayed application styles. Corrected the size gate to bound the four scripts in the generated first-load graph rather than summing click-loaded curriculum documents as initial JavaScript. |
| Fleet code-health baseline (2026-08-14) | Added one CI-enforced quality contract covering whole-source coverage, unused code, complexity, exact duplication, import cycles, severe advisories, suppression markers, docs, build, bundle size, and repository hygiene. Removed an orphan declaration, unused simulation helpers and public exports, and unused direct tooling dependencies; safe package updates reduced high advisories from 29 to six accepted transitive advisories. Remaining measured debt is explicit and can only move downward. |
| Harness and classic system-design expansion (2026-08-13) | Added a seven-build Harness Engineering roadmap with seven practice-backed atomic concepts and two measured synthesis projects. Expanded the structured Tradeoff catalog from 20 to 33 cases with unique IDs, proximity, nearby presence, routing, queues, metrics, ad clicks, hotel reservations, email, object storage, leaderboards, wallets, and exchange matching. The generated public curriculum now contains 19 tracks, 26 roadmaps, and 259 concept pages; all 473 tests, typecheck, docs validation, source reachability, and the production build pass. |
| Software Wars production launch (2026-08-13) | Shipped one-minute Blitz and thirty-minute Tradeoff flows, server-owned ratings and match state, challenge/history/result surfaces, concept/FSRS remediation, and a separate Cloudflare Worker control plane backed by Durable Objects, R2, Queues, and DLQ. The ranked server-only bank has 1,200 independently audited active MCQs across 12 topics, 4,800 option-specific explanations, canonical Learn links, 424 reachable authoritative sources, and 3,600 precomputed answers across three fixed AI opponents. The additive D1 migration, Pages service binding, signed Worker bootstrap, and production RealtimeKit application are live; CI, deploy smoke, Worker health, and the public Wars status endpoint pass. Ranked flags remain off until the two-account acceptance smoke is complete. |
| Code-only release safety (2026-08-09) | The manual deploy workflow now leaves D1 unchanged by default and requires an explicit `apply_migrations` dispatch choice for schema releases, so code-only releases can use the normal GitHub-held build configuration without performing an unnecessary database operation. |
| Shared lint baseline (2026-08-09) | Adopted the Fleet Ultracite baseline for core TypeScript, React, and Vitest code. Existing generated/static artifacts remain outside the checked surface, and compatibility exceptions preserve current product behavior while 345 files pass with zero diagnostics. |
| Trace a Tensor synthesis (2026-08-09) | Added a compact 30-day roadmap that follows one workload from representation and backpropagation through memory hierarchy, runtime profiling, inference hardware, GPU kernels, quantization, engine scheduling, batching, and serving economics. It reuses 11 canonical concepts and their executable drills, then requires a layer map, reproducible workload or model, bottleneck diagnosis, and before/after evidence for one defended optimization. The interactive roadmap and deterministic public curriculum share the same source. |
| AI-native foundations path (2026-08-06) | Added a compact Learn-page orientation from machine foundations through parallel DSA and AI engineering into system-design synthesis. The path reuses canonical roadmaps, adds data-representation and program-memory concepts plus a measurable raw-socket HTTP capstone, and republishes the curriculum and agent-readable catalogs from the same source. Responsive browser review passed at 390, 768, and 1440 pixels with zero unresolved P0/P1 findings, a 34/40 critique, and a 19/20 audit. |
| Homepage clarity and search semantics (2026-07-31) | Made the generated JavaScript-independent homepage summary emit the page's canonical H1 and current 19-track/250-concept metadata. The Today workspace now leads with one explicit next step; source reading, secondary routes, and gap analysis start collapsed and expand with native disclosure controls. The feedback trigger is last in keyboard order, visibly focused, 44×44 through tablet widths, and protected by reserved compact-layout space. All visible controls meet 44px targets at 390, 768, and 1440px with no horizontal overflow, and the unconfigured web-vitals fallback no longer sends failing requests. The richer curriculum agent catalog remains intact; local format, lint, typecheck, 328 tests, production build, 36/40 critique, and 19/20 audit pass. Production deployment remains separate. |
| Owned changelog (2026-07-29) | Added a public `/changelog` with verified release outcomes and direct GitHub Roadmap and Source links. |
| Deterministic Systems Lab (2026-07-30) | Added a local-only `/labs` learning environment with versioned GitOps, OpenTelemetry sampling, and Managed Prometheus scenarios. Learners repair bounded infrastructure configurations, freeze predictions, replay virtual-time transitions, inspect actor-owned evidence, and must pass both configuration and authenticated Feynman gates before FSRS mastery can change. |
| D1 consolidation (2026-08-01) | Moved all 19 relational tables and 32 production rows from Turso to project-owned Cloudflare D1. Native Pages bindings, deterministic migrations, full table/signature parity, foreign-key verification, and live auth/API smoke checks passed; the retired source was deleted on 2026-08-02 after acceptance. |
| Platform migration | Cloudflare Pages static frontend + Pages Functions backend; D1 persistence; Google One Tap auth |
| Core study surfaces | DSA practice (Monaco), LLD/HLD (Excalidraw), behavioral/concept routes, Build Lab, Playground |
| Learning loops | Progress tracking across categories; ts-fsrs spaced repetition; multi-provider AI hints |
| Execution path | R2-backed Go WASM interpreter for in-browser code execution |
| Security hardening (2026-03-29) | Auth middleware on chat/go-run; JWT env guard; Turso progress sync; Google API key header fix (see `docs/archive/security-audit-2026-03-29.md`) |
| Ops polish (2026-06-20) | `.env.example`, Husky pre-commit, PostHog integration, README architecture docs |
| Feynman Gate → FSRS progression (2026-06-29) | Wired the explain-back gate into the default drill loop: drill → explain → mastery update → next weakest concept |
| Unified learning sources (2026-07-12) | Added reference-only catalogs for all 19 active Fleet projects, project roadmaps, research paths, private Reader saves, High Signal, and 14 embedded GitHub learning repositories. Owner-only 30-minute sessions support source selection, unlimited daily runs, end-of-session questions, and FSRS rescheduling. `posttrainllm` uses the `tinygpt` repository as its canonical source. |
| High Signal learning feed (2026-07-13) | Replaced the synthetic daily placeholder with a validated `high-signal.learning-brief.v1` adapter. Sync preserves source citations and retains the last good briefing with `stale` status on network/schema failure. External item detail now saves item-scoped takeaways and opens a prefilled Playground artifact prompt. |
| Reader dynamic-source closure (2026-07-13) | Added a credential-free versioned Reader fixture and wired the production proxy through the tested Bearer-authenticated adapter. Supported exports map deterministically without article bodies; 401/upstream/schema failures retain only last-good Reader items as stale. The final learning flow passed unit, type, build, desktop browser, and explicit 390×844 responsive checks. |
| Eleven-domain curriculum expansion (2026-07-25) | Personally requested expansion from 9 to 18 tracks and 152 to 222 concepts. Added 10 sequenced paths, 70 drills, 70 review prompts, 10 synthesis artifacts, and a machine-readable map covering all 96 requested systems, AI, developer-tooling, application, and multimodal subtopics while preserving all prior concept IDs. |
| Public curriculum discovery (2026-07-25) | Published a JavaScript-independent curriculum hub plus 18 track, 24 roadmap, and 222 concept pages. Every page has unique search/social metadata, structured data, substantive learning content, internal navigation, and exact sitemap coverage; compact Markdown and JSON catalogs expose the same hierarchy to AI agents. |
| Unified site navigation (2026-07-25) | Replaced three drifting navigation variants with one canonical primary/browse model. The homepage and application share one React header; all 265 generated curriculum pages receive the equivalent semantic HTML/CSS header with no executable JavaScript or backend dependency. |
| Learning-loop correctness (2026-07-25) | Unified guest/server FSRS confidence so failed reviews cannot appear mastered; made roadmap selection persist through the canonical profile; added track filtering and prerequisite milestones; graded drills/artifacts by evidence strength; exposed matching library sections on concepts; hid the unavailable Go runtime; and added an owner-authenticated production Socratic AI stream. Full tests, typecheck, lint, docs validation, and local build pass. |
| Curriculum source audit (2026-07-25) | Expanded all 222 concept reading lists with canonical papers and first-party engineering documentation, enforced the live source-tier rules against the checked-in catalog, and regenerated the public HTML, Markdown, JSON, sitemap, and agent catalogs from the same source. |

## Products

**Primary routes:** `/dashboard` (`/` redirects here) · `/learn` · `/practice` · `/wars` · `/mock` · `/playground` · `/progress` · `/build` (BuildLab) · `/library` · `/sources` · `/session/:date/:sessionId` · concept/roadmap/project detail pages. `/today` redirects to `/dashboard`.

**Primary API (prod Pages Function):** `/api/auth/google` · `/api/auth/logout` · `/api/auth/verify` · `/api/progress` · `/api/learning?action=…` · `/api/learning/reader` · `/api/mcp/daily` · `/api/mcp/progress` · `/api/mcp/verification` · `/api/ai` · `/api/ai/chat` · `/api/wars/*`. The chat stream is owner-authenticated and accepts BYOK or deployment AI configuration. `/api/chat`, `/api/chats`, `/api/notes`, `/api/problems`, `/api/go-run` are dev/legacy handlers, not served in prod.

| Surface | Role |
|---------|------|
| Dashboard | Study hub and navigation |
| Software Wars | One-minute source-backed MCQ battles and thirty-minute matched engineering battles with Learn/FSRS remediation |
| DSA practice | Monaco editor, pattern-based grouping, LeetCode import |
| LLD / HLD | Excalidraw architecture diagrams |
| Learn / concepts | Structured concept and roadmap content |
| Build Lab | Hands-on build exercises |
| Playground | Isolated coding sandbox |
| Progress | Completion rates across DSA, LLD, HLD, behavioral |
| Spaced repetition | Anki-style review with ts-fsrs scheduling |

## Features (shipped)

### Platform and deploy
- CI-enforced Fleet code-health ratchets across coverage, dead code, complexity, duplication, cycles, dependency advisories, suppression markers, documentation, builds, bundle size, and repository hygiene.
- Fleet Ultracite lint baseline for core TypeScript, React, and Vitest code with a clean 345-file check.
- Cloudflare Pages static frontend + Pages Functions backend in production architecture.
- **Core Web Vitals on the public root:** the generated curriculum summary is the initial-response shell and the LCP element on `/`, held until the lazy destination route commits, with its styles pinned against the asynchronously loaded stylesheet. Production five-run measurement: mobile-mid p75 LCP 1.22 s and CLS 0.010, desktop 656 ms and CLS 0.002, performance score 100 on both.
- Cloudflare D1 persistence for problems, notes, chats, and authenticated progress.
- Google One Tap auth with httpOnly JWT cookie issuance.
- R2-backed Go WASM interpreter for in-browser code execution path.
- PostHog analytics integration.
- Checked-in `.env.example` for required variables.
- Husky pre-commit hooks; Biome/ESLint toolchain.

### Core study surfaces
- **Trace a Tensor synthesis:** a 30-day cross-domain path connects representation and gradients to memory, runtime profiling, kernels, model formats, inference scheduling, and serving economics. Its capstone requires a layer map, reproducible workload or performance model, measured bottleneck, before/after evidence, and a defended optimization.
- **AI-native foundations path:** `/learn` presents one compact macro-sequence from machine foundations through parallel DSA and AI-engineering study into system-design synthesis while linking to the existing detailed roadmaps as the canonical learning plans.
- **Unified learning sources:** `/sources` indexes all 19 active Fleet project study queues and research-paper paths without copying canonical source bodies. The source catalog, source detail, and session routes require the configured owner Google account.
- **Adaptive daily sessions:** `/session/:date/:sessionId` creates a fresh 30-minute session. The owner can choose any populated source or use the balanced High Signal + due-learning plan, run unlimited sessions per day, answer questions at the end, and have recall quality scheduled through the existing FSRS implementation.
- **Private Reader adapter:** saved Reader articles load at request time through the authenticated server proxy. Article bodies and Reader credentials are never emitted into the static catalog or client bundle.
- **High Signal adapter:** the checked-in registry consumes the versioned compact daily feed, rejects unsupported payloads, and fails stale instead of inventing fresh content.
- **External learning handoff:** project, research, briefing, and Reader items can be studied in sessions, marked for FSRS review, saved into the notes store, and opened as a prefilled Playground exercise without changing native concepts.
- **Repository Library:** `/library` restores 14 embedded GitHub learning repositories with searchable source cards, original section hierarchy, and repository exercises in read/practice modes behind owner authentication.
- **DSA practice:** Monaco editor, pattern-based problem grouping (sliding window, two pointers, etc.), LeetCode import via API.
- **LLD / HLD:** Excalidraw integration for architecture diagrams on problem views.
- **Behavioral / concepts:** Learn and concept-detail routes with structured content paths.
- **Build Lab** and project-detail surfaces for hands-on build exercises.
- **Playground** isolated coding sandbox route.
- **Systems Lab:** versioned, deterministic GitOps, trace-sampling, and metrics-ingestion scenarios with no cluster, cloud, Git, credential, database, or shell connection. Each lab includes a broken-to-repaired configuration capstone; attempts preserve verified files, frozen predictions, and evidence locally. Guest mastery remains pending until authenticated explain-back grading.
- **Progress tracking:** completion rates across DSA, LLD, HLD, and behavioral categories (`useProgress`).
- **Spaced repetition:** Anki-style review flow with ts-fsrs scheduling (`useSpacedRepetition`, review pages).
- **Feynman Gate → FSRS progression (default flow):** solving a drill triggers a skippable explain-back nudge; the AI-graded explanation maps onto per-concept FSRS ratings (`feynmanRating`), updates mastery, then surfaces a "next weakest concept" card (BuildLab) so the loop closes: drill → explain → mastery update → next weakest concept. Playground's manual gate also refreshes mastery on grade.
- **Expanded learning domains:** 19 tracks and 26 selectable roadmaps cover the original interview/search/math curriculum plus systems foundations, infrastructure, distributed systems, AI models and training, inference, agents, harness engineering, AI reliability, developer tools, application engineering, and multimodal/spatial computing. `src/data/curriculum-coverage.json` maps all 96 requested subtopics to stable concept IDs; every added concept has an editorial drill, review prompt, roadmap placement, canonical source, and synthesis artifact.
- **Public curriculum discovery:** `/curriculum/` and its generated track, roadmap, and concept pages make the complete curriculum readable without JavaScript or sign-in. The build regenerates all pages, sitemap entries, homepage counts, and agent catalogs from canonical curriculum data and tests their one-to-one integrity.
- **Unified site navigation:** the homepage, application shell, and generated curriculum expose the same primary and browse hierarchy. React surfaces share one header component, while generated pages render equivalent semantic HTML/CSS without client JavaScript.
- **AI assistance:** multi-provider Socratic hints without spoilers (`useAI`); local-ai dev path documented.

### Auth and API hardening (2026-03-29 audit, archived at `docs/archive/security-audit-2026-03-29.md`)
- Auth middleware on `/api/chat.mjs` and `/api/go-run.mjs` (401 for unauthenticated).
- JWT `dev-secret-change-in-production` fallback removed — env required in prod.
- Authenticated user progress and SRS data sync to D1 (debounced); localStorage retained as offline fallback.
- Auth error responses no longer leak `hasClientId` / `clientIdLength`.
- Google streaming API key sent via `x-goog-api-key` header instead of URL param.

### Documentation
- README architecture diagram (Mermaid) and run steps for Cloudflare + D1 setup.
- Canonical documentation tree at `docs/` (see `docs/index.md`); ADRs at
  `docs/architecture/decisions/`; the 2026-03-29 audit is archived at
  `docs/archive/security-audit-2026-03-29.md`.

## Work queue

Open work is tracked only in [GitHub Issues](https://github.com/Significant-Hobbies/swe-interview-prep/issues).
An open issue is a to-do, a linked pull request is in progress, and merge plus
issue closure makes the work done.
