# Library: Embedded Learning Repos — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a top-level Library section that embeds content from 12 curated GitHub repos with markdown reading and interactive exercises.

**Architecture:** Build script clones repos and runs per-repo adapters to produce normalized JSON (sections + exercises). Frontend lazy-loads each repo's content. Two pages: Library grid and RepoView (read + practice modes).

**Tech Stack:** React 19, Vite, TailwindCSS v4, react-markdown, remark-gfm, rehype-highlight, Node.js build script

---

### Task 1: Install Dependencies

**Files:**
- Modify: `package.json`

**Step 1: Install react-markdown and plugins**

Run:
```bash
npm install react-markdown remark-gfm rehype-highlight
```

**Step 2: Verify installation**

Run: `npm ls react-markdown remark-gfm rehype-highlight`
Expected: All three packages listed without errors.

**Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "feat(library): add react-markdown, remark-gfm, rehype-highlight dependencies"
```

---

### Task 2: Define Library Types

**Files:**
- Create: `src/adapters/types.ts`

**Step 1: Create the adapter types file**

```typescript
// src/adapters/types.ts

export interface RepoFile {
  path: string;
  content: string;
}

export interface Section {
  id: string;
  title: string;
  content: string;          // Markdown
  children?: Section[];
}

export interface Exercise {
  id: string;
  type: 'qa' | 'mcq' | 'flashcard';
  question: string;
  answer: string;
  options?: string[];       // MCQ only
  difficulty?: 'easy' | 'medium' | 'hard';
  tags: string[];
}

export interface ParsedRepo {
  sections: Section[];
  exercises: Exercise[];
  totalItems: number;
}

export interface RepoAdapter {
  id: string;
  name: string;
  source: string;
  description: string;
  tags: string[];
  icon: string;
  parseContent(files: RepoFile[]): ParsedRepo;
}

export interface RepoManifestEntry {
  id: string;
  name: string;
  source: string;
  description: string;
  tags: string[];
  icon: string;
  sectionCount: number;
  exerciseCount: number;
  lastFetched: string;      // ISO date string
}

export interface LibraryManifest {
  repos: RepoManifestEntry[];
  generatedAt: string;
}
```

**Step 2: Verify it compiles**

Run: `npx tsc --noEmit src/adapters/types.ts 2>&1 || echo "Check manually"`
Expected: No errors (or TypeScript may complain about project config — that's fine since this file has no imports).

**Step 3: Commit**

```bash
git add src/adapters/types.ts
git commit -m "feat(library): add adapter and library type definitions"
```

---

### Task 3: Create Base Adapter (Fallback)

**Files:**
- Create: `src/adapters/base-adapter.ts`

**Step 1: Write the base adapter**

This adapter converts a flat list of markdown files into a section tree based on directory structure. No exercise extraction.

```typescript
// src/adapters/base-adapter.ts
import type { RepoFile, RepoAdapter, ParsedRepo, Section } from './types';

