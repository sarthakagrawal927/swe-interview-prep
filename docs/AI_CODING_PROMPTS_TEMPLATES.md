# AI Coding Prompts & Templates for Interview Prep Tools

**Purpose:** Copy-paste prompts optimized for Claude Code, Cursor, and ChatGPT to build your interview prep tool in 1 week.

---

## 1. BACKEND SCAFFOLDING PROMPTS

### Prompt 1: Database Schema + Migrations

Use this with **Claude Code** (terminal) or paste in **Cursor**:

```
I'm building an interview prep tool. Create a complete Supabase/PostgreSQL schema with migrations using Drizzle ORM.

Requirements:
- Problems table: id, title, difficulty (easy/medium/hard), description, examples, constraints, categories, created_at
- Solutions table: id, problem_id (FK), approach_name, code, explanation, time_complexity, space_complexity
- Users table: id, email, auth_provider (google), created_at
- Submissions table: id, user_id (FK), problem_id (FK), code, is_passing, submitted_at
- Explanation_feedback: id, explanation_id (FK), rating (-1/0/1), user_feedback, created_at

Additional requirements:
- Use Drizzle ORM
- Add indices on frequently queried columns (user_id, problem_id, difficulty)
- Include timestamps for all tables
- Add soft deletes for problems/solutions
- Include JSON fields for examples, constraints

Output:
- A complete schema.ts file with all table definitions
- A migrations folder with create-all migration
- Drizzle config file
```

**Cost:** ~$0.15 with Haiku 3.5 (quick scaffolding task)
**Time saved:** 2-3 hours

---

### Prompt 2: tRPC API Procedures

```
Create tRPC procedures for an interview prep app using the schema above.

Procedures needed:
1. listProblems: filter by difficulty, category, search by title (paginated)
2. getProblem: get full problem details with all solutions
3. getSolution: get single solution for a problem
4. submitSolution: save user code submission
5. generateExplanation: call Claude API to explain a solution
6. getLeaderboard: top 100 users by problems solved
7. getUserSubmissions: paginated list of current user's submissions
8. getFeedback: get explanation feedback from users
9. submitExplanationFeedback: rate an explanation (1-5 or helpful/not)

Requirements:
- Use async server-side calls for Claude API
- Add middleware for authentication check
- Include proper error handling and validation
- Return strongly-typed responses
- Use Supabase client for DB queries
- Add rate limiting for Claude API calls (max 5 per user per day)

Output:
- Complete router.ts with all procedures
- Type definitions for inputs/outputs
- Error handling middleware
- Example implementation for 2-3 procedures
```

**Cost:** ~$0.30 with Haiku 3.5
**Time saved:** 3-4 hours

---

### Prompt 3: Claude API Integration for Explanations

```
Create a server function to integrate Claude API for generating algorithm explanations.

Requirements:
- Input: problem_id, solution_code, approach_name
- Output: structured explanation with sections: intuition, algorithm_steps, complexity_analysis, edge_cases
- Use prompt caching to cache common algorithm patterns (100K token limit)
- Implement fallback to cheaper model if cost limit exceeded
- Cache explanations in database to avoid regenerating
- Add timeout (10 seconds max for explanation generation)
- Log API costs and token usage

Use Claude models intelligently:
- For new explanations: use claude-opus-4.5
- For cached/similar: use claude-sonnet-4
- For formatting: use claude-haiku-3.5

Pseudo-code structure:
1. Check if explanation exists in DB
2. If exists, return cached
3. If not, call Claude with prompt caching
4. Store result with problem_id as cache key
5. Return formatted response

Output:
- Complete generateExplanation() function
- Type definitions for cached explanations
- Error handling with fallback messages
- Database save logic
```

**Cost:** ~$0.25 with Haiku 3.5
**Time saved:** 2-3 hours

---

## 2. FRONTEND UI PROMPTS FOR v0.dev

### Prompt 4: Problem List Page (v0.dev)

Go to **v0.dev** and paste this:

```
Create a Next.js + shadcn/ui component for a problem list page.

Requirements:
- Display 50+ LeetCode-style interview problems
- Columns: # (number), Title, Difficulty (easy/medium/hard color-coded), Category (Array, Tree, Graph, etc), Acceptance Rate
- Clickable rows that navigate to problem detail page
- Difficulty filter (radio group: All, Easy, Medium, Hard)
- Category filter (multi-select: Array, String, Tree, Graph, DP, etc)
- Search bar to filter by problem title
- Pagination (10 problems per page)
- Sort options: difficulty, title, acceptance rate
- Show checkmark icon if user has solved the problem
- Hover effects on rows

Styling:
- Dark mode compatible (use Tailwind dark: prefix)
- Use shadcn/ui components: DataTable, Select, Input, Badge, Button
- Responsive design (mobile: single column, desktop: full table)
- Loading skeleton while data fetches

Output:
- Complete React component
- Use useState hooks for filters
- Include TypeScript types
```

