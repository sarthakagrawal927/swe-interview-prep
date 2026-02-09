# AI Development Quick Reference Cheatsheet

**For building interview prep tools in 1-2 weeks**

---

## TOOL SELECTION MATRIX

```
NEED              BEST TOOL              COST/MO   TIME SAVED
Backend scaffold  Claude Code (terminal) $5-20     80%
Frontend UI       v0.dev                 Free      75%
IDE development   Cursor                 $20       60%
Quick fixes       GitHub Copilot         $10       40%
Tests/docs        Claude Code            $5-20     70%
```

---

## THE 2-DAY CORE STACK

### Setup (30 mins)
```bash
git clone https://github.com/zeevo/t3-shadcn-ui.git
cd interview-prep
npm install
# Create Supabase project (free tier)
# Generate Claude API key (comes with $5 credit)
```

### Day 1: Backend (Claude Code, 4 hours)
```
Prompts to use:
1. "Create Supabase schema for interview prep with Drizzle ORM"
2. "Create tRPC router with listProblems, getProblem, submitSolution, generateExplanation"
3. "Create Claude API integration for algorithm explanations with prompt caching"
```

### Day 2: Frontend (v0.dev + Cursor, 4 hours)
```
1. v0.dev: "Problem list UI with filtering and pagination"
2. v0.dev: "Problem detail page with code editor and explanation display"
3. Cursor: "Connect frontend to tRPC backend APIs"
```

### Result
- Working app with 50 problems
- Code submission tracking
- AI explanations
- Deployed to Vercel + Railway
- **Total: 8 hours vs 40 hours manually**

---

## COST OPTIMIZATION QUICK WINS

### Win 1: Prompt Caching (90% reduction)
```python
# Cache algorithm patterns once
CACHED_PATTERNS = """[100K tokens of patterns]"""

response = client.messages.create(
    system=[{
        "type": "text",
        "text": CACHED_PATTERNS,
        "cache_control": {"type": "ephemeral"}
    }],
    messages=[...]
)
```
Cost: $0.50 cache + $0.005/read vs $0.10 per fresh = 95% savings

### Win 2: Use Haiku for 70% of Work
```typescript
// Check passing tests (cheap)
const passing = await checkWithHaiku(code)

// Only generate explanation if passing (expensive)
if (passing) {
    const explanation = await generateWithOpus(code)
}
```
Savings: 70% cheaper, same results

### Win 3: Batch API for Overnight
```python
# Generate 100 explanations at 50% discount
response = client.beta.messages.batch.create(
    requests=[
        {"messages": [{"role": "user", "content": f"Explain problem {i}"}]}
        for i in range(100)
    ]
)
```
Savings: 50% off API cost for non-realtime tasks

---

## MODEL SELECTION GUIDE

```
Task                          Model              Cost  Quality
Simple formatting             Haiku 3.5          $$    ★★★
Boilerplate/CRUD              Haiku 3.5          $$    ★★★
Code checking/testing         Haiku 3.5          $$    ★★★
Algorithm explanations        Opus 4.5           $$$   ★★★★★
Complex refactoring           Sonnet 4           $$$$  ★★★★
Edge case analysis            Opus 4.5           $$$   ★★★★★
```

**Cost per 1M tokens:**
- Haiku: $0.80 input, $4 output
- Sonnet: $3 input, $15 output
- Opus: $5 input, $25 output

---

## GIT WORKTREES FOR PARALLEL WORK

```bash
# Setup parallel development
git worktree add ../backend feature/backend
git worktree add ../frontend feature/frontend

# In terminal 1: cd ../backend && claude-code
# In terminal 2: cd ../frontend && cursor

# Result: 2 developers working independently
# Merge when done: git merge feature/backend feature/frontend
```

**Time savings:** 25 hours solo → 15 hours with 2 devs in parallel

---

## DATABASE SCHEMA TEMPLATE