function slugify(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function buildSectionTree(files: RepoFile[]): Section[] {
  // Sort files by path for consistent ordering
  const mdFiles = files
    .filter(f => f.path.endsWith('.md') || f.path.endsWith('.rst'))
    .sort((a, b) => a.path.localeCompare(b.path));

  const root: Section[] = [];
  const dirMap = new Map<string, Section>();

  for (const file of mdFiles) {
    const parts = file.path.split('/');
    const fileName = parts[parts.length - 1];
    const title = fileName.replace(/\.(md|rst)$/, '').replace(/[-_]/g, ' ');

    const section: Section = {
      id: slugify(file.path),
      title: title === 'README' ? (parts.length > 1 ? parts[parts.length - 2] : 'Overview') : title,
      content: file.content,
    };

    if (parts.length === 1) {
      // Top-level file
      root.push(section);
    } else {
      // Nested file — find or create parent directory section
      const dirPath = parts.slice(0, -1).join('/');
      let parent = dirMap.get(dirPath);
      if (!parent) {
        parent = {
          id: slugify(dirPath),
          title: parts[parts.length - 2].replace(/[-_]/g, ' '),
          content: '',
          children: [],
        };
        dirMap.set(dirPath, parent);
        // Find grandparent or add to root
        const grandparentPath = parts.slice(0, -2).join('/');
        const grandparent = dirMap.get(grandparentPath);
        if (grandparent) {
          grandparent.children = grandparent.children || [];
          grandparent.children.push(parent);
        } else {
          root.push(parent);
        }
      }
      parent.children = parent.children || [];
      parent.children.push(section);
    }
  }

  return root;
}

export function createBaseAdapter(config: {
  id: string;
  name: string;
  source: string;
  description: string;
  tags: string[];
  icon: string;
}): RepoAdapter {
  return {
    ...config,
    parseContent(files: RepoFile[]): ParsedRepo {
      const sections = buildSectionTree(files);
      return {
        sections,
        exercises: [],
        totalItems: sections.length,
      };
    },
  };
}
```

**Step 2: Commit**

```bash
git add src/adapters/base-adapter.ts
git commit -m "feat(library): add base adapter with directory-tree markdown parsing"
```

---

### Task 4: Create Library Config and Build Script

**Files:**
- Create: `scripts/library.config.json`
- Create: `scripts/fetch-library.mjs`
- Modify: `package.json` (add `fetch-library` script)

**Step 1: Create the library config**

```json
{
  "repos": [
    {
      "id": "javascript-questions",
      "source": "https://github.com/sudheerj/javascript-interview-questions",
      "adapter": "javascript-questions",
      "name": "JavaScript Interview Questions",
      "description": "478+ JavaScript interview questions with answers",
      "tags": ["javascript", "interview", "frontend"],
      "icon": "FileCode2"
    },
    {
      "id": "react-questions",
      "source": "https://github.com/sudheerj/reactjs-interview-questions",
      "adapter": "react-questions",
      "name": "React Interview Questions",
      "description": "318+ React interview questions with answers",
      "tags": ["react", "interview", "frontend"],
      "icon": "Atom"
    },
    {
      "id": "frontend-handbook",
      "source": "https://github.com/yangshun/front-end-interview-handbook",
      "adapter": "base",
      "name": "Frontend Interview Handbook",
      "description": "Structured frontend interview preparation guide",
      "tags": ["frontend", "interview", "html", "css", "javascript"],
      "icon": "Layout"
    },
    {
      "id": "system-design",
      "source": "https://github.com/karanpratapsingh/system-design",
      "adapter": "base",
      "name": "System Design",
      "description": "System design fundamentals and case studies",
      "tags": ["system-design", "architecture", "distributed-systems"],
      "icon": "Network"
    },
    {
      "id": "system-design-101",
      "source": "https://github.com/ByteByteGoHq/system-design-101",
      "adapter": "base",
      "name": "System Design 101",
      "description": "Visual system design explanations by ByteByteGo",
      "tags": ["system-design", "bytebytego", "visual"],
      "icon": "Image"
    },
    {
      "id": "low-level-design",
      "source": "https://github.com/ashishps1/awesome-low-level-design",
      "adapter": "base",
      "name": "Awesome Low-Level Design",
      "description": "40+ LLD problems with design patterns",
      "tags": ["lld", "oop", "design-patterns"],
      "icon": "Boxes"
    },
    {
      "id": "grokking-oop",
      "source": "https://github.com/tssovi/grokking-the-object-oriented-design-interview",
      "adapter": "base",
      "name": "Grokking OOP Design",
      "description": "Object-oriented design interview problems",
      "tags": ["oop", "design", "uml"],
      "icon": "Component"
    },
    {
      "id": "devops-exercises",
      "source": "https://github.com/bregman-arie/devops-exercises",
      "adapter": "devops-exercises",
      "name": "DevOps Exercises",
      "description": "2600+ DevOps exercises covering all major topics",
      "tags": ["devops", "linux", "docker", "kubernetes", "cloud"],
      "icon": "Terminal"
    },
    {
      "id": "coding-interview-patterns",
      "source": "https://github.com/ByteByteGoHq/coding-interview-patterns",
      "adapter": "base",
      "name": "Coding Interview Patterns",
      "description": "101 coding problems by ByteByteGo in 6 languages",
      "tags": ["algorithms", "bytebytego", "coding", "patterns"],
      "icon": "Code2"
    },
    {
      "id": "ood-interview",
      "source": "https://github.com/ByteByteGoHq/ood-interview",
      "adapter": "base",
      "name": "OOD Interview",
      "description": "11 OOP design projects with runnable Java code",
      "tags": ["oop", "java", "bytebytego", "design"],
      "icon": "Braces"
    },
    {
      "id": "system-design-primer",
      "source": "https://github.com/donnemartin/system-design-primer",
      "adapter": "base",
      "name": "System Design Primer",
      "description": "Learn large-scale system design with Anki flashcards",
      "tags": ["system-design", "scalability", "architecture"],
      "icon": "Server"
    },
    {
      "id": "javascript-algorithms",
      "source": "https://github.com/trekhleb/javascript-algorithms",
      "adapter": "base",
      "name": "JavaScript Algorithms",
      "description": "Algorithms and data structures in JavaScript",
      "tags": ["algorithms", "data-structures", "javascript"],
      "icon": "Binary"
    }
  ]
}
```

**Step 2: Create the fetch script**

This is a Node.js script (ESM) that clones repos and processes them. It uses the base adapter for now; custom adapters will be added in later tasks.

```javascript
// scripts/fetch-library.mjs
import { execSync } from 'child_process';
import { readFileSync, writeFileSync, mkdirSync, readdirSync, statSync, rmSync, existsSync } from 'fs';
import { join, relative } from 'path';

const config = JSON.parse(readFileSync(new URL('./library.config.json', import.meta.url), 'utf-8'));
const OUTPUT_DIR = join(import.meta.dirname, '..', 'src', 'data', 'library');
const TEMP_DIR = join(import.meta.dirname, '..', '.tmp-library');

function getAllFiles(dir, base = dir) {
  const results = [];
  for (const entry of readdirSync(dir)) {
    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      // Skip hidden dirs, node_modules, .git
      if (entry.startsWith('.') || entry === 'node_modules') continue;
      results.push(...getAllFiles(fullPath, base));
    } else if (/\.(md|rst|txt)$/i.test(entry)) {
      results.push({
        path: relative(base, fullPath),
        content: readFileSync(fullPath, 'utf-8'),
      });
    }
  }
  return results;
}

function slugify(text) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function buildSectionTree(files) {
  const mdFiles = files
    .filter(f => f.path.endsWith('.md') || f.path.endsWith('.rst'))
    .sort((a, b) => a.path.localeCompare(b.path));

  const root = [];
  const dirMap = new Map();

  for (const file of mdFiles) {
    const parts = file.path.split('/');
    const fileName = parts[parts.length - 1];
    const title = fileName.replace(/\.(md|rst)$/, '').replace(/[-_]/g, ' ');

    const section = {
      id: slugify(file.path),
      title: title === 'README' ? (parts.length > 1 ? parts[parts.length - 2].replace(/[-_]/g, ' ') : 'Overview') : title,
      content: file.content,
    };

    if (parts.length === 1) {
      root.push(section);
    } else {
      const dirPath = parts.slice(0, -1).join('/');
      let parent = dirMap.get(dirPath);
      if (!parent) {
        parent = {
          id: slugify(dirPath),
          title: parts[parts.length - 2].replace(/[-_]/g, ' '),
          content: '',
          children: [],
        };
        dirMap.set(dirPath, parent);
        const grandparentPath = parts.slice(0, -2).join('/');
        const grandparent = dirMap.get(grandparentPath);
        if (grandparent) {
          grandparent.children = grandparent.children || [];
          grandparent.children.push(parent);
        } else {
          root.push(parent);
        }
      }
      parent.children = parent.children || [];
      parent.children.push(section);
    }
  }

  return root;
}

function countSections(sections) {
  let count = 0;
  for (const s of sections) {
    count++;
    if (s.children) count += countSections(s.children);
  }
  return count;
}

