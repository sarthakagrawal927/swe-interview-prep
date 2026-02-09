# Interview Prep Tool: 7-Day Build & Launch Plan

**Goal:** Ship a working MVP with 50+ problems, AI explanations, and user submissions
**Effort:** ~30 hours of hands-on work (vs 120+ hours without AI)
**Cost:** ~$30 in AI tools + $0 infrastructure (all free tiers)

---

## BEFORE YOU START (30 mins)

### Setup
- [ ] Clone starter template
  ```bash
  git clone https://github.com/zeevo/t3-shadcn-ui.git interview-prep
  cd interview-prep
  npm install
  ```

- [ ] Create Supabase project (free tier)
  ```bash
  # Go to supabase.com, click "New Project"
  # Name it "interview-prep"
  # Save credentials
  ```

- [ ] Create Claude API key
  ```
  # Go to console.anthropic.com
  # Create free account ($5 credit for new users)
  # Generate API key
  ```

- [ ] Optional: Buy Cursor Pro ($20/month) or use GitHub Copilot ($10/month)

---

## DAY 1: Database & Backend Architecture (4 hours)

### 9:00 AM - Database Schema (1.5 hours)

**Tool:** Claude Code (Terminal)

1. Open terminal in project
2. Paste this prompt into Claude Code:

```
I'm building an interview prep tool with this stack:
- Supabase (PostgreSQL)
- Drizzle ORM
- tRPC backend

Create a complete Drizzle schema file with:
1. problems table: id, title, difficulty, description, examples (JSON), constraints, categories (JSON), acceptance_rate
2. solutions table: id, problem_id (FK), approach_name, code, explanation, time_complexity, space_complexity
3. users table: id, email, auth_provider
4. submissions table: id, user_id (FK), problem_id (FK), code, is_passing, submitted_at, test_results (JSON)
5. explanation_feedback table: id, submission_id (FK), rating (-1/0/1), user_comment

Add indices on problem_id, user_id, difficulty, created_at.
Output the schema.ts file ready to import.
```

**Output:** `src/server/db/schema.ts`

**Verify:**
- Run `npm run type-check` to ensure no TypeScript errors
- Schema compiles without errors

---

### 10:30 AM - Drizzle Migrations (1 hour)

**Tool:** Claude Code or Cursor

Run this in terminal:
```bash
npm run drizzle -- generate:sqlite
# Or if using PostgreSQL:
npm run drizzle -- generate
```

Push to Supabase:
```bash
npm run drizzle -- push:sqlite
# Or PostgreSQL:
npm run drizzle -- push
```

**Verify:**
- Go to Supabase dashboard
- Check "SQL Editor" → see your tables created
- No error messages in terminal

---

### 11:30 AM - tRPC Router Setup (1.5 hours)

**Tool:** Claude Code + Cursor

Create `src/server/routers/problems.router.ts`:

Prompt:
```
Create a tRPC router with these procedures:
- listProblems(difficulty?, category?, search?, page, limit): returns paginated problems
- getProblem(id): returns problem with all solutions
- getLeaderboard(): returns top 100 users by problems solved
- submitSolution(problem_id, code, language): saves to submissions table, returns {is_passing, test_results}
- generateExplanation(submission_id): calls Claude API, caches result, returns explanation
- rateSolution(solution_id, rating): saves feedback

Use Supabase client for DB queries.
Include proper error handling.
Return strongly typed responses.

Output:
- Complete router.ts file
- Type definitions for input/output
```

**Verify:**
- `npm run type-check` passes
- No red squiggly lines in IDE

---

### 1:00 PM - Claude API Integration (1 hour)

**File:** `src/server/utils/claude.ts`

Prompt:
```
Create a function to call Claude API for generating algorithm explanations.

Function: generateExplanation(code: string, problemTitle: string) → Promise<string>

Requirements:
- Use claude-3-5-sonnet-20241022 model (balanced cost/quality)
- Prompt should ask for explanation in this format:
  - Intuition (2-3 sentences)
  - Algorithm Steps (numbered)
  - Time Complexity (with notation)
  - Space Complexity (with notation)
  - Edge Cases (bullet list)

- Add error handling with 10-second timeout
- Log API usage (tokens, cost)
- Return formatted markdown string

Use:
const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

Implement prompt caching:
- Cache the algorithm patterns for 1 hour
- Cache read price is 10% of normal
```

**Verify:**
- Function compiles without errors
- Test with dummy input in separate test file