```typescript
import { pgTable, varchar, text, serial, timestamp, jsonb, boolean } from "drizzle-orm/pg-core";

export const problems = pgTable("problems", {
  id: serial("id").primaryKey(),
  title: varchar("title").notNull().unique(),
  difficulty: varchar("difficulty").notNull(), // easy, medium, hard
  description: text("description").notNull(),
  examples: jsonb("examples").notNull(), // [{input, output}]
  categories: jsonb("categories").notNull(), // ["Array", "String"]
  created_at: timestamp("created_at").defaultNow(),
});

export const submissions = pgTable("submissions", {
  id: serial("id").primaryKey(),
  user_id: varchar("user_id").notNull(),
  problem_id: serial("problem_id").references(() => problems.id),
  code: text("code").notNull(),
  is_passing: boolean("is_passing"),
  submitted_at: timestamp("submitted_at").defaultNow(),
});
```

---

## QUICK API CONTRACTS

### List Problems
```typescript
// Input
{
  difficulty?: "easy" | "medium" | "hard",
  category?: string,
  search?: string,
  page: number,
  limit: number
}

// Output
{
  problems: Problem[],
  total: number,
  pages: number
}
```

### Submit Solution
```typescript
// Input
{
  problem_id: number,
  code: string,
  language: "javascript" | "python" | "java"
}

// Output
{
  is_passing: boolean,
  test_results: {
    passed: number,
    failed: number,
    errors: string[]
  }
}
```

### Generate Explanation
```typescript
// Input
{
  submission_id: number
}

// Output
{
  intuition: string,
  algorithm: string,
  time_complexity: string,
  space_complexity: string,
  edge_cases: string[]
}
```

---

## DEPLOYMENT CHECKLIST

```
Frontend (Vercel - 1 click):
- [ ] Push to GitHub
- [ ] vercel.com → Import project
- [ ] Set environment variables
- [ ] Deploy

Backend (Railway - 5 mins):
- [ ] railway.app → New Project
- [ ] Connect GitHub repo
- [ ] Set env vars (DATABASE_URL, ANTHROPIC_API_KEY)
- [ ] Deploy

Database (Supabase):
- [ ] Create project
- [ ] Run migrations
- [ ] Seed data

Monitoring:
- [ ] Setup error logging
- [ ] Setup cost tracking
- [ ] Setup performance monitoring
```

---

## COMMON PROMPTS TO COPY-PASTE

### Backend Scaffolding
```
Create a complete tRPC backend for interview prep with:
- listProblems procedure (paginated, filterable by difficulty/category)
- submitSolution procedure (saves code, checks test cases)
- generateExplanation procedure (calls Claude API with caching)
- Uses Supabase for database
- Proper error handling and validation
```

### UI Components
```
Create a shadcn/ui component for:
[Describe what you want - e.g., "Problem list table with difficulty badges"]
Use Next.js + TypeScript + Tailwind CSS
Include responsive design for mobile
```

### Integration
```
Wire up frontend component to tRPC backend:
1. Component: [name]
2. Data needed: [what data]
3. Procedure: [which tRPC procedure]
Include loading states and error handling
```

---

## TIME ESTIMATES

| Task | With AI | Without AI | Savings |
|------|---------|-----------|---------|
| Database schema | 30 mins | 2 hours | 75% |
| tRPC API | 1.5 hours | 6 hours | 75% |
| Frontend (5 pages) | 2 hours | 10 hours | 80% |
| Integration | 1 hour | 4 hours | 75% |
| Auth setup | 1 hour | 3 hours | 67% |
| Testing | 1.5 hours | 5 hours | 70% |
| Deployment | 1 hour | 4 hours | 75% |
| Content/Seeding | 1 hour | 3 hours | 67% |
| **TOTAL** | **9 hours** | **37 hours** | **76%** |

---

## COST BREAKDOWN (100 active users)

### Without Optimization
- Claude API: $50/month (every explanation expensive)
- Vercel: Free tier
- Supabase: Free tier
- Cursor: $20/month
- **Total: $70/month**

