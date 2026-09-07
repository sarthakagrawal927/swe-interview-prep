import {
  ArrowLeft,
  Check,
  CheckCircle2,
  Circle,
  ExternalLink,
  FlaskConical,
  Hammer,
  Lightbulb,
  Play,
  Sparkles,
} from 'lucide-react';
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import CodeEditor from '../components/CodeEditor';
import FeynmanGate from '../components/FeynmanGate';
import FeynmanNudge from '../components/FeynmanNudge';
import {
  Badge,
  Button,
  Card,
  color,
  DIFFICULTY_COLOR,
  EmptyState,
  PageHeader,
  PageShell,
  SectionTitle,
} from '../components/ui';
import {
  type Artifact,
  EDITORIAL_ARTIFACTS,
  type ArtifactStatus,
  CONCEPT_BY_ID,
  DRILL_BY_ID,
  REVIEW_QUESTIONS,
} from '../data/learning-os';
import { useAuth } from '../contexts/AuthContext';
import { useCodeExecution } from '../hooks/useCodeExecution';
import { useActivityLogger } from '../hooks/useActivity';
import { useConceptMastery, type MasteryEntry } from '../hooks/useConcepts';
import { useReviewMastery } from '../hooks/useReviewMastery';
import {
  type ArtifactEntry,
  type DrillEntry,
  useArtifactStore,
  useDrillStore,
  useUserElo,
} from '../hooks/useUserStore';
import {
  DRILL_VERIFICATION_HINT,
  DRILL_VERIFICATION_LABEL,
  type DrillVerification,
  drillVerification,
  isMetadataDrill,
} from '../lib/contentQuality';
import { drillContract } from '../lib/drillContract';
import { type DrillTestCase, runDrillTests } from '../lib/drillRunner';
import type { MasteryRating } from '../lib/fsrs';
import { difficultyToElo } from '../lib/elo';
import { pickDrillForConcept, pickNextConcept } from '../lib/recommend';
import {
  loadSuspendedRqs,
  reviewsToSeedForConcept,
  unsuspendReviewQuestion,
} from '../lib/reviewMastery';
import { recordSessionActivity } from '../lib/session';
import { playgroundArtifactUrl, playgroundProblemUrl } from '../lib/gates';
import type { Language } from '../types';

export function resolveBuildLabView(
  id?: string
): 'artifact-board' | 'drill-workspace' | 'not-found' {
  if (!id) return 'artifact-board';
  if (DRILL_BY_ID[id]) return 'drill-workspace';
  return 'not-found';
}

export default function BuildLab() {
  const { id } = useParams();
  const view = resolveBuildLabView(id);
  if (view === 'drill-workspace') return <DrillWorkspace key={id} drillId={id ?? ''} />;
  if (view === 'not-found') return <EmptyState title="Drill not found" />;
  return <ArtifactBoard />;
}

// --- Artifact board ---------------------------------------------------------

const COLUMNS: { status: ArtifactStatus; label: string; tone: string }[] = [
  { status: 'todo', label: 'To build', tone: 'gray' },
  { status: 'building', label: 'Building', tone: 'amber' },
  { status: 'shipped', label: 'Shipped', tone: 'emerald' },
];

export function shouldCreditArtifact(
  successCriteriaCount: number,
  prev: ArtifactEntry,
  next: ArtifactEntry
): boolean {
  const isEvidenced = (entry: ArtifactEntry) =>
    entry.criteria.length >= successCriteriaCount && entry.url.trim().length > 0;
  return next.status === 'shipped' && isEvidenced(next) && !isEvidenced(prev);
}

