import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useProblems } from '../hooks/useProblems';
import {
  Link2,
  CheckCircle2,
  Loader2,
  AlertTriangle,
  Sparkles,
} from 'lucide-react';

const CORS_PROXY = 'https://api.allorigins.win/raw?url=';

// Map LeetCode topic tags to our pattern IDs
const TAG_TO_PATTERN = {
  'array': 'array-hashing', 'hash-table': 'array-hashing', 'string': 'array-hashing',
  'two-pointers': 'two-pointers', 'three-sum': 'two-pointers',
  'sliding-window': 'sliding-window',
  'stack': 'stack', 'monotonic-stack': 'stack',
  'binary-search': 'binary-search',
  'linked-list': 'linked-list',
  'tree': 'trees', 'binary-tree': 'trees', 'binary-search-tree': 'trees', 'depth-first-search': 'trees', 'breadth-first-search': 'trees',
  'trie': 'tries',
  'heap-priority-queue': 'heap',
  'backtracking': 'backtracking',
  'graph': 'graphs', 'topological-sort': 'graphs', 'shortest-path': 'graphs', 'union-find': 'graphs',
  'dynamic-programming': 'dp-1d',
  'greedy': 'greedy',
  'interval': 'intervals', 'merge-intervals': 'intervals', 'line-sweep': 'intervals',
  'math': 'math-geometry', 'geometry': 'math-geometry', 'matrix': 'math-geometry',
  'bit-manipulation': 'bit-manipulation',
};

function stripHtml(html) {
  return html
    .replace(/<pre[^>]*>/gi, '\n```\n')
    .replace(/<\/pre>/gi, '\n```\n')
    .replace(/<code>/gi, '`').replace(/<\/code>/gi, '`')
    .replace(/<strong>/gi, '**').replace(/<\/strong>/gi, '**')
    .replace(/<em>/gi, '*').replace(/<\/em>/gi, '*')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<li>/gi, '- ').replace(/<\/li>/gi, '\n')
    .replace(/<p>/gi, '\n').replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function parseTestCasesFromDescription(desc, funcName) {
  const tests = [];
  // Match patterns like: Input: nums = [2,7,11,15], target = 9 \n Output: [0,1]
  const blocks = desc.split(/(?=\*?\*?Example\s*\d)/i);
  for (const block of blocks) {
    const inputMatch = block.match(/Input:\s*(.+?)(?:\n|Output)/s);
    const outputMatch = block.match(/Output:\s*(.+?)(?:\n|Explanation|$)/s);
    if (inputMatch && outputMatch) {
      try {
        const inputRaw = inputMatch[1].trim();
        const outputRaw = outputMatch[1].trim();
        // Parse "varName = value, varName2 = value2" format
        const argParts = inputRaw.split(/,\s*(?=\w+\s*=)/);
        const args = argParts.map(part => {
          const valMatch = part.match(/=\s*(.+)/);
          if (!valMatch) return part.trim();
          let val = valMatch[1].trim();
          // Try parsing as JSON
          try { return JSON.parse(val); } catch { }
          // Handle quoted strings without JSON quotes
          if (/^".*"$/.test(val) || /^'.*'$/.test(val)) return val.slice(1, -1);
          // Handle numbers
          if (!isNaN(val)) return Number(val);
          // Handle boolean
          if (val === 'true') return true;
          if (val === 'false') return false;
          return val;
        });

        let expected;
        try { expected = JSON.parse(outputRaw); } catch {
          if (!isNaN(outputRaw)) expected = Number(outputRaw);
          else if (outputRaw === 'true') expected = true;
          else if (outputRaw === 'false') expected = false;
          else expected = outputRaw;
        }

        tests.push({
          args,
          expected,
          description: `Example ${tests.length + 1}`,
        });
      } catch { /* skip malformed */ }
    }
  }
  return tests;
}

function detectPattern(tags) {
  if (!tags || tags.length === 0) return 'array-hashing';
  // Prioritize more specific patterns over generic ones
  const priority = ['trie', 'heap-priority-queue', 'backtracking', 'graph', 'topological-sort', 'union-find',
    'sliding-window', 'binary-search', 'linked-list', 'tree', 'binary-tree', 'binary-search-tree',
    'dynamic-programming', 'stack', 'monotonic-stack', 'two-pointers', 'greedy',
    'bit-manipulation', 'interval', 'merge-intervals', 'math', 'geometry',
    'hash-table', 'array', 'string'];
  for (const tag of priority) {
    if (tags.includes(tag) && TAG_TO_PATTERN[tag]) return TAG_TO_PATTERN[tag];
  }
  return 'array-hashing';
}