**Cost:** Free with v0.dev free tier
**Time saved:** 1-2 hours vs coding from scratch

---

### Prompt 5: Problem Detail & Code Editor (v0.dev)

```
Create a Next.js + shadcn/ui component for the problem detail page.

Left side (60%):
- Problem title (large)
- Difficulty badge (color-coded)
- Problem description (markdown supported)
- Examples section (formatted code blocks with input/output)
- Constraints section
- Topics (badges: Array, DP, etc)

Right side (40%):
- Monaco code editor (JavaScript/Python/Java/C++)
- Language selector dropdown
- Submit button
- Test Results section (shows pass/fail for test cases)

Tab structure:
- Description (default)
- Solutions (shows community solutions with ratings)
- Submissions (shows your previous attempts)
- Discussion (shows top comments)

Features:
- Code editor with syntax highlighting
- Language selection persists to localStorage
- Submit button triggers test case validation
- Show loading spinner while testing
- Display results: X/Y test cases passed

Output:
- Complete component with Monaco editor integration
- Use shadcn/ui for tabs, badges, buttons
- TypeScript types for problem data
```

**Cost:** Free with v0.dev
**Time saved:** 2-3 hours

---

### Prompt 6: Solution Explanation Component

```
Create a shadcn/ui component that displays AI-generated solution explanations.

Layout:
- Solution code (syntax-highlighted, Monaco viewer)
- Explanation section with tabs:
  - Intuition (plain English explanation)
  - Algorithm Steps (numbered list)
  - Complexity Analysis (Time & Space)
  - Edge Cases (special cases handled)
  - Related Problems (links to similar problems)

Features:
- Copy code button
- Rate explanation (thumbs up/down or 1-5 stars)
- Share solution link
- Show "Loading explanation..." while AI generates
- Error state if explanation fails to generate
- Markdown support for explanation text
- Code syntax highlighting with Shiki

Styling:
- Use shadcn/ui Card for container
- Tabs component for sections
- Badge for complexity notation (O(n), O(log n), etc)
- Color-code complexity (green=good, yellow=okay, red=poor)

Output:
- Complete React component
- Props: solution, problem, isLoading, onRatingSubmit
- TypeScript types
```

**Cost:** Free with v0.dev
**Time saved:** 1.5-2 hours

---

## 3. INTEGRATION PROMPTS FOR CURSOR

### Prompt 7: Connect Frontend to Backend APIs

Paste in **Cursor** with your codebase context:

```
I have a Next.js frontend and tRPC backend already created. Connect the problem list page to the backend.

Requirements:
- Use tRPC client to fetch problems from listProblems procedure
- Pass filters (difficulty, category, search) to backend
- Implement pagination with useInfiniteQuery
- Show loading skeleton while fetching
- Handle errors gracefully
- Cache results for 1 minute

Create:
1. Custom hook useProblemList() that returns { problems, isLoading, hasMore, loadMore, filters, setFilters }
2. Update the problem list page component to use this hook
3. Add TypeScript types from tRPC router
4. Implement refetch on filter change

Code structure:
- hooks/useProblems.ts (custom hook)
- Update page that uses it
- Include error boundary
```

**Time saved:** 45 minutes vs manual API setup

---

### Prompt 8: Add Authentication Flow

```
Integrate Supabase authentication into the app.

Requirements:
- Google OAuth login button
- Guest mode (allow browsing without login)
- Save user to Supabase auth on signup
- Store session in localStorage
- Redirect to login if user tries to submit solution without auth
- Show user email in top-right corner when logged in
- Logout button

Create:
1. AuthContext with useAuth hook
2. Login page with Google OAuth button + guest mode link
3. ProtectedRoute wrapper for submission feature
4. AuthProvider wrapper for _app.tsx

Use Supabase client library for auth, not NextAuth (simpler for MVP).
Include error handling for failed logins.
```

**Time saved:** 2-3 hours

---

## 4. SUPABASE SETUP PROMPTS

### Prompt 9: Seed Database with Problems

Use **Claude Code** with file access:

```
Create a script to seed Supabase with LeetCode problems.

Input: CSV file with columns [id, title, difficulty, description, examples, category, acceptance_rate]
or JSON array of problems

Create:
1. seed.ts file using Drizzle ORM
2. Read from CSV or JSON
3. Insert 50+ problems into database
4. Handle duplicates (skip if title exists)
5. Validate data before insert
6. Log success/failure counts

The script should:
- Use supabase client
- Insert with error handling
- Return count of inserted problems
- Be runnable with: ts-node seed.ts

Include example data for 10 problems to get started.
Output the seed.ts file and example data file.
```

**Cost:** ~$0.10 with Haiku
**Time saved:** 1-2 hours

---

## 5. PROMPT CACHING EXAMPLES

### Prompt 10: Setup Cached Algorithm Patterns

For use in Claude API calls (to reduce cost by 90%):

```python
# This prompt gets cached for 1 hour across all explanation requests
# Cost: ~$0.50 to cache + $0.005 per read (vs $0.10 per fresh call)

ALGORITHM_PATTERNS_CACHE = """
You are an expert algorithm interviewer specializing in coding interviews.
Here are common problem patterns with solutions:

1. TWO POINTERS PATTERN
Problems: Remove Duplicates, Valid Palindrome, Container With Most Water
Approach: Start from opposite ends, move towards center
Common mistakes: Modifying input array, off-by-one errors

2. SLIDING WINDOW PATTERN
Problems: Longest Substring Without Repeating, Min Window Substring
Approach: Maintain window with two pointers, expand/contract
Optimization: Use hash map to track characters

3. DYNAMIC PROGRAMMING PATTERN
Problems: Coin Change, Longest Increasing Subsequence
Approach: Break into subproblems, cache results
Space optimization: Use 1D array instead of 2D when possible

[... more patterns ...]

When generating explanations, reference these patterns explicitly.
"""
```

**How to use in code:**

```python
import anthropic

client = anthropic.Anthropic()

def generate_explanation_cached(problem_code, problem_title):
    response = client.messages.create(
        model="claude-3-5-sonnet-20241022",
        max_tokens=1024,
        system=[
            {
                "type": "text",
                "text": ALGORITHM_PATTERNS_CACHE,
                "cache_control": {"type": "ephemeral"}
            }
        ],
        messages=[
            {
                "role": "user",
                "content": f"Explain this solution for {problem_title}:\n\n{problem_code}"
            }
        ]
    )
    return response.content[0].text
```

**Cost savings:** From $1.00 to $0.10 per 100 explanation requests

---

## 6. ERROR HANDLING PROMPTS

### Prompt 11: Robust Error Handling

```
Add comprehensive error handling to tRPC procedures for the interview prep app.

Error cases to handle:
1. Database connection errors → return 500 with message "Server error, try again"
2. Invalid input (empty submission code) → return 400 with field-level errors
3. Claude API timeouts (>10s) → return 408 with "Explanation taking too long"
4. Rate limit exceeded → return 429 with "You've generated 5 explanations today"
5. Unauthenticated requests → return 401 with "Please log in"
6. Test case failures → return 200 with test results showing which cases failed
7. Supabase quota exceeded → gracefully degrade to cached explanation

Create:
- Custom error class for each error type
- Middleware to catch and format errors
- User-friendly error messages (not stack traces)
- Error logging to database
- Retry logic for transient errors (DB connection, API timeout)

Return to client:
{
  success: boolean
  data?: T
  error?: {
    code: string (e.g., 'TIMEOUT', 'RATE_LIMIT', 'INVALID_INPUT')
    message: string (user-friendly)
    details?: object (for debugging)
  }
}
```

**Time saved:** 2 hours vs ad-hoc error handling

---

## 7. TESTING PROMPTS

### Prompt 12: Write Tests for Critical Paths

```
Write Vitest tests for the code submission and explanation generation flow.

Test cases:
1. Valid code submission → test cases pass → return success
2. Invalid code → test cases fail → return detailed failure message
3. Explanation generation → returns structured explanation
4. Explanation rating → saves feedback to database
5. Rate limiting → blocks 6th explanation request

Create:
- __tests__/submissions.test.ts
- __tests__/explanations.test.ts
- Mock Supabase and Claude API responses
- Mock user authentication
- Test both success and error paths
- Use vitest for speed

Include:
- Setup/teardown for test database
- Mock data fixtures
- Test descriptions in plain English
- Coverage reporting

Run tests with: npm run test
Coverage minimum: 80%
```

**Time saved:** 2-3 hours (AI writes tests faster than manually)