async function main() {
  console.log(`Fetching ${config.repos.length} repos...\n`);

  // Clean up
  if (existsSync(TEMP_DIR)) rmSync(TEMP_DIR, { recursive: true });
  mkdirSync(TEMP_DIR, { recursive: true });
  mkdirSync(OUTPUT_DIR, { recursive: true });

  const manifest = { repos: [], generatedAt: new Date().toISOString() };

  for (const repo of config.repos) {
    const repoDir = join(TEMP_DIR, repo.id);
    console.log(`Cloning ${repo.source}...`);

    try {
      execSync(`git clone --depth=1 ${repo.source} ${repoDir}`, {
        stdio: 'pipe',
        timeout: 60000,
      });

      const files = getAllFiles(repoDir);
      console.log(`  Found ${files.length} content files`);

      // For now, all repos use the base adapter logic
      // Custom adapters (javascript-questions, devops-exercises, etc.)
      // will override this in later tasks
      const sections = buildSectionTree(files);
      const parsed = {
        sections,
        exercises: [],
        totalItems: countSections(sections),
      };

      // Write repo content
      const repoOutputDir = join(OUTPUT_DIR, repo.id);
      mkdirSync(repoOutputDir, { recursive: true });
      writeFileSync(join(repoOutputDir, 'content.json'), JSON.stringify(parsed));

      manifest.repos.push({
        id: repo.id,
        name: repo.name,
        source: repo.source,
        description: repo.description,
        tags: repo.tags,
        icon: repo.icon,
        sectionCount: countSections(sections),
        exerciseCount: parsed.exercises.length,
        lastFetched: new Date().toISOString(),
      });

      console.log(`  -> ${countSections(sections)} sections, ${parsed.exercises.length} exercises\n`);
    } catch (err) {
      console.error(`  ERROR cloning ${repo.id}: ${err.message}\n`);
    }
  }

  // Write manifest
  writeFileSync(join(OUTPUT_DIR, 'manifest.json'), JSON.stringify(manifest, null, 2));
  console.log(`\nManifest written with ${manifest.repos.length} repos.`);

  // Clean up temp
  rmSync(TEMP_DIR, { recursive: true });
  console.log('Temp directory cleaned up.');
}