function generateSteps(title, difficulty, description) {
  return [
    {
      title: 'Understand the Problem',
      hint: `Read the problem carefully. What are the inputs and outputs? What constraints exist?`,
      approach: `Break down "${title}" — identify the input types, output type, and edge cases from the examples.`,
    },
    {
      title: 'Brute Force Approach',
      hint: `What is the simplest way to solve this, even if slow?`,
      approach: `Think about the most straightforward solution. Consider nested loops or trying all possibilities.`,
      code: `// TODO: Write your brute force solution here`,
      complexity: difficulty === 'Easy' ? 'Time: O(n^2), Space: O(1)' : difficulty === 'Medium' ? 'Time: O(n^2), Space: O(n)' : 'Time: O(2^n), Space: O(n)',
    },
    {
      title: 'Optimal Approach',
      hint: `Can you use a specific data structure or technique to improve the time complexity?`,
      approach: `Look for patterns: can a hash map, two pointers, sorting, or dynamic programming help reduce complexity?`,
      code: `// TODO: Write your optimal solution here`,
      complexity: difficulty === 'Easy' ? 'Time: O(n), Space: O(n)' : difficulty === 'Medium' ? 'Time: O(n log n), Space: O(n)' : 'Time: O(n^2), Space: O(n)',
    },
  ];
}

function generateAnkiCards(title, pattern, difficulty) {
  return [
    {
      front: `What pattern/technique is most useful for "${title}"?`,
      back: `Pattern: ${pattern}\nDifficulty: ${difficulty}\n\nThink about the key data structure or algorithm that makes this problem efficient.`,
    },
    {
      front: `What is the optimal time complexity for "${title}"?`,
      back: `Consider the constraints and what the lower bound for the problem could be. A hash map gives O(1) lookups, sorting gives O(n log n), etc.`,
    },
  ];
}