---

### 2:00 PM - Complete & Commit

```bash
# Ensure no type errors
npm run type-check

# Commit progress
git add .
git commit -m "Day 1: Database schema, tRPC router, Claude integration"
```

**End of Day 1:**
- Database schema complete
- tRPC router ready
- Claude API integration ready
- Backend compiles with 0 errors
- **Estimated time:** 4 hours (vs 12 hours without AI)

---

## DAY 2: Frontend UI Components (5 hours)

### 9:00 AM - Problem List Page (2 hours)

**Tool:** v0.dev

1. Go to v0.dev
2. Paste this prompt:

```
Create a Next.js + shadcn/ui component for problem list page.

Display:
- Table with columns: #, Title, Difficulty (easy/medium/hard with color badges), Category, Acceptance Rate
- Clickable rows navigate to /problems/[id]
- Filters: Difficulty (radio), Category (multi-select), Search (text input)
- Pagination (10 per page)
- Sort options: Difficulty, Acceptance Rate, Title
- Show checkmark if solved by current user
- Dark mode compatible
- Responsive (mobile: single column)

Use:
- shadcn/ui: DataTable, Select, Input, Badge, Button, Pagination
- Tailwind CSS for styling
- TypeScript for all components

Output single component ready to drop into pages/problems/index.tsx
```

3. Copy generated component
4. Paste into `src/pages/problems/index.tsx`
5. Wire up data fetching with tRPC hook

```typescript
import { api } from '@/utils/api';

export default function ProblemsPage() {
  const { data, isLoading } = api.problems.listProblems.useQuery({
    page: 1,
    limit: 10,
    difficulty: selectedDifficulty,
    category: selectedCategory,
  });

  // Render component with data
}
```

**Verify:**
- Page renders without errors
- Styling looks good in dark mode
- No console errors

---

### 11:00 AM - Problem Detail Page (1.5 hours)

**Tool:** v0.dev

```
Create problem detail page with code editor.

Left side (60%):
- Problem title, difficulty badge, description
- Examples section with input/output boxes
- Constraints, Topics (badges)

Right side (40%):
- Language selector (JavaScript, Python, Java, C++)
- Monaco code editor for writing solution
- Submit button
- Test Results (showing X/Y cases passed)

Tabs:
- Description (default)
- Solutions (shows approach + code)
- Submissions (user's previous attempts)

Features:
- Syntax highlighting
- Language persists to localStorage
- Loading state while testing
- Show failing test cases in red

Output: Complete component for pages/problems/[id].tsx
```

Copy to `src/pages/problems/[id].tsx`

**Verify:**
- Code editor renders
- No console errors
- Layout looks balanced

---

### 12:30 PM - Solution & Explanation Component (1.5 hours)

**Tool:** v0.dev (or Cursor for quick modifications)

```
Create component showing AI-generated solution explanation.

Display:
- Solution code in read-only Monaco editor
- Tabs: Intuition | Algorithm | Complexity | Edge Cases | Related

Content in each tab:
- Intuition: Plain English explanation (2-3 paragraphs)
- Algorithm: Numbered step-by-step walkthrough
- Complexity: "Time: O(n log n), Space: O(n)" with explanation
- Edge Cases: Bulleted list of special cases
- Related: Links to similar problems

Features:
- Copy code button
- Rate solution: Thumbs up/down
- Share button (copy problem link)
- "Loading explanation..." spinner while AI generates
- Markdown support for text

Use shadcn/ui: Card, Tabs, Badge, Button

Output: Component for solutions display
```

**Verify:**
- Renders without errors
- Tabs switch properly
- Code block displays correctly

---

### 2:00 PM - Wire up Components (1 hour)

Paste this prompt into Cursor:

```
I have three components:
1. ProblemsPage (list)
2. ProblemDetailPage (with editor)
3. SolutionExplanation (displays AI explanation)

Wire them together:
1. Click problem in list → navigate to detail page
2. Submit code in editor → call submitSolution tRPC procedure
3. Show test results with X/Y cases passing
4. If passing, show "Generate Explanation" button
5. Click button → call generateExplanation tRPC procedure
6. Display explanation in SolutionExplanation component
7. User rates explanation → call rateSolution procedure

Use Next.js routing and tRPC hooks.
Include loading states and error messages.

Also add:
- Back button from detail to list
- Previous/Next buttons to navigate between problems
- User's submission history
```