---

## 8. DEPLOYMENT & MONITORING

### Prompt 13: Add Cost Monitoring

```
Add logging to track AI API costs in real-time.

Create:
1. Log every Claude API call with:
   - Model used
   - Tokens consumed (input, output, cached_read)
   - Cost in USD
   - Timestamp
   - Feature that triggered the call (explanation, feedback, etc)

2. Database table:
   CREATE TABLE ai_costs (
     id UUID PRIMARY KEY,
     model TEXT,
     input_tokens INT,
     output_tokens INT,
     cached_tokens INT,
     cost_usd FLOAT,
     feature TEXT,
     user_id UUID,
     created_at TIMESTAMP
   )

3. API endpoint:
   GET /api/analytics/costs
   Returns:
   {
     today: USD,
     week: USD,
     month: USD,
     by_model: { opus: USD, sonnet: USD, haiku: USD },
     by_feature: { explanation: USD, feedback: USD }
   }

4. Alerts:
   - Send email if daily cost > $10
   - Log warning if any single call > $1

Implement as middleware that wraps Claude API calls.
```

**Time saved:** 1-2 hours

---

## 9. QUICK-START COPY-PASTE EXAMPLES

### Schema Example (Drizzle ORM)

```typescript
import { pgTable, text, serial, timestamp, boolean, integer, jsonb, varchar } from 'drizzle-orm/pg-core';

export const problems = pgTable('problems', {
  id: serial('id').primaryKey(),
  title: varchar('title', { length: 255 }).notNull().unique(),
  difficulty: varchar('difficulty', { length: 20 }).notNull(), // easy, medium, hard
  description: text('description').notNull(),
  examples: jsonb('examples').notNull(), // [{input: "", output: "", explanation: ""}]
  constraints: text('constraints').notNull(),
  categories: jsonb('categories').notNull(), // ["Array", "String"]
  acceptance_rate: integer('acceptance_rate'),
  created_at: timestamp('created_at').defaultNow(),
});

export const solutions = pgTable('solutions', {
  id: serial('id').primaryKey(),
  problem_id: integer('problem_id').references(() => problems.id),
  approach_name: varchar('approach_name', { length: 255 }),
  code: text('code').notNull(),
  explanation: text('explanation'),
  time_complexity: varchar('time_complexity', { length: 50 }),
  space_complexity: varchar('space_complexity', { length: 50 }),
  created_at: timestamp('created_at').defaultNow(),
});

export const submissions = pgTable('submissions', {
  id: serial('id').primaryKey(),
  user_id: varchar('user_id', { length: 255 }).notNull(),
  problem_id: integer('problem_id').references(() => problems.id),
  code: text('code').notNull(),
  is_passing: boolean('is_passing'),
  submitted_at: timestamp('submitted_at').defaultNow(),
});
```

---

## 10. DEBUGGING TIPS FOR AI-GENERATED CODE

When Claude/Cursor generates code that doesn't work:

1. **Wrong import paths?**
   → AI can't see your exact folder structure. Provide context:
   ```
   "My folder structure is:
   src/
     app/
     components/
     hooks/
     lib/
     server/
       routers/
       db/
   Fix imports accordingly."
   ```

2. **Type errors?**
   → Paste the actual error message to AI, it will fix types

3. **API contract mismatch?**
   → Show AI your tRPC router definition, it will match the client code

4. **Performance issues?**
   → Ask: "This query is slow. Show me the optimized version with indices and caching."

5. **Hallucinated functions?**
   → AI sometimes invents functions that don't exist. Check if they're from your actual codebase.

---

## FINAL TIPS

1. **Start with terminal agent (Claude Code)** for backend scaffolding → fastest
2. **Use v0.dev immediately** for UI → no local setup needed
3. **Cursor for integration** → best for connecting pieces together
4. **Always verify AI output** → test before deploying
5. **Cost track from day 1** → catches runaway spending early
6. **Use cheap models as much as possible** → Haiku for 80% of work
7. **Enable caching early** → saves 90% on repeated queries

---

## COST CALCULATOR

Based on 100 active users:

```
Scenario 1: No optimization
- 200 explanations/day at $0.05 each = $10/day
- 100 code checks at $0.01 each = $1/day
- Monthly: $330

Scenario 2: With Haiku + caching
- 200 explanations/day: 30 fresh ($0.01) + 170 cached ($0.0005) = $0.35/day
- 100 code checks at $0.001 = $0.10/day
- Monthly: $13.50

Savings: 96% reduction in API costs
```
