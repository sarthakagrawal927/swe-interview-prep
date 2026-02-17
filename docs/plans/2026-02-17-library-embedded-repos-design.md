# Library: Embedded Learning Repos

## Problem

Interview prep content is scattered across dozens of GitHub repos. Users must leave the app to browse JavaScript interview questions, system design tutorials, OOP design problems, and algorithm explanations. We want to bring this content inside the app with both a reader experience and interactive exercises.

## Decisions

- **New top-level `/library` route** (not nested under DSA/LLD/HLD/Behavioral categories)
- **Repo-specific adapters** that parse each repo's unique structure into normalized content
- **Hybrid content sourcing**: pre-processed at build time, lazy-loaded per repo, with update mechanism
- **Two modes per repo**: Read (markdown browser with section navigation) + Practice (extracted Q&A, MCQs, flashcards)
- **V1 scope**: 12 repos

## V1 Repos

| # | Repo | Focus | Exercise Potential |
|---|------|-------|--------------------|
| 1 | `sudheerj/javascript-interview-questions` | JS fundamentals | ~478 Q&A -> flashcards + MCQs |
| 2 | `sudheerj/reactjs-interview-questions` | React patterns | ~318 Q&A -> flashcards + MCQs |
| 3 | `yangshun/front-end-interview-handbook` | Frontend interviews | Chapters -> reader, Q&As -> flashcards |
| 4 | `karanpratapsingh/system-design` | System design tutorial | 5 chapters -> reader, concepts -> flashcards |
| 5 | `ByteByteGoHq/system-design-101` | Visual system design | Topics -> reader (diagrams inline) |
| 6 | `ashishps1/awesome-low-level-design` | LLD problems | 40+ problems -> exercises, patterns -> reader |
| 7 | `tssovi/grokking-the-object-oriented-design-interview` | OOP design | Design problems -> exercises, theory -> reader |
| 8 | `bregman-arie/devops-exercises` | DevOps | 2600+ exercises -> interactive Q&A |
| 9 | `ByteByteGoHq/coding-interview-patterns` | Coding patterns | 101 problems in 6 languages -> exercises |
| 10 | `ByteByteGoHq/ood-interview` | OOP design projects | 11 projects with runnable Java code |
| 11 | `donnemartin/system-design-primer` | System design | Worked problems + Anki flashcards |
| 12 | `trekhleb/javascript-algorithms` | Algorithms/DS | Per-algorithm READMEs -> flashcards |

## Architecture

### File Structure

```
src/
  pages/
    Library.tsx              # Grid of all repos with search/filter
    RepoView.tsx             # Single repo: reader + exercise mode
  adapters/
    types.ts                 # Shared adapter interfaces
    base-adapter.ts          # Fallback: directory-tree markdown renderer
    javascript-questions.ts  # sudheerj/javascript-interview-questions
    react-questions.ts       # sudheerj/reactjs-interview-questions
    frontend-handbook.ts     # yangshun/front-end-interview-handbook
    system-design.ts         # karanpratapsingh/system-design
    system-design-101.ts     # ByteByteGoHq/system-design-101
    low-level-design.ts      # ashishps1/awesome-low-level-design
    grokking-oop.ts          # tssovi/grokking-the-object-oriented-design-interview
    devops-exercises.ts      # bregman-arie/devops-exercises
    coding-patterns.ts       # ByteByteGoHq/coding-interview-patterns
    ood-interview.ts         # ByteByteGoHq/ood-interview
    system-design-primer.ts  # donnemartin/system-design-primer
    js-algorithms.ts         # trekhleb/javascript-algorithms
  data/
    library/
      manifest.json          # Registry: repo metadata + lastFetched timestamps
      <repo-slug>/
        content.json         # Adapter output: sections + exercises
scripts/
  fetch-library.ts           # Build script: clone -> adapt -> output JSON
  library.config.json        # Repo URLs + adapter mapping
```

### Adapter Interface

```typescript
interface RepoAdapter {
  id: string;
  name: string;
  source: string;          // GitHub URL
  description: string;
  tags: string[];
  icon: string;            // Lucide icon name
  parseContent(files: RepoFile[]): ParsedRepo;
}

interface RepoFile {
  path: string;
  content: string;
}

interface ParsedRepo {
  sections: Section[];      // Browseable content tree
  exercises: Exercise[];    // Extracted interactive items
  totalItems: number;
}

interface Section {
  id: string;
  title: string;
  content: string;          // Markdown
  children?: Section[];
}

interface Exercise {
  id: string;
  type: 'qa' | 'mcq' | 'flashcard';
  question: string;
  answer: string;
  options?: string[];       // MCQ only
  difficulty?: 'easy' | 'medium' | 'hard';
  tags: string[];
}
```