export default function ImportProblem() {
  const navigate = useNavigate();
  const { patterns, addCustomProblem } = useProblems();
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(null);

  const parseSlug = (leetcodeUrl) => {
    const match = leetcodeUrl.match(/leetcode\.com\/problems\/([^/?#]+)/);
    return match ? match[1] : null;
  };

  const handleImport = async () => {
    const slug = parseSlug(url);
    if (!slug) {
      setError('Invalid LeetCode URL. Example: https://leetcode.com/problems/two-sum/');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess(null);

    try {
      const query = {
        query: `query getQuestionDetail($titleSlug: String!) {
          question(titleSlug: $titleSlug) {
            questionId
            title
            difficulty
            content
            topicTags { slug }
            codeSnippets { lang langSlug code }
            exampleTestcaseList
          }
        }`,
        variables: { titleSlug: slug },
      };

      const res = await fetch(CORS_PROXY + encodeURIComponent('https://leetcode.com/graphql'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(query),
      });

      if (!res.ok) throw new Error('Failed to fetch from LeetCode');

      const data = await res.json();
      const q = data?.data?.question;
      if (!q) throw new Error('Problem not found on LeetCode');

      const title = q.title;
      const difficulty = q.difficulty;
      const tags = q.topicTags?.map(t => t.slug) || [];
      const patternId = detectPattern(tags);
      const patternObj = patterns.find(p => p.id === patternId);
      const description = q.content ? stripHtml(q.content) : '';
      const jsSnippet = q.codeSnippets?.find(s => s.langSlug === 'javascript');
      const starterCode = jsSnippet?.code || `function solution() {\n  // Your code here\n}`;

      // Extract function name for test case parsing
      const fnMatch = starterCode.match(/(?:var|const|let)?\s*(\w+)\s*=\s*function|function\s+(\w+)/);
      const funcName = fnMatch ? (fnMatch[1] || fnMatch[2]) : 'solution';

      const testCases = parseTestCasesFromDescription(description, funcName);
      const steps = generateSteps(title, difficulty, description);
      const id = `custom-${slug}`;
      const ankiCards = generateAnkiCards(title, patternObj?.name || patternId, difficulty)
        .map((c, i) => ({ ...c, id: `${id}-card-${i}` }));

      const problem = {
        id,
        title,
        difficulty,
        pattern: patternId,
        leetcodeUrl: `https://leetcode.com/problems/${slug}/`,
        leetcodeNumber: parseInt(q.questionId) || 0,
        description,
        starterCode,
        steps,
        testCases,
        ankiCards,
      };

      addCustomProblem(problem);
      setSuccess({ title, difficulty, pattern: patternObj?.name || patternId, testCases: testCases.length, id });
    } catch (e) {
      // Fallback: create from slug alone
      const titleFromSlug = slug.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
      const id = `custom-${slug}`;
      const steps = generateSteps(titleFromSlug, 'Medium', '');
      const ankiCards = generateAnkiCards(titleFromSlug, 'array-hashing', 'Medium')
        .map((c, i) => ({ ...c, id: `${id}-card-${i}` }));

      const problem = {
        id,
        title: titleFromSlug,
        difficulty: 'Medium',
        pattern: 'array-hashing',
        leetcodeUrl: `https://leetcode.com/problems/${slug}/`,
        leetcodeNumber: 0,
        description: '',
        starterCode: `function solution() {\n  // Your code here\n}`,
        steps,
        testCases: [],
        ankiCards,
      };

      addCustomProblem(problem);
      setError('Could not fetch full details (CORS). Imported with defaults — you can solve it and fill in details later.');
      setSuccess({ title: titleFromSlug, difficulty: 'Medium', pattern: 'Array & Hashing', testCases: 0, id });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-xl px-4 py-6 sm:py-8 sm:px-6 lg:px-8">
      <div className="mb-6 sm:mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-white">Import Problem</h1>
        <p className="mt-1 text-sm sm:text-base text-gray-400">
          Paste a LeetCode URL — we'll do the rest.
        </p>
      </div>

      {/* URL Input */}
      <div className="rounded-xl border border-gray-800 bg-gray-900 p-5 sm:p-6">
        <label className="mb-2 block text-sm font-medium text-gray-300">LeetCode URL</label>
        <div className="relative mb-4">
          <Link2 className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
          <input
            type="text"
            value={url}
            onChange={(e) => { setUrl(e.target.value); setError(''); setSuccess(null); }}
            onKeyDown={(e) => e.key === 'Enter' && !loading && url.trim() && handleImport()}
            placeholder="https://leetcode.com/problems/two-sum/"
            className="w-full rounded-lg border border-gray-700 bg-gray-800 py-3 pl-10 pr-4 text-sm text-gray-200 placeholder-gray-500 outline-none focus:border-blue-500/50"
          />
        </div>

        <button
          onClick={handleImport}
          disabled={loading || !url.trim()}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 py-3 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Fetching from LeetCode...
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4" />
              Import Problem
            </>
          )}
        </button>

        {error && (
          <div className="mt-4 flex items-start gap-2 rounded-lg border border-yellow-500/20 bg-yellow-500/5 p-3">
            <AlertTriangle className="h-4 w-4 flex-shrink-0 text-yellow-400 mt-0.5" />
            <p className="text-xs text-yellow-300">{error}</p>
          </div>
        )}

        {success && (
          <div className="mt-4 rounded-lg border border-green-500/20 bg-green-500/5 p-4">
            <div className="mb-3 flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-400" />
              <span className="text-sm font-medium text-green-400">Imported successfully!</span>
            </div>
            <div className="space-y-1 text-xs text-gray-300">
              <p><span className="text-gray-500">Title:</span> {success.title}</p>
              <p><span className="text-gray-500">Difficulty:</span> <DiffBadge d={success.difficulty} /></p>
              <p><span className="text-gray-500">Pattern:</span> {success.pattern}</p>
              <p><span className="text-gray-500">Test cases:</span> {success.testCases} extracted</p>
            </div>
            <button
              onClick={() => navigate(`/problem/${success.id}`)}
              className="mt-4 w-full rounded-lg bg-green-600 py-2.5 text-sm font-medium text-white transition-colors hover:bg-green-700"
            >
              Start Solving
            </button>
          </div>
        )}
      </div>

      {/* Import another */}
      {success && (
        <button
          onClick={() => { setUrl(''); setSuccess(null); setError(''); }}
          className="mt-4 w-full rounded-lg border border-gray-800 bg-gray-900 py-3 text-sm text-gray-400 transition-colors hover:bg-gray-800 hover:text-gray-200"
        >
          Import another problem
        </button>
      )}
    </div>
  );
}

function DiffBadge({ d }) {
  const c = { Easy: 'text-green-400', Medium: 'text-yellow-400', Hard: 'text-red-400' };
  return <span className={c[d] || 'text-gray-400'}>{d}</span>;
}
