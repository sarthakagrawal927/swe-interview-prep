import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import Editor from '@monaco-editor/react';
import { useProblems } from '../hooks/useProblems';
import { useProgress } from '../hooks/useProgress';
import { useCodeExecution } from '../hooks/useCodeExecution';
import {
  Play,
  RotateCcw,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Eye,
  CheckCircle2,
  XCircle,
  Lightbulb,
  Code2,
  BookOpen,
  Save,
  ArrowLeft,
  Loader2,
  AlertTriangle,
} from 'lucide-react';

export default function ProblemView() {
  const { id } = useParams();
  const { getById, patterns } = useProblems();
  const { getStatus, updateStatus, getNotes, saveNotes, getSavedCode, getSavedLanguage, saveCode } = useProgress();
  const { execute, output, errors, testResults, isRunning, clearOutput } = useCodeExecution();

  const problem = getById(id);
  const [code, setCode] = useState('');
  const [language, setLanguage] = useState('javascript');
  const [notes, setNotesLocal] = useState('');
  const [expandedSteps, setExpandedSteps] = useState({});
  const [revealedHints, setRevealedHints] = useState({});
  const [revealedApproach, setRevealedApproach] = useState({});
  const [revealedCode, setRevealedCode] = useState({});
  const [showEditor, setShowEditor] = useState(false);
  const [markers, setMarkers] = useState([]);
  const saveTimerRef = useRef(null);

  useEffect(() => {
    if (problem) {
      const saved = getSavedCode(problem.id);
      setCode(saved !== null ? saved : problem.starterCode);
      setLanguage(getSavedLanguage(problem.id));
      setNotesLocal(getNotes(problem.id));
      setExpandedSteps({});
      setRevealedHints({});
      setRevealedApproach({});
      setRevealedCode({});
      setMarkers([]);
      clearOutput();
    }
  }, [problem?.id]);

  // Debounced auto-save code to localStorage
  const handleCodeChange = useCallback((value) => {
    const newCode = value || '';
    setCode(newCode);
    if (problem) {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => {
        saveCode(problem.id, newCode, language);
      }, 800);
    }
  }, [problem, language, saveCode]);

  // Save language preference when it changes
  useEffect(() => {
    if (problem && code) {
      saveCode(problem.id, code, language);
    }
  }, [language]);

  // Cleanup timer
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, []);

  const handleValidation = useCallback((newMarkers) => {
    setMarkers(newMarkers.filter(m => m.severity >= 8)); // errors only (8 = Error)
  }, []);

  const handleRun = useCallback(async () => {
    if (!problem || isRunning) return;
    const status = getStatus(problem.id);
    if (status === 'unseen') {
      updateStatus(problem.id, 'attempted');
    }
    const result = await execute(code, problem.testCases, language);
    if (result.testResults.length > 0 && result.testResults.every(t => t.passed)) {
      updateStatus(problem.id, 'solved');
    }
  }, [code, problem, isRunning, execute, getStatus, updateStatus, language]);

  const handleReset = () => {
    if (problem) {
      setCode(problem.starterCode);
      setMarkers([]);
      clearOutput();
      saveCode(problem.id, problem.starterCode, language);
    }
  };

  const handleSaveNotes = () => {
    if (problem) {
      saveNotes(problem.id, notes);
    }
  };

  const toggleStep = (idx) => {
    setExpandedSteps(prev => ({ ...prev, [idx]: !prev[idx] }));
  };

  if (!problem) {
    return (
      <div className="flex h-[calc(100vh-4rem)] items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-white">Problem not found</h2>
          <Link to="/patterns" className="mt-4 inline-block text-blue-400 hover:text-blue-300">
            Back to Patterns
          </Link>
        </div>
      </div>
    );
  }

  const pattern = patterns.find(p => p.id === problem.pattern);
  const status = getStatus(problem.id);

  return (
    <>
      {/* DESKTOP: side-by-side split pane */}
      <div className="hidden md:flex h-[calc(100vh-4rem)]">
        {/* LEFT PANE */}
        <div className="flex w-[40%] flex-col border-r border-gray-800">
          <div className="flex-1 overflow-y-auto p-6">
            <Link
              to="/patterns"
              className="mb-4 inline-flex items-center gap-1 text-sm text-gray-400 hover:text-gray-200"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Patterns
            </Link>
            <ProblemHeader problem={problem} pattern={pattern} status={status} />
            <ProblemDescription description={problem.description} />
            <StepBreakdown
              steps={problem.steps}
              expandedSteps={expandedSteps}
              toggleStep={toggleStep}
              revealedHints={revealedHints}
              revealedApproach={revealedApproach}
              revealedCode={revealedCode}
              setRevealedHints={setRevealedHints}
              setRevealedApproach={setRevealedApproach}
              setRevealedCode={setRevealedCode}
            />
            <NotesSection notes={notes} setNotesLocal={setNotesLocal} handleSaveNotes={handleSaveNotes} />
          </div>
        </div>

        {/* RIGHT PANE */}
        <div className="flex w-[60%] flex-col bg-gray-950">
          <div className="flex-[7] min-h-0 overflow-hidden border-b border-gray-800">
            <EditorToolbar
              handleReset={handleReset}
              handleRun={handleRun}
              isRunning={isRunning}
              language={language}
              setLanguage={setLanguage}
            />
            <Editor
              height="100%"
              language={language}
              theme="vs-dark"
              value={code}
              onChange={handleCodeChange}
              onValidate={handleValidation}
              options={{
                minimap: { enabled: false },
                fontSize: 14,
                lineNumbers: 'on',
                scrollBeyondLastLine: false,
                padding: { top: 12 },
                automaticLayout: true,
                tabSize: 2,
                wordWrap: 'on',
              }}
            />
          </div>
          <div className="flex-[3] overflow-y-auto bg-gray-900">
            <div className="flex h-9 items-center justify-between border-b border-gray-800 px-4">
              <span className="text-xs font-medium text-gray-400">Output</span>
              {markers.length > 0 && (
                <span className="flex items-center gap-1 text-xs text-yellow-400">
                  <AlertTriangle className="h-3 w-3" />
                  {markers.length} error{markers.length > 1 ? 's' : ''}
                </span>
              )}
            </div>
            <div className="p-4">
              <SyntaxErrors markers={markers} />
              <OutputContent output={output} errors={errors} testResults={testResults} />
            </div>
          </div>
        </div>
      </div>

      {/* MOBILE: problem on top, editor hidden behind toggle */}
      <div className="md:hidden overflow-x-hidden max-w-full">
        <div className="overflow-y-auto overflow-x-hidden p-4 pb-24">
          <Link
            to="/patterns"
            className="mb-4 inline-flex items-center gap-1 text-sm text-gray-400 hover:text-gray-200"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Link>
          <ProblemHeader problem={problem} pattern={pattern} status={status} />
          <ProblemDescription description={problem.description} />
          <StepBreakdown
            steps={problem.steps}
            expandedSteps={expandedSteps}
            toggleStep={toggleStep}
            revealedHints={revealedHints}
            revealedApproach={revealedApproach}
            revealedCode={revealedCode}
            setRevealedHints={setRevealedHints}
            setRevealedApproach={setRevealedApproach}
            setRevealedCode={setRevealedCode}
          />

          {/* Collapsible Editor */}
          <div className="mb-6">
            <button
              onClick={() => setShowEditor(!showEditor)}
              className="flex w-full items-center justify-between rounded-xl border border-gray-800 bg-gray-900 p-4"
            >
              <div className="flex items-center gap-2">
                <Code2 className="h-5 w-5 text-blue-400" />
                <span className="text-sm font-semibold text-white">Code Editor</span>
              </div>
              <ChevronDown className={`h-5 w-5 text-gray-400 transition-transform ${showEditor ? 'rotate-180' : ''}`} />
            </button>

            {showEditor && (
              <div className="mt-2 overflow-hidden rounded-xl border border-gray-800">
                <EditorToolbar
                  handleReset={handleReset}
                  handleRun={handleRun}
                  isRunning={isRunning}
                  language={language}
                  setLanguage={setLanguage}
                />
                <div className="h-[300px]">
                  <Editor
                    height="100%"
                    language={language}
                    theme="vs-dark"
                    value={code}
                    onChange={handleCodeChange}
                    onValidate={handleValidation}
                    options={{
                      minimap: { enabled: false },
                      fontSize: 13,
                      lineNumbers: 'on',
                      scrollBeyondLastLine: false,
                      padding: { top: 8 },
                      automaticLayout: true,
                      tabSize: 2,
                      wordWrap: 'on',
                    }}
                  />
                </div>
                <div className="border-t border-gray-800 bg-gray-900 p-3">
                  <SyntaxErrors markers={markers} />
                  <OutputContent output={output} errors={errors} testResults={testResults} />
                </div>
              </div>
            )}
          </div>

          <NotesSection notes={notes} setNotesLocal={setNotesLocal} handleSaveNotes={handleSaveNotes} />
        </div>
      </div>
    </>
  );
}