main().catch(console.error);
```

**Step 3: Add npm script to package.json**

Add to `package.json` scripts:
```json
"fetch-library": "node scripts/fetch-library.mjs"
```

**Step 4: Add `.tmp-library` to `.gitignore`**

Append `.tmp-library` to `.gitignore`.

**Step 5: Run the fetch script to generate initial data**

Run: `npm run fetch-library`
Expected: Clones 12 repos, generates `src/data/library/manifest.json` and per-repo `content.json` files.

**Step 6: Verify output**

Run: `ls src/data/library/` — should show `manifest.json` and 12 directories.
Run: `cat src/data/library/manifest.json | head -20` — should show valid JSON with repo entries.

**Step 7: Add generated data to gitignore (content.json files are large)**

Add `src/data/library/*/content.json` to `.gitignore`. Keep `manifest.json` tracked.

**Step 8: Commit**

```bash
git add scripts/library.config.json scripts/fetch-library.mjs package.json .gitignore src/data/library/manifest.json
git commit -m "feat(library): add build script and config for fetching repo content"
```

---

### Task 5: Create useLibrary Hook

**Files:**
- Create: `src/hooks/useLibrary.ts`

**Step 1: Write the hook**

This hook loads the manifest eagerly and repo content lazily, following the same pattern as `useProblems.ts`.

```typescript
// src/hooks/useLibrary.ts
import { useState, useEffect, useCallback } from 'react';
import manifestData from '../data/library/manifest.json';
import type { LibraryManifest, ParsedRepo, RepoManifestEntry } from '../adapters/types';

const manifest = manifestData as LibraryManifest;

// Cache loaded repo content
const contentCache: Record<string, ParsedRepo> = {};

async function loadRepoContent(repoId: string): Promise<ParsedRepo> {
  if (contentCache[repoId]) return contentCache[repoId];
  try {
    const mod = await import(`../data/library/${repoId}/content.json`);
    contentCache[repoId] = mod.default as ParsedRepo;
    return contentCache[repoId];
  } catch {
    return { sections: [], exercises: [], totalItems: 0 };
  }
}

export function useLibrary() {
  const repos = manifest.repos;

  const search = useCallback((query: string): RepoManifestEntry[] => {
    if (!query) return repos;
    const q = query.toLowerCase();
    return repos.filter(r =>
      r.name.toLowerCase().includes(q) ||
      r.description.toLowerCase().includes(q) ||
      r.tags.some(t => t.toLowerCase().includes(q))
    );
  }, [repos]);

  const getRepo = useCallback((id: string): RepoManifestEntry | null => {
    return repos.find(r => r.id === id) || null;
  }, [repos]);

  return { repos, search, getRepo, generatedAt: manifest.generatedAt };
}

export function useRepoContent(repoId: string) {
  const [content, setContent] = useState<ParsedRepo>(
    contentCache[repoId] || { sections: [], exercises: [], totalItems: 0 }
  );
  const [loading, setLoading] = useState(!contentCache[repoId]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    loadRepoContent(repoId).then(data => {
      if (!cancelled) {
        setContent(data);
        setLoading(false);
      }
    });
    return () => { cancelled = true; };
  }, [repoId]);

  return { content, loading };
}
```

**Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: No new errors related to useLibrary.

**Step 3: Commit**

```bash
git add src/hooks/useLibrary.ts
git commit -m "feat(library): add useLibrary and useRepoContent hooks with lazy loading"
```

---

### Task 6: Create Library Page (Repo Grid)

**Files:**
- Create: `src/pages/Library.tsx`
- Modify: `src/App.tsx` (add route)

**Step 1: Create Library page**

```typescript
// src/pages/Library.tsx
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, BookOpen, ExternalLink, FileCode2, Atom, Layout as LayoutIcon, Network, Image, Boxes, Component, Terminal, Code2, Braces, Server, Binary } from 'lucide-react';
import { useLibrary } from '../hooks/useLibrary';

const ICONS: Record<string, typeof BookOpen> = {
  FileCode2, Atom, Layout: LayoutIcon, Network, Image, Boxes, Component, Terminal, Code2, Braces, Server, Binary, BookOpen,
};

const TAG_COLORS: Record<string, string> = {
  javascript: 'bg-yellow-500/10 text-yellow-400',
  react: 'bg-cyan-500/10 text-cyan-400',
  frontend: 'bg-blue-500/10 text-blue-400',
  'system-design': 'bg-orange-500/10 text-orange-400',
  bytebytego: 'bg-red-500/10 text-red-400',
  algorithms: 'bg-green-500/10 text-green-400',
  lld: 'bg-purple-500/10 text-purple-400',
  oop: 'bg-purple-500/10 text-purple-400',
  devops: 'bg-teal-500/10 text-teal-400',
  interview: 'bg-indigo-500/10 text-indigo-400',
};

export default function Library() {
  const { repos, search, generatedAt } = useLibrary();
  const [query, setQuery] = useState('');
  const filtered = query ? search(query) : repos;

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:py-8 sm:px-6 lg:px-8">
      <div className="mb-6 sm:mb-8">
        <div className="flex items-center gap-3 mb-1">
          <BookOpen className="h-7 w-7 text-emerald-400" />
          <h1 className="text-2xl sm:text-3xl font-bold text-white">Library</h1>
        </div>
        <p className="text-sm sm:text-base text-gray-400">
          Curated learning repos — browse content and practice exercises.
        </p>
        <p className="mt-1 text-xs text-gray-600">
          Last updated {new Date(generatedAt).toLocaleDateString()}
        </p>
      </div>

      {/* Search */}
      <div className="relative mb-6 sm:mb-8">
        <Search className="absolute left-3 sm:left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-500" />
        <input
          type="text"
          placeholder="Search repos by name, tag, or description..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full rounded-xl border border-gray-800 bg-gray-900 py-2.5 sm:py-3 pl-10 sm:pl-12 pr-4 text-sm sm:text-base text-gray-200 placeholder-gray-500 outline-none transition-colors focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/50"
        />
      </div>

      {/* Repo Grid */}
      <div className="grid grid-cols-1 gap-4 sm:gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map(repo => {
          const Icon = ICONS[repo.icon] || BookOpen;
          return (
            <Link
              key={repo.id}
              to={`/library/${repo.id}`}
              className="group relative overflow-hidden rounded-2xl border border-gray-800 hover:border-emerald-500/40 bg-gray-900 p-5 sm:p-6 transition-all hover:bg-gray-800/80"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="inline-flex rounded-xl bg-emerald-500/10 p-2.5">
                  <Icon className="h-5 w-5 text-emerald-400" />
                </div>
                <a
                  href={repo.source}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={e => e.stopPropagation()}
                  className="text-gray-600 hover:text-gray-400 transition-colors"
                  title="View on GitHub"
                >
                  <ExternalLink className="h-4 w-4" />
                </a>
              </div>

              <h3 className="text-lg font-semibold text-white mb-1">{repo.name}</h3>
              <p className="text-sm text-gray-400 mb-3 line-clamp-2">{repo.description}</p>

              {/* Tags */}
              <div className="flex flex-wrap gap-1.5 mb-3">
                {repo.tags.slice(0, 4).map(tag => (
                  <span
                    key={tag}
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${TAG_COLORS[tag] || 'bg-gray-800 text-gray-400'}`}
                  >
                    {tag}
                  </span>
                ))}
              </div>

              {/* Stats */}
              <div className="flex items-center gap-4 text-xs text-gray-500">
                <span>{repo.sectionCount} sections</span>
                {repo.exerciseCount > 0 && (
                  <span>{repo.exerciseCount} exercises</span>
                )}
              </div>
            </Link>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-12">
          <BookOpen className="h-12 w-12 text-gray-700 mx-auto mb-3" />
          <p className="text-gray-500">No repos match your search.</p>
        </div>
      )}
    </div>
  );
}
```

**Step 2: Add Library route to App.tsx**

In `src/App.tsx`, add the import and route:

- Import: `import Library from './pages/Library';`
- Add route inside the `<Route path="/" element={<Layout />}>` block:
  ```tsx
  <Route path="library" element={<Library />} />
  ```

**Step 3: Verify the page renders**

Run: `npm run dev:frontend`
Navigate to `http://localhost:5173/library`
Expected: Grid of 12 repo cards with search, tags, and stats.

**Step 4: Commit**

```bash
git add src/pages/Library.tsx src/App.tsx
git commit -m "feat(library): add Library page with repo grid, search, and tags"
```

---

### Task 7: Create MarkdownViewer Component

**Files:**
- Create: `src/components/MarkdownViewer.tsx`

**Step 1: Write the markdown viewer**

```typescript
// src/components/MarkdownViewer.tsx
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';

interface MarkdownViewerProps {
  content: string;
}

export default function MarkdownViewer({ content }: MarkdownViewerProps) {
  return (
    <div className="prose prose-invert prose-sm sm:prose-base max-w-none
      prose-headings:text-gray-100 prose-p:text-gray-300 prose-a:text-blue-400
      prose-strong:text-gray-200 prose-code:text-emerald-400 prose-code:bg-gray-800
      prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-sm
      prose-pre:bg-gray-900 prose-pre:border prose-pre:border-gray-800
      prose-table:border-gray-800 prose-th:border-gray-700 prose-td:border-gray-800
      prose-img:rounded-lg prose-blockquote:border-gray-700 prose-blockquote:text-gray-400
      prose-li:text-gray-300 prose-hr:border-gray-800"
    >
      <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]}>
        {content}
      </ReactMarkdown>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add src/components/MarkdownViewer.tsx
git commit -m "feat(library): add MarkdownViewer component with syntax highlighting"
```

---

### Task 8: Create SectionTree Component

**Files:**
- Create: `src/components/SectionTree.tsx`

**Step 1: Write the section tree sidebar**

```typescript
// src/components/SectionTree.tsx
import { useState } from 'react';
import { ChevronRight, ChevronDown, FileText } from 'lucide-react';
import type { Section } from '../adapters/types';

interface SectionTreeProps {
  sections: Section[];
  activeSectionId: string | null;
  onSelect: (section: Section) => void;
}

function SectionNode({
  section,
  depth,
  activeSectionId,
  onSelect,
}: {
  section: Section;
  depth: number;
  activeSectionId: string | null;
  onSelect: (section: Section) => void;
}) {
  const [expanded, setExpanded] = useState(depth < 1);
  const hasChildren = section.children && section.children.length > 0;
  const isActive = section.id === activeSectionId;

  return (
    <div>
      <button
        onClick={() => {
          if (hasChildren) setExpanded(!expanded);
          if (section.content) onSelect(section);
        }}
        className={`flex items-center gap-1.5 w-full text-left px-2 py-1.5 rounded-lg text-sm transition-colors ${
          isActive
            ? 'bg-emerald-500/15 text-emerald-400 font-medium'
            : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/50'
        }`}
        style={{ paddingLeft: `${depth * 12 + 8}px` }}
      >
        {hasChildren ? (
          expanded ? (
            <ChevronDown className="h-3.5 w-3.5 flex-shrink-0" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5 flex-shrink-0" />
          )
        ) : (
          <FileText className="h-3.5 w-3.5 flex-shrink-0" />
        )}
        <span className="truncate">{section.title}</span>
      </button>
      {expanded && hasChildren && (
        <div>
          {section.children!.map(child => (
            <SectionNode
              key={child.id}
              section={child}
              depth={depth + 1}
              activeSectionId={activeSectionId}
              onSelect={onSelect}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function SectionTree({ sections, activeSectionId, onSelect }: SectionTreeProps) {
  return (
    <nav className="space-y-0.5 overflow-y-auto">
      {sections.map(section => (
        <SectionNode
          key={section.id}
          section={section}
          depth={0}
          activeSectionId={activeSectionId}
          onSelect={onSelect}
        />
      ))}
    </nav>
  );
}
```

**Step 2: Commit**

```bash
git add src/components/SectionTree.tsx
git commit -m "feat(library): add SectionTree collapsible sidebar component"
```

---

### Task 9: Create ExerciseRunner Component

**Files:**
- Create: `src/components/ExerciseRunner.tsx`

**Step 1: Write the exercise runner**

Supports three exercise types: Q&A (flip card), MCQ, and flashcard. Reuses styling patterns from AnkiReview.tsx.

```typescript
// src/components/ExerciseRunner.tsx
import { useState, useMemo } from 'react';
import { RotateCcw, CheckCircle2, XCircle, ChevronRight, Filter, Shuffle } from 'lucide-react';
import type { Exercise } from '../adapters/types';

interface ExerciseRunnerProps {
  exercises: Exercise[];
  repoName: string;
}

function shuffleArray<T>(arr: T[]): T[] {
  const shuffled = [...arr];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

export default function ExerciseRunner({ exercises, repoName }: ExerciseRunnerProps) {
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [shuffled, setShuffled] = useState(false);
  const [tagFilter, setTagFilter] = useState('all');
  const [score, setScore] = useState({ correct: 0, total: 0 });

  const allTags = useMemo(() => {
    const tags = new Set<string>();
    exercises.forEach(e => e.tags.forEach(t => tags.add(t)));
    return Array.from(tags).sort();
  }, [exercises]);

  const filtered = useMemo(() => {
    let list = tagFilter === 'all' ? exercises : exercises.filter(e => e.tags.includes(tagFilter));
    return shuffled ? shuffleArray(list) : list;
  }, [exercises, tagFilter, shuffled]);

  const current = filtered[index];

  if (!current) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <p className="text-gray-400 mb-4">
          {exercises.length === 0 ? 'No exercises available for this repo yet.' : 'No exercises match your filter.'}
        </p>
      </div>
    );
  }

  const handleNext = () => {
    setRevealed(false);
    setSelectedOption(null);
    setIndex(i => (i + 1) % filtered.length);
  };

  const handleMCQSelect = (optionIdx: number) => {
    if (selectedOption !== null) return;
    setSelectedOption(optionIdx);
    const isCorrect = current.options && current.options[optionIdx] === current.answer;
    setScore(s => ({
      correct: s.correct + (isCorrect ? 1 : 0),
      total: s.total + 1,
    }));
  };

  return (
    <div className="max-w-3xl mx-auto">
      {/* Controls */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-500">
            {index + 1} / {filtered.length}
          </span>
          {score.total > 0 && (
            <span className="text-sm text-gray-500">
              Score: {score.correct}/{score.total}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {allTags.length > 1 && (
            <select
              value={tagFilter}
              onChange={e => { setTagFilter(e.target.value); setIndex(0); }}
              className="rounded-lg border border-gray-700 bg-gray-800 px-3 py-1.5 text-xs text-gray-300"
            >
              <option value="all">All tags</option>
              {allTags.map(tag => <option key={tag} value={tag}>{tag}</option>)}
            </select>
          )}
          <button
            onClick={() => { setShuffled(!shuffled); setIndex(0); }}
            className={`rounded-lg p-2 transition-colors ${shuffled ? 'bg-emerald-500/20 text-emerald-400' : 'bg-gray-800 text-gray-400 hover:text-gray-200'}`}
            title="Shuffle"
          >
            <Shuffle className="h-4 w-4" />
          </button>
          <button
            onClick={() => { setIndex(0); setScore({ correct: 0, total: 0 }); setRevealed(false); setSelectedOption(null); }}
            className="rounded-lg bg-gray-800 p-2 text-gray-400 hover:text-gray-200 transition-colors"
            title="Reset"
          >
            <RotateCcw className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Exercise Card */}
      <div className="rounded-2xl border border-gray-800 bg-gray-900 p-6 sm:p-8">
        {/* Question */}
        <div className="mb-6">
          {current.difficulty && (
            <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium mb-3 ${
              current.difficulty === 'easy' ? 'bg-green-500/10 text-green-400' :
              current.difficulty === 'medium' ? 'bg-yellow-500/10 text-yellow-400' :
              'bg-red-500/10 text-red-400'
            }`}>
              {current.difficulty}
            </span>
          )}
          <p className="text-lg text-gray-200 whitespace-pre-wrap">{current.question}</p>
        </div>

        {/* MCQ Options */}
        {current.type === 'mcq' && current.options ? (
          <div className="space-y-2 mb-6">
            {current.options.map((opt, i) => {
              const isSelected = selectedOption === i;
              const isCorrect = opt === current.answer;
              const showResult = selectedOption !== null;

              return (
                <button
                  key={i}
                  onClick={() => handleMCQSelect(i)}
                  disabled={selectedOption !== null}
                  className={`w-full text-left rounded-xl border px-4 py-3 text-sm transition-colors ${
                    showResult && isCorrect
                      ? 'border-green-500/50 bg-green-500/10 text-green-300'
                      : showResult && isSelected && !isCorrect
                      ? 'border-red-500/50 bg-red-500/10 text-red-300'
                      : isSelected
                      ? 'border-blue-500/50 bg-blue-500/10 text-blue-300'
                      : 'border-gray-700 bg-gray-800 text-gray-300 hover:border-gray-600'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    {showResult && isCorrect && <CheckCircle2 className="h-4 w-4 text-green-400" />}
                    {showResult && isSelected && !isCorrect && <XCircle className="h-4 w-4 text-red-400" />}
                    {opt}
                  </span>
                </button>
              );
            })}
          </div>
        ) : null}

        {/* Q&A / Flashcard — Reveal Button */}
        {(current.type === 'qa' || current.type === 'flashcard') && !revealed && (
          <button
            onClick={() => setRevealed(true)}
            className="w-full rounded-xl border border-gray-700 bg-gray-800 py-3 text-sm font-medium text-gray-300 hover:border-emerald-500/40 hover:text-emerald-400 transition-colors"
          >
            Show Answer
          </button>
        )}

        {/* Answer */}
        {(revealed || (current.type === 'mcq' && selectedOption !== null)) && (
          <div className="mt-4 rounded-xl border border-gray-700 bg-gray-800/50 p-4">
            <p className="text-xs font-medium text-gray-500 uppercase mb-2">Answer</p>
            <p className="text-sm text-gray-300 whitespace-pre-wrap">{current.answer}</p>
          </div>
        )}
      </div>

      {/* Next Button */}
      <div className="mt-4 flex justify-end">
        <button
          onClick={handleNext}
          className="flex items-center gap-1.5 rounded-xl bg-emerald-500/10 px-4 py-2.5 text-sm font-medium text-emerald-400 hover:bg-emerald-500/20 transition-colors"
        >
          Next <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add src/components/ExerciseRunner.tsx
git commit -m "feat(library): add ExerciseRunner component with MCQ, Q&A, and flashcard modes"
```

---

### Task 10: Create RepoView Page

**Files:**
- Create: `src/pages/RepoView.tsx`
- Modify: `src/App.tsx` (add route)

**Step 1: Write the RepoView page**

```typescript
// src/pages/RepoView.tsx
import { useState, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, BookOpen, Dumbbell, ExternalLink, Loader2, Menu, X } from 'lucide-react';
import { useLibrary, useRepoContent } from '../hooks/useLibrary';
import SectionTree from '../components/SectionTree';
import MarkdownViewer from '../components/MarkdownViewer';
import ExerciseRunner from '../components/ExerciseRunner';
import type { Section } from '../adapters/types';

type ViewMode = 'read' | 'practice';

function findFirstContentSection(sections: Section[]): Section | null {
  for (const s of sections) {
    if (s.content) return s;
    if (s.children) {
      const found = findFirstContentSection(s.children);
      if (found) return found;
    }
  }
  return null;
}

export default function RepoView() {
  const { repoSlug } = useParams<{ repoSlug: string }>();
  const { getRepo } = useLibrary();
  const repo = repoSlug ? getRepo(repoSlug) : null;
  const { content, loading } = useRepoContent(repoSlug || '');
  const [activeSection, setActiveSection] = useState<Section | null>(null);
  const [mode, setMode] = useState<ViewMode>('read');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Auto-select first section with content once loaded
  const displaySection = useMemo(() => {
    if (activeSection) return activeSection;
    if (content.sections.length > 0) return findFirstContentSection(content.sections);
    return null;
  }, [activeSection, content.sections]);

  if (!repo) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <p className="text-gray-400 mb-4">Repo not found.</p>
        <Link to="/library" className="text-emerald-400 hover:text-emerald-300 text-sm">
          Back to Library
        </Link>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-8 w-8 text-emerald-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      {/* Header Bar */}
      <div className="flex items-center justify-between border-b border-gray-800 px-4 py-3 sm:px-6">
        <div className="flex items-center gap-3">
          <Link to="/library" className="text-gray-400 hover:text-gray-200 transition-colors">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-lg font-semibold text-white">{repo.name}</h1>
            <p className="text-xs text-gray-500">{repo.description}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Mode toggle */}
          <div className="flex rounded-lg border border-gray-700 overflow-hidden">
            <button
              onClick={() => setMode('read')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors ${
                mode === 'read' ? 'bg-emerald-500/20 text-emerald-400' : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              <BookOpen className="h-3.5 w-3.5" />
              Read
            </button>
            <button
              onClick={() => setMode('practice')}
              disabled={content.exercises.length === 0}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors ${
                mode === 'practice' ? 'bg-emerald-500/20 text-emerald-400' :
                content.exercises.length === 0 ? 'text-gray-600 cursor-not-allowed' :
                'text-gray-400 hover:text-gray-200'
              }`}
              title={content.exercises.length === 0 ? 'No exercises available yet' : undefined}
            >
              <Dumbbell className="h-3.5 w-3.5" />
              Practice ({content.exercises.length})
            </button>
          </div>
          <a
            href={repo.source}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-lg p-2 text-gray-500 hover:text-gray-300 transition-colors"
            title="View on GitHub"
          >
            <ExternalLink className="h-4 w-4" />
          </a>
          {/* Mobile sidebar toggle */}
          {mode === 'read' && (
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="md:hidden rounded-lg p-2 text-gray-400 hover:text-gray-200 transition-colors"
            >
              {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          )}
        </div>
      </div>

      {/* Content Area */}
      {mode === 'read' ? (
        <div className="flex flex-1 overflow-hidden">
          {/* Sidebar */}
          <div className={`${sidebarOpen ? 'block' : 'hidden'} md:block w-64 lg:w-72 border-r border-gray-800 overflow-y-auto p-3 flex-shrink-0 bg-gray-950`}>
            <SectionTree
              sections={content.sections}
              activeSectionId={displaySection?.id || null}
              onSelect={(s) => { setActiveSection(s); setSidebarOpen(false); }}
            />
          </div>

          {/* Main content */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
            {displaySection?.content ? (
              <MarkdownViewer content={displaySection.content} />
            ) : (
              <div className="text-center py-12 text-gray-500">
                Select a section from the sidebar to start reading.
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          <ExerciseRunner exercises={content.exercises} repoName={repo.name} />
        </div>
      )}
    </div>
  );
}
```

**Step 2: Add RepoView route to App.tsx**

In `src/App.tsx`:
- Import: `import RepoView from './pages/RepoView';`
- Add routes inside `<Route path="/" element={<Layout />}>`:
  ```tsx
  <Route path="library" element={<Library />} />
  <Route path="library/:repoSlug" element={<RepoView />} />
  ```

**Step 3: Verify both pages work**

Run: `npm run dev:frontend`
- Navigate to `/library` — should show grid
- Click a repo card — should navigate to `/library/<repo-slug>` and show section tree + markdown reader
- Toggle to Practice mode (will show "No exercises" for now since only base adapter is used)

**Step 4: Commit**

```bash
git add src/pages/RepoView.tsx src/App.tsx
git commit -m "feat(library): add RepoView page with read/practice modes and section navigation"
```

---

### Task 11: Add Library Nav Link to Layout

**Files:**
- Modify: `src/components/Layout.tsx`

**Step 1: Add Library link to top nav**

In `src/components/Layout.tsx`:

- Add `BookOpen` to the lucide-react import
- Add a Library link near the "All Topics" NavLink (in the right side of the nav, visible when NOT in a category):

```tsx
{!activeCategory && (
  <NavLink
    to="/library"
    className={({ isActive }) =>
      `flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-sm font-medium transition-colors ${
        isActive ? 'bg-emerald-500/20 text-emerald-400' : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800'
      }`
    }
  >
    <BookOpen className="h-4 w-4" />
    Library
  </NavLink>
)}
```

- Also add a Library link when inside a category (next to the "All Topics" link):

```tsx
<NavLink
  to="/library"
  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-gray-400 hover:text-gray-200 hover:bg-gray-800 transition-colors"
>
  <BookOpen className="h-3.5 w-3.5" />
  <span className="hidden sm:inline">Library</span>
</NavLink>
```

**Step 2: Add Library card to Home page**

In `src/pages/Home.tsx`, add a Library card below the category grid:

```tsx
<Link
  to="/library"
  className="group relative overflow-hidden rounded-2xl border border-emerald-500/30 hover:border-emerald-500/50 bg-gray-900 p-6 sm:p-8 transition-all hover:bg-gray-800/80 sm:col-span-2"
>
  <div className="mb-4 inline-flex rounded-xl bg-emerald-500/10 p-3">
    <BookOpen className="h-6 w-6 sm:h-7 sm:w-7 text-emerald-400" />
  </div>
  <h2 className="text-xl sm:text-2xl font-bold text-white">Library</h2>
  <p className="mt-1 text-sm text-gray-400">Browse curated learning repos with interactive exercises</p>
  <div className="mt-4 flex items-center gap-1 text-sm font-medium text-emerald-400">
    Explore <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
  </div>
</Link>
```

Add `BookOpen` to the lucide-react import in Home.tsx.

**Step 3: Verify navigation works**

- Home page shows Library card
- Clicking it navigates to `/library`
- Top nav shows Library link from anywhere
- Back navigation works

**Step 4: Commit**

```bash
git add src/components/Layout.tsx src/pages/Home.tsx
git commit -m "feat(library): add Library nav link to Layout and Home page"
```

---

### Task 12: Create JavaScript Questions Adapter

**Files:**
- Create: `src/adapters/javascript-questions.ts`
- Modify: `scripts/fetch-library.mjs` (wire adapter)

**Step 1: Study the sudheerj/javascript-interview-questions structure**

The README.md contains numbered questions in this format:
```markdown
1. ### What are the possible ways to create objects in JavaScript
   ...answer content...

   **[Back to Top](#table-of-contents)**

2. ### What is a prototype chain
   ...answer content...
```

**Step 2: Write the adapter**

```typescript
// src/adapters/javascript-questions.ts
import type { RepoFile, RepoAdapter, ParsedRepo, Section, Exercise } from './types';

function parseQAFromReadme(content: string): { sections: Section[]; exercises: Exercise[] } {
  const sections: Section[] = [];
  const exercises: Exercise[] = [];

  // Split by numbered questions: "1. ### Question text"
  const questionRegex = /^\d+\.\s+###\s+(.+)$/gm;
  const matches = [...content.matchAll(questionRegex)];

  for (let i = 0; i < matches.length; i++) {
    const match = matches[i];
    const questionTitle = match[1].trim();
    const startIdx = match.index! + match[0].length;
    const endIdx = i + 1 < matches.length ? matches[i + 1].index! : content.length;
    const answerContent = content.slice(startIdx, endIdx)
      .replace(/\*\*\[.*?Back to Top.*?\]\(.*?\)\*\*/g, '')
      .trim();

    const id = `js-q-${i + 1}`;

    // Add as section (for reader mode)
    sections.push({
      id,
      title: `${i + 1}. ${questionTitle}`,
      content: `### ${questionTitle}\n\n${answerContent}`,
    });

    // Add as Q&A exercise
    // Extract first paragraph as a concise answer
    const firstParagraph = answerContent.split('\n\n')[0]?.replace(/^[\s-]+/, '').trim() || answerContent;
    exercises.push({
      id,
      type: 'qa',
      question: questionTitle,
      answer: firstParagraph.length > 500 ? firstParagraph.slice(0, 500) + '...' : firstParagraph,
      tags: ['javascript'],
    });
  }

  return { sections, exercises };
}

export const javascriptQuestionsAdapter: RepoAdapter = {
  id: 'javascript-questions',
  name: 'JavaScript Interview Questions',
  source: 'https://github.com/sudheerj/javascript-interview-questions',
  description: '478+ JavaScript interview questions with answers',
  tags: ['javascript', 'interview', 'frontend'],
  icon: 'FileCode2',

  parseContent(files: RepoFile[]): ParsedRepo {
    const readme = files.find(f => f.path === 'README.md');
    if (!readme) return { sections: [], exercises: [], totalItems: 0 };

    const { sections, exercises } = parseQAFromReadme(readme.content);
    return {
      sections,
      exercises,
      totalItems: sections.length + exercises.length,
    };
  },
};
```

**Step 3: Wire the adapter into the fetch script**

This step requires modifying `scripts/fetch-library.mjs` to import and use custom adapters. Since the fetch script runs in Node.js (not via Vite), the adapters need to be written in the script itself or imported differently.

For now, duplicate the parsing logic directly in `fetch-library.mjs` for the `javascript-questions` and `react-questions` repos (they share the same format). Add a function:

```javascript
function parseSupheerQA(content) {
  const sections = [];
  const exercises = [];
  const questionRegex = /^\d+\.\s+###\s+(.+)$/gm;
  const matches = [...content.matchAll(questionRegex)];

  for (let i = 0; i < matches.length; i++) {
    const questionTitle = matches[i][1].trim();
    const startIdx = matches[i].index + matches[i][0].length;
    const endIdx = i + 1 < matches.length ? matches[i + 1].index : content.length;
    const answerContent = content.slice(startIdx, endIdx)
      .replace(/\*\*\[.*?Back to Top.*?\]\(.*?\)\*\*/g, '')
      .trim();

    const id = `q-${i + 1}`;
    sections.push({
      id,
      title: `${i + 1}. ${questionTitle}`,
      content: `### ${questionTitle}\n\n${answerContent}`,
    });

    const firstParagraph = answerContent.split('\n\n')[0]?.replace(/^[\s-]+/, '').trim() || answerContent;
    exercises.push({
      id,
      type: 'qa',
      question: questionTitle,
      answer: firstParagraph.length > 500 ? firstParagraph.slice(0, 500) + '...' : firstParagraph,
      tags: [],
    });
  }

  return { sections, exercises, totalItems: sections.length + exercises.length };
}
```

Then in the main loop, check `repo.adapter`:

```javascript
let parsed;
if (repo.adapter === 'javascript-questions' || repo.adapter === 'react-questions') {
  const readme = files.find(f => f.path === 'README.md');
  parsed = readme ? parseSupheerQA(readme.content) : { sections: [], exercises: [], totalItems: 0 };
  // Tag exercises
  const tag = repo.adapter === 'javascript-questions' ? 'javascript' : 'react';
  parsed.exercises.forEach(e => e.tags = [tag]);
} else {
  const sections = buildSectionTree(files);
  parsed = { sections, exercises: [], totalItems: countSections(sections) };
}
```

**Step 4: Re-run the fetch script**

Run: `npm run fetch-library`
Expected: javascript-questions and react-questions now show exercise counts.

**Step 5: Verify in browser**

Navigate to `/library/javascript-questions` — Practice tab should show exercises.

**Step 6: Commit**

```bash
git add src/adapters/javascript-questions.ts scripts/fetch-library.mjs
git commit -m "feat(library): add JavaScript/React questions adapter with Q&A extraction"
```

---

### Task 13: Create DevOps Exercises Adapter

**Files:**
- Modify: `scripts/fetch-library.mjs`

**Step 1: Study the bregman-arie/devops-exercises structure**

The repo has topic directories (e.g., `topics/linux/`, `topics/docker/`) each containing markdown files with this pattern:
```markdown
<details>
<summary>Question text here</summary><br><b>

Answer text here
</b></details>
```

**Step 2: Add devops parser to fetch script**

```javascript
function parseDevopsExercises(files) {
  const sections = [];
  const exercises = [];
  const topicFiles = files.filter(f => f.path.startsWith('topics/') && f.path.endsWith('.md'));

  for (const file of topicFiles) {
    const parts = file.path.split('/');
    const topicName = parts[1] || 'general';

    // Parse <details> blocks
    const detailsRegex = /<details>\s*<summary>([\s\S]*?)<\/summary>[\s\S]*?<b>\s*([\s\S]*?)\s*<\/b>\s*<\/details>/gi;
    const matches = [...file.content.matchAll(detailsRegex)];

    if (matches.length > 0) {
      const topicSection = {
        id: `devops-${topicName}`,
        title: topicName.replace(/[-_]/g, ' '),
        content: file.content,
      };
      sections.push(topicSection);

      for (let i = 0; i < matches.length; i++) {
        const question = matches[i][1].replace(/<[^>]*>/g, '').trim();
        const answer = matches[i][2].replace(/<[^>]*>/g, '').trim();
        if (question && answer) {
          exercises.push({
            id: `devops-${topicName}-${i}`,
            type: 'qa',
            question,
            answer: answer.length > 500 ? answer.slice(0, 500) + '...' : answer,
            tags: ['devops', topicName],
          });
        }
      }
    }
  }

  return { sections, exercises, totalItems: sections.length + exercises.length };
}
```

Wire it in the main loop:
```javascript
} else if (repo.adapter === 'devops-exercises') {
  parsed = parseDevopsExercises(files);
}
```

**Step 3: Re-run fetch script and verify**

Run: `npm run fetch-library`
Expected: devops-exercises shows large exercise count.

**Step 4: Commit**

```bash
git add scripts/fetch-library.mjs
git commit -m "feat(library): add DevOps exercises adapter with details-block Q&A extraction"
```

---

### Task 14: Add highlight.js CSS for Code Syntax Highlighting

**Files:**
- Modify: `src/index.css`

**Step 1: Import highlight.js dark theme**

Add to the top of `src/index.css`:

```css
@import 'highlight.js/styles/github-dark.css';
```

Or if that doesn't resolve, install highlight.js:
```bash
npm install highlight.js
```

Then add the import.

**Step 2: Verify code blocks render with syntax highlighting**

Navigate to any repo with code blocks, confirm colors appear.

**Step 3: Commit**

```bash
git add src/index.css package.json package-lock.json
git commit -m "feat(library): add syntax highlighting CSS for code blocks"
```

---

### Task 15: Final Integration Testing

**Files:** None (verification only)

**Step 1: Verify full user flow**

1. Home page → Library card visible → click navigates to `/library`
2. Library page → 12 repo cards with search, tags, stats
3. Search → filters repos by name/tag
4. Click repo card → navigates to RepoView
5. RepoView Read mode → section tree on left, markdown rendered on right
6. Click sections → content updates
7. RepoView Practice mode → exercises rendered (for JS/React/DevOps repos)
8. Exercise cards → reveal answers, navigate next
9. MCQ exercises → select options, show correct/incorrect
10. Back to Library → via breadcrumb or nav link
11. Mobile responsive → sidebar collapses to toggle, bottom bar works

**Step 2: Verify no TypeScript errors**

Run: `npx tsc --noEmit`
Expected: No errors.

**Step 3: Verify build succeeds**

Run: `npm run build`
Expected: Build completes. Library content lazy-loaded as separate chunks.

**Step 4: Commit any fixes**

```bash
git add -A
git commit -m "fix(library): integration fixes from end-to-end testing"
```

---

## Future Tasks (Post-V1)

These are documented here for reference but NOT part of this plan:

- **Custom adapters for remaining repos**: system-design, coding-interview-patterns, system-design-primer, javascript-algorithms (currently using base adapter)
- **Exercise progress persistence**: Track exercise completion in localStorage with spaced repetition
- **Deep-linking from category pages**: Link relevant library repos from pattern pages
- **Full-text search**: Search across all library content
- **AI-assisted exercise generation**: Use AI to generate MCQs from raw markdown content