**Verify:**
- All pages load
- Navigation works
- tRPC hooks fire without errors

---

### 3:00 PM - Commit

```bash
git add .
git commit -m "Day 2: Frontend UI components and routing"
```

**End of Day 2:**
- Problem list page ready
- Problem detail page with editor ready
- Solution explanation display ready
- All components wired together
- **Estimated time:** 5 hours (vs 15 hours without AI)

---

## DAY 3: Authentication & Integration (3 hours)

### 9:00 AM - Supabase Auth Setup (1 hour)

**Tool:** Cursor or Claude Code

Prompt:
```
Setup Supabase authentication with Google OAuth.

Create:
1. AuthContext (React context for user state)
2. useAuth() hook returning: { user, signIn, signOut, isLoading }
3. Login page with:
   - Google OAuth button
   - Guest mode link (browse without account)
   - Sign up / Sign in forms
4. ProtectedRoute component (redirect to login if not authenticated)
5. Wrap _app.tsx with AuthProvider

Use Supabase client library (not NextAuth).
Store session in localStorage.
Sync with backend user table.

Output:
- contexts/auth.tsx
- hooks/useAuth.ts
- pages/auth/login.tsx
- components/ProtectedRoute.tsx
```

**Verify:**
- Login page renders
- Google OAuth button appears
- Guest mode works

---

### 10:00 AM - User Submissions Tracking (1 hour)

**Tool:** Cursor

```
Add user submission tracking.

When user submits code:
1. Save to submissions table (user_id, problem_id, code, is_passing, test_results)
2. If passing, allow explanation generation
3. Show user's submission history on problem detail page
4. Track in leaderboard (count of solved problems)

Create:
1. API endpoint: saveSubmission(problem_id, code) → returns is_passing, test_results
2. API endpoint: getUserSubmissions() → returns history of user's attempts
3. Update problem detail page to show user's best attempt
4. Wire leaderboard to show solved count for current user

Use tRPC procedures.
Include error handling.
```

**Verify:**
- Submissions save to database
- History loads correctly
- Leaderboard updates

---

### 11:00 AM - Styling & Polish (1 hour)

Quick pass with Copilot:

```
Polish the UI styling:
1. Ensure dark mode works on all pages
2. Add loading skeletons (don't show blank pages)
3. Improve button/input styling to match design
4. Add hover effects on interactive elements
5. Fix spacing/padding issues
6. Ensure responsive on mobile

Specific issues to fix:
- [Paste any styling bugs]

Use Tailwind CSS classes and shadcn/ui component variants.
```

**Verify:**
- Dark mode toggle works
- Loading states show skeletons
- Mobile responsive
- No styling inconsistencies

---

### 12:00 PM - Commit

```bash
git add .
git commit -m "Day 3: Authentication, user tracking, UI polish"
```

**End of Day 3:**
- Authentication working
- User submissions tracked
- Leaderboard functional
- UI polished
- **Estimated time:** 3 hours (vs 8 hours without AI)

---

## DAY 4: Content Seeding & Testing (4 hours)

### 9:00 AM - Seed Database with Problems (2 hours)

**Tool:** Claude Code

Create `scripts/seed.ts`:

```
Create a seed script to populate 50 interview problems.

Requirements:
- Read from hardcoded array of problems (include data in script)
- Insert into problems table
- Skip duplicates
- Log results (inserted: X, skipped: Y)

Problem structure:
{
  title: string,
  difficulty: 'easy' | 'medium' | 'hard',
  description: string,
  examples: [{ input: string, output: string, explanation: string }],
  constraints: string,
  categories: string[],
  acceptance_rate: number (0-100),
}

Sample problems to include:
1. Two Sum (Easy)
2. Add Two Numbers (Medium)
3. Longest Substring Without Repeating Characters (Medium)
4. Median of Two Sorted Arrays (Hard)
... (47 more common LeetCode problems)

Script should:
- Connect to Supabase
- Use Drizzle ORM
- Handle errors gracefully
- Be runnable with: npm run seed

Output: Complete seed.ts file with 50 problems
```

Run it:
```bash
npx ts-node scripts/seed.ts
```

**Verify:**
- Check Supabase dashboard → problems table has 50 rows
- No error messages

---

### 11:00 AM - Generate Sample Solutions & Explanations (1 hour)

**Tool:** Claude Code

Create `scripts/generate-explanations.ts`:

```
For the first 10 problems, generate 2 solutions each and explanations.

Use:
1. Fetch problem from database
2. Generate 2 different approaches (e.g., Brute Force + Optimized)
3. Write solution code for each
4. Call Claude API to generate explanation for each
5. Save to solutions table

Use claude-3-5-sonnet-20241022 model.
Include error handling if API fails.

This costs ~$5 for 20 explanations. Worth it to have content ready.

Output: Complete script
```

Run it:
```bash
npx ts-node scripts/generate-explanations.ts
```

**Verify:**
- Supabase solutions table has 20 rows
- Explanations look good (go to dashboard and read one)

---

### 12:00 PM - Add Sample User & Test Submissions (1 hour)

**Tool:** Cursor

Create test harness:

```
Add script to:
1. Create test user in Supabase Auth
2. Submit code solutions for 5 problems
3. Generate explanations for those solutions
4. Create ratings for explanations

Purpose: Verify the full flow works end-to-end.

Script should:
- Use Supabase client
- Simulate real user submissions
- Check that test results are calculated
- Verify explanations generate without errors

This ensures your app isn't broken before launching.

Output: Complete test script
```

Run it and verify no errors.

---

### 1:00 PM - Write Basic Tests (1 hour)

**Tool:** Cursor

Prompt:
```
Write Vitest tests for critical paths:

1. submitSolution test: Valid code → saves to DB, returns test results
2. generateExplanation test: Code submission → returns structured explanation
3. leaderboard test: Multiple users solving problems → correct ranking

Create tests/__unit__/problems.test.ts

Use:
- vitest for test runner
- Mock Supabase client
- Mock Claude API responses
- vi.mock() for dependencies

Tests should verify:
- Data saves correctly
- API returns correct shape
- No unhandled errors
- Edge cases (empty code, invalid problem_id)

Run with: npm run test
```

**Verify:**
```bash
npm run test
# Should show: ✓ 3 passed
```

---

### 2:00 PM - Commit

```bash
git add .
git commit -m "Day 4: Content seeding, tests, sample data"
```

**End of Day 4:**
- 50 problems in database
- 20 solutions with explanations
- Sample user data for testing
- Tests passing
- **Estimated time:** 4 hours (vs 8 hours without AI)

---

## DAY 5: Deploy & Production Setup (3 hours)

### 9:00 AM - Deploy Frontend to Vercel (30 mins)

```bash
# Push to GitHub
git push origin main

# Go to vercel.com
# Click "Import Project"
# Select your GitHub repo
# Vercel auto-detects Next.js
# Click "Deploy"
# Wait 2-3 minutes
```

**Verify:**
- Visit your-project.vercel.app
- App loads
- No console errors

---

### 9:30 AM - Deploy Backend to Railway (30 mins)

```bash
# Go to railway.app
# Click "New Project"
# Select "Deploy from GitHub"
# Select your repo
# Configure environment variables:
#   DATABASE_URL=[copy from Supabase]
#   ANTHROPIC_API_KEY=[your key]
# Click "Deploy"
```

**Verify:**
- API responds to requests
- Database connection works

---

### 10:00 AM - Configure Environment Variables (30 mins)

**Vercel:**
```bash
# Settings → Environment Variables
DATABASE_URL=postgresql://...
NEXT_PUBLIC_SUPABASE_URL=https://...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
```

**Railway:**
```bash
# Settings → Variables
DATABASE_URL=postgresql://...
ANTHROPIC_API_KEY=sk-ant-...
JWT_SECRET=[generate random string]
```

---

### 10:30 AM - Test Production App (1 hour)

**Checklist:**
- [ ] Can view problems list
- [ ] Can click into problem detail
- [ ] Can log in with Google
- [ ] Can submit solution code
- [ ] Submit button → test results appear
- [ ] Generate Explanation button → explanation appears in 5-10s
- [ ] Can rate explanation
- [ ] Leaderboard shows users sorted correctly
- [ ] Dark mode works
- [ ] Mobile looks good

**If something breaks:**
```bash
# Check logs
vercel logs # Frontend logs
railway logs # Backend logs

# Use Claude Code to debug:
"The submit button doesn't work. Frontend error: [paste error]. Fix it."
```

---

### 11:30 AM - Setup Cost Monitoring (30 mins)

**Tool:** Cursor

Add logging function:

```typescript
// lib/logging.ts
export const logAICall = async (model: string, cost: number, feature: string) => {
  const today = new Date().toISOString().split('T')[0]
  const key = `ai_costs:${today}`
  // Store in Redis or database
  await db.insert('ai_costs', {
    model,
    cost,
    feature,
    timestamp: new Date()
  })
}

// Hook this into generateExplanation() calls
```

---

### 12:00 PM - Final Commit

```bash
git add .
git commit -m "Day 5: Production deployment and monitoring"
```

**End of Day 5:**
- App live at yourapp.vercel.app
- Backend running on Railway
- Production database configured
- Cost tracking enabled
- **Estimated time:** 3 hours (vs 10 hours without AI)

---

## DAY 6: Content & Marketing (4 hours)

### 9:00 AM - Create Content (2 hours)

Add 40 more problems (total 90):

**Option A: Semi-auto with Claude**
```
Generate 40 LeetCode-style interview problems in this format:
{
  title: string,
  difficulty: 'easy'|'medium'|'hard',
  description: string,
  examples: [{input, output, explanation}],
  constraints: string,
  categories: string[]
}

Problems should cover:
- Array (8 problems)
- String (8 problems)
- Linked List (8 problems)
- Tree (8 problems)
- Graph (8 problems)

Output: JSON array of 40 problems
```

**Option B: Copy from LeetCode**
- Manually copy titles, descriptions from leetcode.com
- Paste into seed script
- Run seeding

Spend 1 hour getting to 90 problems total.

---

### 11:00 AM - Write Comparison Articles (1.5 hours)

Create blog section:

```markdown
# Why This Interview Prep Tool?

## Comparison vs LeetCode

| Feature | This Tool | LeetCode |
|---------|-----------|----------|
| AI Explanations | ✓ Free | ✗ Premium only |
| Interview Problems | 90 | 3000+ |
| Community Solutions | ✓ | ✓ |
| Pricing | Free | $149/year |

## How to Use

1. Browse interview problems by difficulty
2. Code your solution in the browser
3. Submit to test against cases
4. Get AI explanation if stuck
5. Rate explanation to improve AI

[etc.]
```

Save as `/pages/blog/why-this-tool.md`

---

### 12:30 PM - Create Landing Page (30 mins)

Use v0.dev:

```
Create a landing page for interview prep app.

Sections:
1. Hero: "Ship Interview Prep Faster"
2. Features: List 3-4 key features
3. Screenshot/demo
4. CTA: "Start Practicing Free"
5. Footer: Links, GitHub link

Keep it minimal and fast.
Use Tailwind CSS.
```

Save as `pages/index.tsx` (home page)

---

### 1:00 PM - Social Assets (1 hour)

Create quick launch assets:

- Product Hunt description (150 words)
- Twitter thread (3-5 tweets)
- Indie Hackers description
- GitHub README with screenshots

**Example Product Hunt description:**
```
Ship interview prep faster with AI.

Practice LeetCode-style problems. Submit code. Get instant AI explanations of optimal solutions.

Built for developers who want to practice interviews without paying $149/year for LeetCode premium.

Free. Open source. 90+ problems with AI explanations.

Features:
- 90+ interview problems (Easy/Medium/Hard)
- Code editor in browser
- AI-powered explanations
- Test case verification
- User leaderboard

Built with Next.js, Supabase, Claude AI
```

---

### 2:00 PM - Commit & Push

```bash
git add .
git commit -m "Day 6: Content library, blog, landing page, marketing assets"
git push origin main
```

**End of Day 6:**
- 90+ problems in database
- Landing page live
- Blog post published
- Marketing assets ready
- **Estimated time:** 4 hours

---

## DAY 7: Launch & Iterate (4 hours)

### 9:00 AM - Beta Launch (1 hour)

**Channels:**
1. Product Hunt https://www.producthunt.com/launch
2. Indie Hackers https://www.indiehackers.com/post
3. Twitter thread
4. Reddit /r/cscareerquestions, /r/learnprogramming
5. HackerNews /newest
6. Dev.to
7. Email to friends/contacts

**Talking points:**
- Free vs LeetCode's $149/year
- Built with AI (Claude), can ship updates fast
- Open source on GitHub
- Made by solo developer in 1 week (use this as social proof)

---

### 10:00 AM - Monitor & Fix Bugs (2 hours)

Watch for:
- Server errors in logs
- Slow API responses
- UI bugs from real users
- Comments/feedback

Use Claude Code to quickly fix issues:
```
User reported: "Submit button doesn't work on mobile"
Error log: [paste error]
Fix this.
```