/** Problem title, difficulty, pattern, leetcode link, status */
function ProblemHeader({ problem, pattern, status }) {
  return (
    <div className="mb-4">
      <div className="flex flex-wrap items-center gap-2 mb-2">
        <DifficultyBadge difficulty={problem.difficulty} />
        {pattern && (
          <span className="rounded-full bg-gray-800 px-2.5 py-0.5 text-xs text-gray-400">
            {pattern.icon} {pattern.name}
          </span>
        )}
        {(status === 'solved' || status === 'mastered') && (
          <span className="flex items-center gap-1 rounded-full bg-green-400/10 px-2.5 py-0.5 text-xs text-green-400">
            <CheckCircle2 className="h-3 w-3" /> Solved
          </span>
        )}
      </div>
      <h1 className="text-xl sm:text-2xl font-bold text-white">
        {problem.leetcodeNumber}. {problem.title}
      </h1>
      {problem.leetcodeUrl && (
        <a
          href={problem.leetcodeUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-orange-500/30 bg-orange-500/10 px-3 py-1.5 text-xs font-medium text-orange-400 transition-colors hover:bg-orange-500/20"
        >
          <ExternalLink className="h-3.5 w-3.5" />
          Open in LeetCode
        </a>
      )}
    </div>
  );
}

/** Rendered problem description */
function ProblemDescription({ description }) {
  if (!description) return null;
  return (
    <div className="mb-6 rounded-lg border border-gray-800 bg-gray-900/50 p-4 text-sm text-gray-300 leading-relaxed">
      <MarkdownContent content={description} />
    </div>
  );
}

/** Step-by-step breakdown section */
function StepBreakdown({
  steps,
  expandedSteps,
  toggleStep,
  revealedHints,
  revealedApproach,
  revealedCode,
  setRevealedHints,
  setRevealedApproach,
  setRevealedCode,
}) {
  if (!steps || steps.length === 0) return null;
  return (
    <div className="mb-6">
      <h2 className="mb-3 text-sm font-semibold text-gray-400 uppercase tracking-wider">
        Step-by-Step Breakdown
      </h2>
      <div className="space-y-2">
        {steps.map((step, idx) => (
          <StepCard
            key={idx}
            step={step}
            index={idx}
            isExpanded={expandedSteps[idx]}
            onToggle={() => toggleStep(idx)}
            hintRevealed={revealedHints[idx]}
            approachRevealed={revealedApproach[idx]}
            codeRevealed={revealedCode[idx]}
            onRevealHint={() => setRevealedHints(prev => ({ ...prev, [idx]: true }))}
            onRevealApproach={() => setRevealedApproach(prev => ({ ...prev, [idx]: true }))}
            onRevealCode={() => setRevealedCode(prev => ({ ...prev, [idx]: true }))}
          />
        ))}
      </div>
    </div>
  );
}

/** Notes textarea with save button */
function NotesSection({ notes, setNotesLocal, handleSaveNotes }) {
  return (
    <div className="mb-6">
      <h2 className="mb-3 text-sm font-semibold text-gray-400 uppercase tracking-wider">
        Your Notes
      </h2>
      <textarea
        value={notes}
        onChange={(e) => setNotesLocal(e.target.value)}
        placeholder="Write your notes here..."
        className="w-full rounded-lg border border-gray-800 bg-gray-900 p-3 text-sm text-gray-200 placeholder-gray-600 outline-none focus:border-blue-500/50 min-h-[100px] resize-y"
      />
      <button
        onClick={handleSaveNotes}
        className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-blue-700"
      >
        <Save className="h-3.5 w-3.5" />
        Save Notes
      </button>
    </div>
  );
}

/** Editor toolbar with Run and Reset buttons */
function EditorToolbar({ handleReset, handleRun, isRunning, language, setLanguage }) {
  return (
    <div className="flex items-center justify-between border-b border-gray-800 px-3 sm:px-4 py-2">
      <div className="flex items-center gap-1 rounded-md bg-gray-800 p-0.5">
        <button
          onClick={() => setLanguage('javascript')}
          className={`rounded px-2 py-1 text-xs font-medium transition-colors ${
            language === 'javascript' ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-gray-200'
          }`}
        >
          JS
        </button>
        <button
          onClick={() => setLanguage('typescript')}
          className={`rounded px-2 py-1 text-xs font-medium transition-colors ${
            language === 'typescript' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-gray-200'
          }`}
        >
          TS
        </button>
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={handleReset}
          className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-gray-400 transition-colors hover:bg-gray-800 hover:text-gray-200"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Reset
        </button>
        <button
          onClick={handleRun}
          disabled={isRunning}
          className="flex items-center gap-1.5 rounded-md bg-green-600 px-3 py-1 text-xs font-medium text-white transition-colors hover:bg-green-700 disabled:opacity-50"
        >
          {isRunning ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Play className="h-3.5 w-3.5" />
          )}
          Run
        </button>
      </div>
    </div>
  );
}