### Adapter Strategies

| Repo | Parsing Approach |
|------|-----------------|
| `sudheerj/*-questions` | Parse numbered Q&A from README. `##` headings = sections, numbered items = Q&A pairs. |
| `front-end-interview-handbook` | Parse markdown chapters with structured answer sections. |
| `karanpratapsingh/system-design` | Parse 5 chapters + subsections. Extract key definitions as flashcards. |
| `ByteByteGoHq/system-design-101` | Parse topic files. Render diagrams/images inline. |
| `ashishps1/awesome-low-level-design` | Parse problem list + pattern sections into exercises. |
| `grokking-the-object-oriented-design-interview` | Parse OOP design problems + UML descriptions. |
| `bregman-arie/devops-exercises` | Parse categorized exercises with collapsible answers. |
| `ByteByteGoHq/coding-interview-patterns` | Parse 19 chapters of problem/solution pairs across 6 languages. |
| `ByteByteGoHq/ood-interview` | Parse 11 Java project directories into design problem exercises. |
| `donnemartin/system-design-primer` | Parse sections + extract existing Anki flashcards. |
| `trekhleb/javascript-algorithms` | Parse per-algorithm READMEs with complexity tables. |
| Fallback (`base-adapter`) | Build section tree from directory structure, render all `.md` files. No exercises. |

## Routing

```
/library                    -> Library.tsx (repo grid)
/library/:repoSlug          -> RepoView.tsx (read mode)
/library/:repoSlug/practice -> RepoView.tsx (exercise mode)
```

Not nested under `/:category/*` — Library is a standalone top-level section.

## Navigation Changes

- Add `BookOpen` icon "Library" link to Layout.tsx top nav (visible always, alongside "All Topics")
- On Home page: add a Library card/section
- Mobile bottom bar: show Library tab when on Home page

## RepoView Layout

### Read Mode
- **Left sidebar**: collapsible section tree (table of contents)
- **Main area**: rendered markdown with syntax-highlighted code blocks, images, tables
- Section tree highlights current position, clicking navigates

### Practice Mode
- Renders extracted exercises as interactive cards
- Reuses existing AnkiReview patterns: flip cards, MCQ mode, quality rating
- Exercise progress tracked in localStorage (same pattern as spaced repetition)
- Filter by difficulty, tags

## Build Pipeline

### `scripts/fetch-library.ts`

1. Reads `library.config.json` (repo URLs + adapter IDs)
2. Shallow-clones each repo (depth=1) into temp directory
3. Reads all markdown/text files
4. Runs the repo's adapter -> produces `ParsedRepo`
5. Writes `src/data/library/<repo-slug>/content.json`
6. Writes `src/data/library/manifest.json` with metadata + timestamps

Run: `npm run fetch-library`

### Lazy Loading

Same pattern as existing HLD/LLD/behavioral data:
- `manifest.json` bundled and loaded immediately (small, just metadata)
- Individual repo `content.json` loaded via dynamic `import()` on navigation
- Each repo becomes its own Vite chunk

### Update Mechanism

- `manifest.json` includes `lastFetched` per repo
- "Check for updates" button re-runs fetch script (dev mode)
- Production shows "last updated X days ago"

## New Components

- **LibraryCard**: repo card for grid (icon, name, tags, exercise count, section count)
- **SectionTree**: collapsible sidebar for content navigation
- **MarkdownViewer**: renders markdown with code blocks, images, tables (uses `react-markdown`)
- **ExerciseRunner**: wraps exercises in interactive UI (MCQ/flashcard/QA modes)

## Dependencies

- `react-markdown` + `remark-gfm` — markdown rendering with GitHub Flavored Markdown
- `rehype-highlight` or `rehype-prism` — syntax highlighting in code blocks

## Out of Scope for V1

- AI-powered exercise generation from raw content
- User-contributed notes or annotations on library content
- Deep-linking from category problems to related library sections
- Full-text search across all library content
- Offline caching / service worker