Common fixes:
- UI scaling on mobile
- Long loading times → add skeleton
- API timeouts → increase timeout, add retry

---

### 12:00 PM - Gather Feedback (1 hour)

Create simple feedback form (v0.dev):

```
Create feedback form with:
- Rating (1-5 stars)
- What was helpful? (text)
- What could improve? (text)
- Would you pay for this? (yes/no)
- Email (optional)

Save to database.
```

Share form link in Product Hunt comments and Reddit.

---

### 1:00 PM - Plan Next Features (1 hour)

Based on feedback, identify top 3 features for next sprint:

Common requests:
1. Spaced repetition schedule
2. Interview timer mode (45-min practice interviews)
3. Problem tags/filters by company (Amazon, Google, etc)
4. Discussion/comments on problems
5. Solution view with community votes

Pick top 1-2 based on user votes.

---

### 2:00 PM - Final Commit

```bash
git add .
git commit -m "Day 7: Public launch and iteration"
```

---

## METRICS TO TRACK

Create simple dashboard to measure success:

```
Week 1 Targets:
- 50+ unique visitors
- 10+ active users
- 100+ problems viewed
- 20+ solutions submitted
- $0 cost for infrastructure (all free tiers)
- <$50 spent on AI tools

Success = Getting 5+ users to submit code
```

---

## TIME BREAKDOWN

| Task | Time Without AI | Time With AI | Savings |
|------|-----------------|--------------|---------|
| Database schema | 3 hours | 30 mins | 83% |
| tRPC backend | 8 hours | 1.5 hours | 81% |
| Frontend UI | 15 hours | 3 hours | 80% |
| Integration | 8 hours | 1 hour | 87% |
| Auth setup | 4 hours | 1 hour | 75% |
| Testing | 6 hours | 1.5 hours | 75% |
| Deployment | 6 hours | 1 hour | 83% |
| Content seeding | 4 hours | 1 hour | 75% |
| **Total** | **120 hours** | **25 hours** | **79% savings** |

---

## COMMON ISSUES & FIXES

### "API calls are too expensive"
→ Add prompt caching (reduces costs 90%)
→ Use Haiku for code checking, Opus for explanations only

### "Mobile looks broken"
→ Use v0.dev to regenerate component with responsive design
→ Test with `npm run dev` and resize browser

### "Submit button times out"
→ Add 30-second timeout with retry logic
→ Check Railway logs for backend errors
→ Use Claude Code: "Why is the submitSolution endpoint slow?"

### "Users complaining about bad explanations"
→ Switch to Claude Opus (better quality)
→ Ask users to rate explanations, use ratings to improve prompts
→ Create prompt library with better templates

---

## LAUNCH CHECKLIST

Before announcing publicly:

- [ ] App loads in <3 seconds
- [ ] Mobile UI works
- [ ] Can view 5+ problems
- [ ] Can submit solution
- [ ] Can generate explanation
- [ ] Dark mode works
- [ ] No console errors
- [ ] No broken links
- [ ] GitHub repo has README
- [ ] Product Hunt listing ready
- [ ] Twitter thread ready
- [ ] Cost monitoring set up
- [ ] Analytics tracking events

---

## CONGRATULATIONS!

You've shipped an interview prep tool in 1 week using AI tools.

**What you built:**
- 90+ interview problems
- AI-powered explanations
- User submissions tracking
- Leaderboard
- Google authentication
- Production deployment

**What you learned:**
- How fast AI tools make development
- Prompt engineering for specific tasks
- Full-stack shipping in short timeframes
- Cost optimization strategies

**Next steps:**
1. Gather user feedback for 1 week
2. Identify top 2-3 feature requests
3. Build improvements in week 2
4. Plan monetization (premium explanations, interview prep course, etc)
5. Marketing push to 1000+ users

---

## TEAM-BASED SPEEDUP (Optional)

If you have teammates available, parallelize with git worktrees:

**Developer 1:** Backend (tRPC, Claude integration)
**Developer 2:** Frontend (UI components, routing)
**Developer 3:** Content (seed problems, write blog)

Run in parallel:
```bash
# Each dev works on their own branch
git worktree add ../interview-prep-backend develop
git worktree add ../interview-prep-frontend develop
git worktree add ../interview-prep-content develop

# Merge back after day 3-4
git merge interview-prep-backend
git merge interview-prep-frontend
```

**Result:** 25 hours → 15 hours total (3x faster)