function ArtifactBoard() {
  const { getArtifact, setArtifact } = useArtifactStore();
  const { review } = useConceptMastery();
  const [openId, setOpenId] = useState<string | null>(null);

  // Shipping an artifact nudges every linked concept's mastery upward — but
  // only when there is something to point at. Dragging a card into "Shipped"
  // is not evidence, so the FSRS write is gated on every success criterion
  // being checked off AND an artifact link being present.
  function handleChange(artifact: Artifact, prev: ArtifactEntry, next: ArtifactEntry) {
    setArtifact(artifact.id, next);
    if (shouldCreditArtifact(artifact.successCriteria.length, prev, next)) {
      for (const cid of artifact.concepts) void review(cid, 'good');
    }
  }

  return (
    <PageShell wide>
      <PageHeader
        eyebrow="Build Lab"
        title="Build Lab"
        subtitle="No learning without an artifact. Move each one from idea to shipped — code, benchmark, or design doc. Shipping nudges its concepts toward mastered."
        actions={
          <>
            <Link
              to="/labs"
              className="inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-slate-700 px-3 text-sm text-slate-300 hover:bg-slate-800"
            >
              <FlaskConical className="h-4 w-4" /> Systems Lab
            </Link>
            <Link
              to="/playground"
              className="inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-slate-700 px-3 text-sm text-slate-300 hover:bg-slate-800"
            >
              <Hammer className="h-4 w-4" /> Open workspace
            </Link>
          </>
        }
      />

      <div className="grid gap-4 md:grid-cols-3">
        {COLUMNS.map((col) => {
          const items = EDITORIAL_ARTIFACTS.filter((a) => getArtifact(a.id).status === col.status);
          return (
            <div key={col.status}>
              <div className="mb-2 flex items-center gap-2">
                <span className={`h-2.5 w-2.5 rounded-full ${color(col.tone).solid}`} />
                <h2 className="text-sm font-semibold text-slate-200">{col.label}</h2>
                <span className="text-xs text-slate-500">{items.length}</span>
              </div>
              <div className="space-y-2">
                {items.map((a) => (
                  <ArtifactCard
                    key={a.id}
                    artifact={a}
                    entry={getArtifact(a.id)}
                    open={openId === a.id}
                    onToggle={() => setOpenId(openId === a.id ? null : a.id)}
                    onChange={(next) => handleChange(a, getArtifact(a.id), next)}
                  />
                ))}
                {items.length === 0 && (
                  <div className="rounded-lg border border-dashed border-slate-800 py-6 text-center text-xs text-slate-500">
                    Nothing here
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </PageShell>
  );
}

function ArtifactCard({
  artifact,
  entry,
  open,
  onToggle,
  onChange,
}: {
  artifact: Artifact;
  entry: ArtifactEntry;
  open: boolean;
  onToggle: () => void;
  onChange: (e: ArtifactEntry) => void;
}) {
  function toggleCriterion(i: number) {
    const has = entry.criteria.includes(i);
    onChange({
      ...entry,
      criteria: has ? entry.criteria.filter((x) => x !== i) : [...entry.criteria, i],
    });
  }

  const doneCount = entry.criteria.length;

  return (
    <Card className="p-3">
      <button onClick={onToggle} className="w-full text-left">
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-sm font-semibold text-white">{artifact.title}</h3>
          <Badge tone={DIFFICULTY_COLOR[artifact.difficulty]}>{artifact.difficulty}</Badge>
        </div>
        <p className="mt-1 line-clamp-2 text-xs text-slate-400">{artifact.description}</p>
        <div className="mt-2 text-[11px] text-slate-500">
          {doneCount}/{artifact.successCriteria.length} criteria met
        </div>
      </button>

      {open && (
        <div className="mt-3 space-y-3 border-t border-slate-800 pt-3">
          <div>
            <div className="mb-1 text-[11px] font-medium text-slate-500">Success criteria</div>
            <div className="space-y-1">
              {artifact.successCriteria.map((c, i) => (
                <button
                  key={i}
                  onClick={() => toggleCriterion(i)}
                  className="flex w-full items-start gap-2 text-left text-xs text-slate-300"
                >
                  {entry.criteria.includes(i) ? (
                    <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-400" />
                  ) : (
                    <Circle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-500" />
                  )}
                  <span className={entry.criteria.includes(i) ? 'text-slate-500 line-through' : ''}>
                    {c}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <input
            value={entry.url}
            onChange={(e) => onChange({ ...entry, url: e.target.value })}
            placeholder="Link to commit / PR / demo / notes"
            className="w-full rounded-md border border-slate-800 bg-slate-950 px-2 py-1.5 text-xs text-slate-100 placeholder:text-slate-500 focus:border-sky-500/50 focus:outline-none"
          />

          <div className="flex flex-wrap gap-1.5">
            {COLUMNS.map((col) => (
              <Button
                key={col.status}
                tone={entry.status === col.status ? 'primary' : 'ghost'}
                onClick={() => onChange({ ...entry, status: col.status })}
              >
                {entry.status === col.status && <Check className="h-3 w-3" />}
                {col.label}
              </Button>
            ))}
          </div>

          <div className="flex flex-wrap gap-1.5">
            {artifact.concepts.map((cid) => (
              <Link
                key={cid}
                to={`/concepts/${cid}`}
                className="rounded-md border border-slate-800 px-2 py-0.5 text-[11px] text-slate-400 hover:text-white"
              >
                {CONCEPT_BY_ID[cid]?.name || cid}
              </Link>
            ))}
          </div>

          <Link
            to={playgroundArtifactUrl(artifact.id)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-sky-500/30 bg-sky-500/10 px-3 py-1.5 text-xs font-medium text-sky-300 hover:bg-sky-500/15"
          >
            <Hammer className="h-3.5 w-3.5" /> Build in Playground
          </Link>

          {entry.url && (
            <a
              href={entry.url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-xs text-sky-400"
            >
              Open artifact <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>
      )}
    </Card>
  );
}

// --- Drill workspace --------------------------------------------------------

const STARTER: Record<Language, string> = {
  typescript: '// Write your solution here\n\nfunction solve() {\n  \n}\n\nconsole.log(solve());\n',
  javascript: '// Write your solution here\n\nfunction solve() {\n  \n}\n\nconsole.log(solve());\n',
};

const LANGUAGES: Language[] = ['typescript'];

/**
 * FSRS rating for a solve, derived from the objective outcome rather than
 * hardcoded to 'good'. An unverified claim is worth strictly less than a
 * passing test, and needing several attempts is worth less than a first pass.
 */
export function ratingForSolve(
  verification: DrillVerification,
  attemptsBefore: number
): MasteryRating {
  if (verification === 'self-reported') return 'hard';
  if (verification === 'outline-check') return attemptsBefore >= 3 ? 'hard' : 'good';
  if (attemptsBefore === 0) return 'easy';
  return attemptsBefore <= 2 ? 'good' : 'hard';
}

function DrillWorkspace({ drillId }: { drillId: string }) {
  const drill = DRILL_BY_ID[drillId];
  const { user } = useAuth();
  const { getDrill, setDrill } = useDrillStore();
  const { mastery, refresh, review } = useConceptMastery();
  const { mastery: rqMastery, review: reviewRq } = useReviewMastery();
  const logActivity = useActivityLogger();
  const { recordResult } = useUserElo();
  const { output, errors, isRunning, execute } = useCodeExecution();
  const [showHints, setShowHints] = useState(false);
  const [showSolution, setShowSolution] = useState(false);
  const entry = getDrill(drillId);
  const [language, setLanguage] = useState<Language>('typescript');
  // An untouched editor follows asynchronously restored account progress.
  // Once edited, including an intentional empty draft, it belongs to the learner.
  const [draft, setCode] = useState<string | null>(null);
  const code = draft ?? (entry.lastCode || STARTER.typescript);
  const [testMessage, setTestMessage] = useState<string | null>(null);
  // Post-solve Feynman flow: a skippable explain-back nudge that opens the gate.
  const [showExplainNudge, setShowExplainNudge] = useState(false);
  const [feynmanOpen, setFeynmanOpen] = useState(false);
  // After the Feynman Gate grades the explanation and FSRS mastery is updated,
  // we surface the next-weakest concept so the loop closes: drill → explain →
  // mastery update → next weakest concept.
  const [showNext, setShowNext] = useState(false);

  if (!drill) {
    return (
      <PageShell>
        <EmptyState title="Drill not found" />
      </PageShell>
    );
  }

  const concept = CONCEPT_BY_ID[drill.conceptId];
  const external = isMetadataDrill(drill);
  const verification = drillVerification(drill);

  function run() {
    if (drill.testCases?.length && (language === 'typescript' || language === 'javascript')) {
      const result = runDrillTests(code, drill.testCases, language);
      setTestMessage(result.message);
      if (result.passed) {
        void execute(code, [], language);
      }
      return;
    }
    setTestMessage(null);
    void execute(code, [], language);
  }

  function mark(status: DrillEntry['status']) {
    if (
      status === 'solved' &&
      drill.testCases?.length &&
      (language === 'typescript' || language === 'javascript')
    ) {
      const result = runDrillTests(code, drill.testCases, language);
      setTestMessage(result.message);
      if (!result.passed) return;
    }
    const wasSolved = entry.status === 'solved';
    setDrill(drillId, { status, lastCode: code, attempts: entry.attempts });
    // Solving a drill closes the loop — it nudges the concept toward mastery,
    // then asks for a 30-second explain-back (Feynman Gate) to prove it.
    if (status === 'solved') {
      setShowExplainNudge(true);
      void review(drill?.conceptId, ratingForSolve(verification, entry.attempts));
      void logActivity({
        kind: 'drill_solve',
        conceptIds: [drill?.conceptId],
        problemId: drillId,
        payload: { difficulty: drill?.difficulty },
      });
      recordSessionActivity('drill_solve');
      for (const seed of reviewsToSeedForConcept(drill?.conceptId, REVIEW_QUESTIONS, rqMastery)) {
        void reviewRq(seed.questionId, seed.rating);
      }
      for (const q of REVIEW_QUESTIONS.filter((rq) => rq.conceptId === drill?.conceptId)) {
        if (loadSuspendedRqs().has(q.id)) unsuspendReviewQuestion(q.id);
      }
    } else if (status === 'attempted') {
      void logActivity({
        kind: 'drill_fail',
        conceptIds: [drill?.conceptId],
        problemId: drillId,
        payload: { attempts: entry.attempts + 1 },
      });
      recordSessionActivity('drill_fail');
    }
    // First-time solve bumps ELO for every roadmap this concept belongs to.
    // v1 only counts the success signal; an explicit "couldn't solve" path
    // would be needed to push ELO down.
    if (status === 'solved' && !wasSolved && concept) {
      recordResult(concept.roadmaps, difficultyToElo(drill?.difficulty), 1);
    }
  }

  function markGiveUp() {
    if (!concept) return;
    setDrill(drillId, { status: 'attempted', lastCode: code, attempts: entry.attempts + 1 });
    recordResult(concept.roadmaps, difficultyToElo(drill?.difficulty), 0);
    // An explicit "couldn't solve" is the clearest objective signal there is.
    void review(drill?.conceptId, 'again');
    void logActivity({
      kind: 'drill_fail',
      conceptIds: [drill?.conceptId],
      problemId: drillId,
      payload: { attempts: entry.attempts + 1, gaveUp: true },
    });
    recordSessionActivity('drill_fail');
  }

  function switchLanguage(lang: Language) {
    setLanguage(lang);
    const isStarter = !code.trim() || Object.values(STARTER).includes(code);
    if (isStarter) setCode(STARTER[lang]);
  }

  return (
    <PageShell wide>
      <Link
        to="/practice"
        className="mb-4 inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-300"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Drills
      </Link>

      <div className="mb-4">
        <div className="mb-2 flex flex-wrap gap-1.5">
          <Badge tone={DIFFICULTY_COLOR[drill.difficulty]}>{drill.difficulty}</Badge>
          <Badge tone="gray">{drill.type}</Badge>
          {concept && (
            <Link to={`/concepts/${concept.id}`}>
              <Badge tone="purple">{concept.name}</Badge>
            </Link>
          )}
          <Badge
            tone={
              entry.status === 'solved'
                ? 'emerald'
                : entry.status === 'attempted'
                  ? 'amber'
                  : 'gray'
            }
          >
            {entry.status}
            {entry.attempts > 0 ? ` · ${entry.attempts} attempts` : ''}
          </Badge>
          <Badge tone={verification === 'automated' ? 'sky' : 'amber'}>
            {DRILL_VERIFICATION_LABEL[verification]}
          </Badge>
        </div>
        <h1 className="text-2xl font-bold text-white">{drill.title}</h1>
        {external && drill.externalUrl && (
          <a
            href={drill.externalUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-2 inline-flex items-center gap-1.5 text-sm text-sky-400 hover:text-sky-300"
          >
            Open on LeetCode <ExternalLink className="h-3.5 w-3.5" />
          </a>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-4">
          <Card className="p-4">
            <SectionTitle>Prompt</SectionTitle>
            <p className="text-sm leading-relaxed text-slate-300">{drill.prompt}</p>
            <div className="mt-3 rounded-lg border border-slate-800 bg-slate-950 p-3">
              <div className="text-[11px] font-medium text-slate-500">Expected output</div>
              <p className="mt-1 text-sm text-slate-400">{drill.expectedOutput}</p>
            </div>
          </Card>

          <Card className="p-4">
            <button
              onClick={() => setShowHints((s) => !s)}
              className="flex w-full items-center gap-1.5 text-sm font-semibold text-amber-300"
            >
              <Lightbulb className="h-4 w-4" /> {showHints ? 'Hide' : 'Show'} hints (
              {drill.hints.length})
            </button>
            {showHints && (
              <ul className="mt-2 space-y-1.5">
                {drill.hints.map((h, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs text-slate-400">
                    <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-amber-400" /> {h}
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card className="p-4">
            <button
              onClick={() => setShowSolution((s) => !s)}
              className="flex items-center gap-1.5 text-sm font-semibold text-cyan-300"
            >
              <Sparkles className="h-4 w-4" /> {showSolution ? 'Hide' : 'Show'} solution notes
            </button>
            {showSolution && (
              <p className="mt-2 text-xs leading-relaxed text-slate-400">{drill.solutionNotes}</p>
            )}
          </Card>
        </div>

        <div className="space-y-3">
          {showExplainNudge && (
            <FeynmanNudge
              signedIn={!!user}
              onExplain={() => {
                setShowExplainNudge(false);
                setFeynmanOpen(true);
              }}
              onSkip={() => {
                setShowExplainNudge(false);
                void logActivity({
                  kind: 'feynman_skip',
                  conceptIds: [drill.conceptId],
                  problemId: drillId,
                });
              }}
            />
          )}
          {external ? (
            <Card className="p-4">
              <p className="text-sm text-slate-400">
                This drill links to LeetCode — solve there first, then mark solved here to update
                mastery.
              </p>
              <p className="mt-2 text-xs text-amber-200/80">
                {DRILL_VERIFICATION_HINT['self-reported']}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {drill.externalUrl && (
                  <a href={drill.externalUrl} target="_blank" rel="noreferrer">
                    <Button tone="subtle">
                      <ExternalLink className="h-3.5 w-3.5" /> Solve on LeetCode
                    </Button>
                  </a>
                )}
                <Button onClick={() => mark('solved')}>
                  <CheckCircle2 className="h-3.5 w-3.5" /> Mark solved
                </Button>
                <Button tone="ghost" onClick={() => mark('attempted')}>
                  Attempted
                </Button>
              </div>
            </Card>
          ) : (
            <>
              <Card className="overflow-hidden">
                <div className="flex items-center justify-between border-b border-slate-800 px-3 py-2">
                  <div className="flex gap-1">
                    {LANGUAGES.map((l) => (
                      <button
                        key={l}
                        onClick={() => switchLanguage(l)}
                        className={`rounded px-2 py-0.5 text-xs font-medium ${language === l ? 'bg-sky-500/15 text-sky-300' : 'text-slate-500 hover:text-slate-300'}`}
                      >
                        {l}
                      </button>
                    ))}
                  </div>
                  <Button tone="subtle" onClick={run} disabled={isRunning}>
                    <Play className="h-3.5 w-3.5" /> {isRunning ? 'Running…' : 'Run'}
                  </Button>
                </div>
                <div className="h-[320px]">
                  <CodeEditor
                    code={code}
                    language={language}
                    onChange={(v) => setCode(v || '')}
                    onRun={run}
                  />
                </div>
              </Card>

              <Card className="p-3">
                <div className="text-[11px] font-medium text-slate-500">
                  How this is graded · {DRILL_VERIFICATION_LABEL[verification]}
                </div>
                <p className="mt-1 text-xs text-slate-400">
                  {DRILL_VERIFICATION_HINT[verification]}
                </p>
                <ContractHint testCases={drill.testCases} />
              </Card>

              <Card className="p-3">
                <div className="text-[11px] font-medium text-slate-500">Output</div>
                {testMessage && (
                  <p
                    className={`mt-1 text-xs ${testMessage.includes('passed') ? 'text-emerald-400' : 'text-amber-300'}`}
                  >
                    {testMessage}
                  </p>
                )}
                <pre className="mt-1 max-h-40 overflow-auto whitespace-pre-wrap text-xs text-slate-300">
                  {errors ? (
                    <span className="text-rose-400">{errors}</span>
                  ) : (
                    output || <span className="text-slate-500">Run your code to see output.</span>
                  )}
                </pre>
              </Card>

              <div className="flex flex-wrap items-center gap-2">
                <Button tone="ghost" onClick={() => mark('attempted')}>
                  Save attempt
                </Button>
                <Button tone="ghost" onClick={markGiveUp}>
                  Couldn&apos;t solve
                </Button>
                <Button onClick={() => mark('solved')}>
                  <Check className="h-4 w-4" /> Mark solved
                </Button>
                <Link
                  to={playgroundProblemUrl(drillId)}
                  className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-slate-700 px-3 py-1.5 text-sm text-slate-300 hover:bg-slate-800"
                >
                  <Hammer className="h-4 w-4" /> Full workspace
                </Link>
              </div>
            </>
          )}
        </div>
      </div>

      {showNext && <NextConceptCard mastery={mastery} excludeId={drill.conceptId} />}

      <FeynmanGate
        open={feynmanOpen}
        onClose={() => setFeynmanOpen(false)}
        code={code}
        language={language}
        problem={drill.prompt}
        conceptIds={[drill.conceptId]}
        problemId={drillId}
        onGraded={() => {
          setShowNext(true);
          void refresh();
        }}
      />
    </PageShell>
  );
}

/**
 * The symbols the grader will call, shown next to the grading explanation.
 *
 * Most auto-graded drills never name the function their tests invoke, so the
 * prompt asks for a design and the grader silently requires
 * `paginationChoice(rows)`. This makes the contract visible without revealing
 * any expected value — the calls are shown, the assertions are not.
 */
function ContractHint({ testCases }: { testCases?: DrillTestCase[] }) {
  const { required, calls } = drillContract(testCases);
  if (!required.length) return null;

  return (
    <div className="mt-2 border-t border-slate-800 pt-2">
      <div className="text-[11px] font-medium text-slate-500">
        Your code must define {required.length === 1 ? 'this' : 'these'}
      </div>
      <div className="mt-1 flex flex-wrap gap-1">
        {required.map((name) => (
          <code
            key={name}
            className="rounded bg-slate-800 px-1.5 py-0.5 font-mono text-[11px] text-sky-300"
          >
            {name}
          </code>
        ))}
      </div>
      <div className="mt-2 text-[11px] font-medium text-slate-500">The grader runs</div>
      <pre className="mt-1 overflow-x-auto whitespace-pre-wrap rounded bg-slate-950 p-2 font-mono text-[11px] text-slate-400">
        {calls.join('\n')}
      </pre>
    </div>
  );
}

/**
 * Post-Feynman recommendation: surfaces the next-weakest concept based on FSRS
 * mastery so the drill → explain → mastery loop closes into "what's next".
 * Excludes the concept just drilled so the user advances to a new target.
 */
function NextConceptCard({
  mastery,
  excludeId,
}: {
  mastery: Record<string, MasteryEntry>;
  excludeId: string;
}) {
  const next = pickNextConcept(mastery);
  if (!next || next.id === excludeId) return null;
  const drill = pickDrillForConcept(next.id);
  return (
    <Card className="mb-4 p-4">
      <div className="flex items-center gap-2">
        <ArrowLeft className="h-4 w-4 rotate-180 text-sky-400" />
        <h3 className="text-sm font-semibold text-slate-200">Next weakest concept</h3>
      </div>
      <p className="mt-1 text-xs text-slate-400">
        Your mastery was updated. The next concept FSRS says is due:
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Link
          to={`/concepts/${next.id}`}
          className="rounded-md bg-slate-800 px-3 py-1.5 text-sm text-slate-200 transition-colors hover:bg-slate-700"
        >
          {next.name}
        </Link>
        {drill && (
          <Link
            to={`/build-lab/${drill.id}`}
            className="inline-flex items-center gap-1.5 rounded-md bg-sky-500 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-sky-400"
          >
            <Hammer className="h-3.5 w-3.5" /> Drill it
          </Link>
        )}
      </div>
    </Card>
  );
}