/** Displays syntax/type errors from Monaco markers */
function SyntaxErrors({ markers }) {
  if (markers.length === 0) return null;
  return (
    <div className="mb-3 space-y-1">
      {markers.map((m, i) => (
        <div key={i} className="flex items-start gap-2 rounded-lg border border-yellow-500/20 bg-yellow-500/5 px-3 py-2">
          <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0 text-yellow-400 mt-0.5" />
          <div className="text-xs text-yellow-300">
            <span className="text-yellow-500">Ln {m.startLineNumber}, Col {m.startColumn}:</span>{' '}
            {m.message}
          </div>
        </div>
      ))}
    </div>
  );
}

/** Shared output content used in both desktop and mobile output panels */
function OutputContent({ output, errors, testResults }) {
  return (
    <>
      {/* Console Output */}
      {(output || errors) && (
        <div className="mb-4">
          {output && (
            <pre className="whitespace-pre-wrap rounded-lg bg-gray-950 p-3 font-mono text-xs text-gray-300">
              {output}
            </pre>
          )}
          {errors && (
            <pre className="mt-2 whitespace-pre-wrap rounded-lg bg-red-500/10 p-3 font-mono text-xs text-red-400">
              {errors}
            </pre>
          )}
        </div>
      )}

      {/* Test Results */}
      {testResults.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-gray-400">Test Results</span>
            <span className={`text-xs font-medium ${
              testResults.every(t => t.passed) ? 'text-green-400' : 'text-red-400'
            }`}>
              {testResults.filter(t => t.passed).length}/{testResults.length} passed
            </span>
          </div>
          {testResults.map((tc, idx) => (
            <div
              key={idx}
              className={`rounded-lg border p-3 ${
                tc.passed
                  ? 'border-green-500/20 bg-green-500/5'
                  : 'border-red-500/20 bg-red-500/5'
              }`}
            >
              <div className="mb-1 flex items-center gap-2">
                {tc.passed ? (
                  <CheckCircle2 className="h-4 w-4 text-green-400" />
                ) : (
                  <XCircle className="h-4 w-4 text-red-400" />
                )}
                <span className="text-xs font-medium text-gray-300">
                  {tc.description || `Test Case ${idx + 1}`}
                </span>
              </div>
              <div className="space-y-1 font-mono text-xs">
                <div className="text-gray-500 break-all">
                  Input: {JSON.stringify(tc.args)}
                </div>
                <div className="text-gray-500 break-all">
                  Expected: <span className="text-gray-300">{JSON.stringify(tc.expected)}</span>
                </div>
                <div className={`break-all ${tc.passed ? 'text-green-400' : 'text-red-400'}`}>
                  Actual: {tc.error ? tc.error : JSON.stringify(tc.actual)}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {!output && !errors && testResults.length === 0 && (
        <div className="flex items-center justify-center py-8 text-sm text-gray-600">
          Click "Run" to execute your code and see results here.
        </div>
      )}
    </>
  );
}

function StepCard({
  step,
  index,
  isExpanded,
  onToggle,
  hintRevealed,
  approachRevealed,
  codeRevealed,
  onRevealHint,
  onRevealApproach,
  onRevealCode,
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-gray-800 bg-gray-900/50">
      <button
        onClick={onToggle}
        className="flex w-full items-center gap-3 p-3 sm:p-4 text-left transition-colors hover:bg-gray-800/50"
      >
        <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-blue-500/20 text-xs font-medium text-blue-400">
          {index + 1}
        </div>
        <span className="text-sm font-medium text-white">{step.title}</span>
        {isExpanded ? (
          <ChevronDown className="ml-auto h-4 w-4 flex-shrink-0 text-gray-500" />
        ) : (
          <ChevronRight className="ml-auto h-4 w-4 flex-shrink-0 text-gray-500" />
        )}
      </button>

      {isExpanded && (
        <div className="border-t border-gray-800 p-3 sm:p-4 space-y-3">
          {/* Hint */}
          <RevealButton
            label="Hint"
            icon={<Lightbulb className="h-3.5 w-3.5" />}
            revealed={hintRevealed}
            onReveal={onRevealHint}
            content={step.hint}
            bgColor="bg-yellow-500/10"
            textColor="text-yellow-300"
            borderColor="border-yellow-500/20"
            buttonColor="bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30"
          />

          {/* Approach */}
          <RevealButton
            label="Approach"
            icon={<BookOpen className="h-3.5 w-3.5" />}
            revealed={approachRevealed}
            onReveal={onRevealApproach}
            content={step.approach}
            bgColor="bg-blue-500/10"
            textColor="text-blue-300"
            borderColor="border-blue-500/20"
            buttonColor="bg-blue-500/20 text-blue-400 hover:bg-blue-500/30"
          />

          {/* Code */}
          <RevealButton
            label="Code"
            icon={<Code2 className="h-3.5 w-3.5" />}
            revealed={codeRevealed}
            onReveal={onRevealCode}
            content={step.code}
            isCode={true}
            bgColor="bg-gray-800"
            textColor="text-gray-200"
            borderColor="border-gray-700"
            buttonColor="bg-gray-800 text-gray-300 hover:bg-gray-700"
          />

          {/* Complexity */}
          {step.complexity && (
            <div className="rounded-lg border border-gray-800 bg-gray-800/50 px-3 py-2 text-xs text-gray-400">
              {step.complexity}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function RevealButton({
  label,
  icon,
  revealed,
  onReveal,
  content,
  isCode,
  bgColor,
  textColor,
  borderColor,
  buttonColor,
}) {
  if (!revealed) {
    return (
      <button
        onClick={onReveal}
        className={`flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium transition-colors ${buttonColor}`}
      >
        <Eye className="h-3.5 w-3.5" />
        Show {label}
      </button>
    );
  }

  return (
    <div className={`rounded-lg border ${borderColor} ${bgColor} p-3`}>
      <div className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-gray-400">
        {icon}
        {label}
      </div>
      {isCode ? (
        <pre className="overflow-x-auto whitespace-pre-wrap break-words font-mono text-xs leading-relaxed text-gray-200 max-w-full">
          {content}
        </pre>
      ) : (
        <p className={`text-sm leading-relaxed ${textColor}`}>{content}</p>
      )}
    </div>
  );
}

function DifficultyBadge({ difficulty }) {
  const colors = {
    Easy: 'text-green-400 bg-green-400/10',
    Medium: 'text-yellow-400 bg-yellow-400/10',
    Hard: 'text-red-400 bg-red-400/10',
  };

  return (
    <span
      className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${colors[difficulty]}`}
    >
      {difficulty}
    </span>
  );
}

function MarkdownContent({ content }) {
  // Simple markdown-like rendering for the problem description
  const lines = content.split('\n');
  return (
    <div className="space-y-2">
      {lines.map((line, i) => {
        if (line.startsWith('**') && line.endsWith('**')) {
          return (
            <p key={i} className="font-semibold text-white">
              {line.replace(/\*\*/g, '')}
            </p>
          );
        }
        if (line.startsWith('```')) return null;
        if (line.startsWith('- ')) {
          return (
            <p key={i} className="pl-4 text-gray-300">
              {'\u2022 '}{line.substring(2)}
            </p>
          );
        }
        // Inline code
        const parts = line.split(/(`[^`]+`)/g);
        return (
          <p key={i}>
            {parts.map((part, j) => {
              if (part.startsWith('`') && part.endsWith('`')) {
                return (
                  <code
                    key={j}
                    className="rounded bg-gray-800 px-1.5 py-0.5 font-mono text-xs text-blue-300"
                  >
                    {part.slice(1, -1)}
                  </code>
                );
              }
              // Bold inline
              const boldParts = part.split(/(\*\*[^*]+\*\*)/g);
              return boldParts.map((bp, k) => {
                if (bp.startsWith('**') && bp.endsWith('**')) {
                  return (
                    <strong key={`${j}-${k}`} className="font-semibold text-white">
                      {bp.slice(2, -2)}
                    </strong>
                  );
                }
                return <span key={`${j}-${k}`}>{bp}</span>;
              });
            })}
          </p>
        );
      })}
    </div>
  );
}