### With Optimization
- Claude API: $2/month (Haiku + caching + batch)
- Vercel: Free
- Supabase: Free
- GitHub Copilot: $10/month
- **Total: $12/month**

### Savings: 83%

---

## RED FLAGS (Avoid These)

```
❌ Building without architecture → Bloated code
❌ Using Opus for everything → 90% cost waste
❌ No testing AI output → 1.7x more bugs
❌ Over-scoping MVP → Never ships
❌ No error handling → Production breaks
❌ Ignoring prompt caching → 90% cost overrun
❌ No monitoring → Can't debug problems
❌ Building features nobody wants → Wasted time
```

---

## SUCCESS CHECKLIST (Launch Ready)

- [ ] App loads in <3 seconds
- [ ] Can view 50+ problems
- [ ] Can submit code and see test results
- [ ] Can generate explanations (works in 5-10s)
- [ ] Dark mode works
- [ ] Mobile responsive
- [ ] No console errors
- [ ] Authentication works
- [ ] Deployed to production
- [ ] Cost tracking enabled
- [ ] README with setup instructions
- [ ] GitHub repo public
- [ ] Product Hunt listing ready

---

## QUICK START (Copy-Paste This)

```bash
# 1. Clone template (5 mins)
git clone https://github.com/zeevo/t3-shadcn-ui.git interview-prep
cd interview-prep
npm install

# 2. Create Supabase account (5 mins)
# → supabase.com → New project → Get credentials

# 3. Create Claude API key (2 mins)
# → console.anthropic.com → Create API key

# 4. Run database setup (5 mins)
npm run drizzle -- push

# 5. Seed problems (5 mins)
npx ts-node scripts/seed.ts

# 6. Start development (1 min)
npm run dev

# 7. Open in Cursor or Copilot (2 mins)
# → Start building with AI assistance

# Result: Working interview prep app in 25 minutes setup
```

---

## ONE-WEEK LAUNCH TIMELINE

```
Monday: Database + Backend (4 hours)
Tuesday: Frontend UI (4 hours)
Wednesday: Integration + Auth (3 hours)
Thursday: Content seeding + Testing (3 hours)
Friday: Deployment + Polish (3 hours)
Weekend: Marketing + Social media

Total: 20 hours of actual work
Result: Live app on Monday

Cost: ~$25 (Claude API) + $0 (infrastructure free tiers)
```

---

## RESOURCES LINKS

**Tools:**
- Cursor: https://www.cursor.com/
- v0.dev: https://v0.dev/
- Claude Code: https://claude.com/
- GitHub Copilot: https://github.com/features/copilot

**Templates:**
- T3 Stack: https://create.t3.gg/
- shadcn/ui: https://ui.shadcn.com/
- Create T3 + shadcn: https://github.com/zeevo/t3-shadcn-ui

**Documentation:**
- Claude API: https://platform.claude.com/docs/
- Supabase: https://supabase.com/docs/
- Drizzle: https://orm.drizzle.team/
- tRPC: https://trpc.io/

---

## KEY INSIGHTS FROM 2025-2026

1. **Vibe coding is mainstream** - Natural language → working code is standard now
2. **Model selection matters** - Using wrong model = 90% cost waste
3. **Caching is critical** - 90% cost reduction with prompt caching
4. **Parallel agents work** - 3-4 weeks of work in 5 days is real
5. **MVP focus wins** - Ship fast, iterate on feedback
6. **AI code needs testing** - 1.7x more bugs than human code
7. **Hybrid tools win** - Right tool for right job, not one tool for everything
8. **Free tiers are enough** - Can launch with $0 infrastructure
9. **Solo devs ship faster** - No coordination overhead
10. **Speed is competitive advantage** - First-mover advantage still matters

---

**Last Updated:** February 2026
**For:** Interview Prep Tool Development
**Effort:** 1-2 weeks solo, 3-5 days with team
**Cost:** $10-50/month (with optimization)
