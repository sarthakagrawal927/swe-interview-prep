import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import Editor from '@monaco-editor/react';
import { Panel, Group as PanelGroup, Separator as PanelResizeHandle } from 'react-resizable-panels';
import { useProblems } from '../hooks/useProblems';
import { useProgress } from '../hooks/useProgress';
import { useCodeExecution } from '../hooks/useCodeExecution';
import { useAI, loadAIConfig, saveAIConfig, getModels, LOCAL_PROVIDERS, type AIProvider } from '../hooks/useAI';
import { useNotes } from '../hooks/useNotes';
import { fetchLeetCodeProblem, buildProblemFromLeetCode } from '../lib/leetcode';
import { useCategory } from '../contexts/CategoryContext';
import { getCategoryConfig } from '../types';
import type { Language, SimilarQuestion } from '../types';
import DiagramEditor from '../components/DiagramEditor';
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
  Bot,
  Send,
  X,
  Settings,
  PlusCircle,
  Link2,
  PenTool,
  GripVertical,
} from 'lucide-react';

export default function ProblemView() {
  const { id } = useParams();
  const { category } = useCategory();
  const catConfig = getCategoryConfig(category);
  const { getById, patterns } = useProblems(category);
  const { getStatus, updateStatus, getSavedCode, getSavedLanguage, saveCode } = useProgress();
  const { execute, output, errors, testResults, isRunning, clearOutput } = useCodeExecution();
  const ai = useAI(id);
  const { notes: notesFromSupabase, saveNotes: saveNotesToSupabase } = useNotes(id);

  const problem = getById(id!);
  const [code, setCode] = useState('');
  const [language, setLanguage] = useState<Language>('javascript');
  const [showAI, setShowAI] = useState(false);
  const [notes, setNotesLocal] = useState('');
  const [expandedSteps, setExpandedSteps] = useState({});
  const [revealedHints, setRevealedHints] = useState({});
  const [revealedApproach, setRevealedApproach] = useState({});
  const [revealedCode, setRevealedCode] = useState({});
  const [editorMode, setEditorMode] = useState<'code' | 'diagram'>(category === 'hld' ? 'diagram' : 'code');
  const [showEditor, setShowEditor] = useState(false);
  const [markers, setMarkers] = useState([]);
  const [selectedCode, setSelectedCode] = useState('');
  const editorRef = useRef<any>(null);
  const saveTimerRef = useRef(null);

  // Sync Supabase notes into local state when loaded
  useEffect(() => {
    setNotesLocal(notesFromSupabase);
  }, [notesFromSupabase]);

  useEffect(() => {
    if (problem) {
      const saved = getSavedCode(problem.id);
      setCode(saved !== null ? saved : (problem.starterCode || ''));
      setLanguage(getSavedLanguage(problem.id));
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

  const handleEditorMount = useCallback((editor: any) => {
    editorRef.current = editor;
    editor.onDidChangeCursorSelection(() => {
      const selection = editor.getSelection();
      if (selection && !selection.isEmpty()) {
        const text = editor.getModel()?.getValueInRange(selection) || '';
        setSelectedCode(text);
      } else {
        setSelectedCode('');
      }
    });
  }, []);

  const handleRun = useCallback(async () => {
    if (!problem || isRunning) return;
    const status = getStatus(problem.id);
    if (status === 'unseen') {
      updateStatus(problem.id, 'attempted');
    }
    const result = await execute(code, problem.testCases || [], language);
    if (result.testResults.length > 0 && result.testResults.every(t => t.passed)) {
      updateStatus(problem.id, 'solved');
    }
  }, [code, problem, isRunning, execute, getStatus, updateStatus, language]);

  const handleReset = () => {
    if (problem) {
      setCode(problem.starterCode || '');
      setMarkers([]);
      clearOutput();
      saveCode(problem.id, problem.starterCode || '', language);
    }
  };

  const handleSaveNotes = () => {
    if (problem) {
      saveNotesToSupabase(notes);
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
          <Link to={`/${category}/patterns`} className="mt-4 inline-block text-blue-400 hover:text-blue-300">
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
      <div className="hidden md:block h-[calc(100vh-4rem)]">
        <PanelGroup orientation="horizontal">
        <Panel defaultSize={40} minSize={25}>
          <div className="flex flex-col h-full border-r border-gray-800">
          <div className="flex-1 overflow-y-auto p-6">
            <Link
              to={`/${category}/patterns`}
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
            <ResourceLinks resources={problem.resources} patternResources={pattern?.resources} />
            <NotesSection notes={notes} setNotesLocal={setNotesLocal} handleSaveNotes={handleSaveNotes} />
            <SimilarProblems problem={problem} />
          </div>
          </div>
        </Panel>
        <PanelResizeHandle className="group relative flex w-2 items-center justify-center bg-gray-900 hover:bg-gray-800 transition-colors">
          <div className="w-0.5 h-8 rounded-full bg-gray-700 group-hover:bg-gray-500 transition-colors" />
        </PanelResizeHandle>
        <Panel defaultSize={60} minSize={35}>
        <div className="flex flex-col h-full bg-gray-950">
          <PanelGroup orientation="vertical">
            <Panel defaultSize={70} minSize={30}>
              <div className="flex flex-col h-full">
                <EditorToolbar
                  handleReset={handleReset}
                  handleRun={handleRun}
                  isRunning={isRunning}
                  language={language}
                  setLanguage={setLanguage}
                  onAskAI={() => setShowAI(!showAI)}
                  showAI={showAI}
                  editorMode={editorMode}
                  onToggleMode={category === 'hld' ? () => setEditorMode(m => m === 'code' ? 'diagram' : 'code') : undefined}
                />
                <div className="flex-1 min-h-0">
                  {editorMode === 'diagram' ? (
                    <DiagramEditor problemId={problem.id} />
                  ) : (
                    <Editor
                      height="100%"
                      language={language}
                      theme="vs-dark"
                      value={code}
                      onChange={handleCodeChange}
                      onValidate={handleValidation}
                      onMount={handleEditorMount}
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
                  )}
                </div>
              </div>
            </Panel>
            <PanelResizeHandle className="group relative flex h-2 items-center justify-center bg-gray-900 hover:bg-gray-800 transition-colors">
              <div className="h-0.5 w-8 rounded-full bg-gray-700 group-hover:bg-gray-500 transition-colors" />
            </PanelResizeHandle>
            <Panel defaultSize={30} minSize={10}>
              <div className="flex flex-col h-full overflow-y-auto bg-gray-900">
                {showAI ? (
                  <AIPanel ai={ai} problem={problem} code={code} language={language} selectedCode={selectedCode} />
                ) : (
                  <>
                    <div className="flex h-9 items-center justify-between border-b border-gray-800 px-4">
                      <span className="text-xs font-medium text-gray-400">Output</span>
                      <div className="flex items-center gap-2">
                        {markers.length > 0 && (
                          <span className="flex items-center gap-1 text-xs text-yellow-400">
                            <AlertTriangle className="h-3 w-3" />
                            {markers.length} error{markers.length > 1 ? 's' : ''}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="p-4">
                      <SyntaxErrors markers={markers} />
                      <OutputContent output={output} errors={errors} testResults={testResults} />
                    </div>
                  </>
                )}
              </div>
            </Panel>
          </PanelGroup>
        </div>
        </Panel>
        </PanelGroup>
      </div>

      {/* MOBILE: problem on top, editor hidden behind toggle */}
      <div className="md:hidden overflow-x-hidden max-w-full">
        <div className="overflow-y-auto overflow-x-hidden p-4 pb-24">
          <Link
            to={`/${category}/patterns`}
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
                    onMount={handleEditorMount}
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
                  {showAI ? (
                    <AIPanel ai={ai} problem={problem} code={code} language={language} selectedCode={selectedCode} />
                  ) : (
                    <>
                      <SyntaxErrors markers={markers} />
                      <OutputContent output={output} errors={errors} testResults={testResults} />
                    </>
                  )}
                </div>
              </div>
            )}
          </div>

          <ResourceLinks resources={problem.resources} patternResources={pattern?.resources} />
          <NotesSection notes={notes} setNotesLocal={setNotesLocal} handleSaveNotes={handleSaveNotes} />
          <SimilarProblems problem={problem} />
        </div>
      </div>
    </>
  );
}

/** Problem title, difficulty, pattern, leetcode link, status */
function ProblemHeader({ problem, pattern, status }) {
  const { category } = useCategory();
  return (
    <div className="mb-4">
      <div className="flex flex-wrap items-center gap-2 mb-2">
        <DifficultyBadge difficulty={problem.difficulty} />
        {pattern && (
          <Link
            to={`/${category}/patterns?pattern=${pattern.id}`}
            className="rounded-full bg-gray-800 px-2.5 py-0.5 text-xs text-gray-400 hover:bg-gray-700 hover:text-gray-200 transition-colors"
          >
            {pattern.icon} {pattern.name}
          </Link>
        )}
        {(status === 'solved' || status === 'mastered') && (
          <span className="flex items-center gap-1 rounded-full bg-green-400/10 px-2.5 py-0.5 text-xs text-green-400">
            <CheckCircle2 className="h-3 w-3" /> Solved
          </span>
        )}
      </div>
      <h1 className="text-xl sm:text-2xl font-bold text-white">
        {problem.leetcodeNumber ? `${problem.leetcodeNumber}. ` : ''}{problem.title}
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

/** Learning resources for the problem/pattern */
function ResourceLinks({ resources, patternResources }: { resources?: { title: string; url: string; type?: string }[]; patternResources?: { title: string; url: string; type?: string }[] }) {
  const all = [...(resources || []), ...(patternResources || [])];
  if (all.length === 0) return null;
  const typeIcons: Record<string, string> = { article: '📄', video: '🎥', course: '📚', docs: '📖' };
  return (
    <div className="mb-6">
      <h2 className="mb-3 text-sm font-semibold text-gray-400 uppercase tracking-wider">
        Learning Resources
      </h2>
      <div className="space-y-1.5">
        {all.map((r, i) => (
          <a
            key={i}
            href={r.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 rounded-lg border border-gray-800 bg-gray-900/50 px-3 py-2 text-sm text-blue-400 transition-colors hover:bg-gray-800/50 hover:text-blue-300"
          >
            <span className="flex-shrink-0">{typeIcons[r.type || 'article'] || '🔗'}</span>
            <span className="truncate">{r.title}</span>
            <ExternalLink className="h-3 w-3 flex-shrink-0 text-gray-600 ml-auto" />
          </a>
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
function EditorToolbar({ handleReset, handleRun, isRunning, language, setLanguage, onAskAI, showAI, editorMode, onToggleMode }: {
  handleReset: () => void; handleRun: () => void; isRunning: boolean;
  language: Language; setLanguage: (l: Language) => void;
  onAskAI?: () => void; showAI?: boolean;
  editorMode?: 'code' | 'diagram'; onToggleMode?: () => void;
}) {
  return (
    <div className="flex items-center justify-between border-b border-gray-800 px-3 sm:px-4 py-2">
      <div className="flex items-center gap-2">
        {/* Code / Diagram toggle */}
        {onToggleMode && (
          <div className="flex items-center gap-1 rounded-md bg-gray-800 p-0.5">
            <button
              onClick={() => editorMode !== 'code' && onToggleMode()}
              className={`flex items-center gap-1 rounded px-2 py-1 text-xs font-medium transition-colors ${
                editorMode === 'code' ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              <Code2 className="h-3 w-3" />
              Code
            </button>
            <button
              onClick={() => editorMode !== 'diagram' && onToggleMode()}
              className={`flex items-center gap-1 rounded px-2 py-1 text-xs font-medium transition-colors ${
                editorMode === 'diagram' ? 'bg-orange-600 text-white' : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              <PenTool className="h-3 w-3" />
              Draw
            </button>
          </div>
        )}
        {/* Language selector (only when in code mode) */}
        {editorMode !== 'diagram' && (
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
        )}
        {onAskAI && (
          <button
            onClick={onAskAI}
            className={`flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium transition-colors ${
              showAI ? 'bg-purple-600 text-white' : 'text-purple-400 hover:bg-purple-500/20'
            }`}
          >
            <Bot className="h-3.5 w-3.5" />
            AI
          </button>
        )}
      </div>
      <div className="flex items-center gap-2">
        {editorMode !== 'diagram' && (
          <>
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
          </>
        )}
      </div>
    </div>
  );
}

/** AI Advisor Panel */
function AIPanel({ ai, problem, code, language, selectedCode }: { ai: ReturnType<typeof useAI>; problem: any; code: string; language: Language; selectedCode?: string }) {
  const [input, setInput] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [config, setConfig] = useState(loadAIConfig);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [ai.messages]);

  const buildSystemContext = (extraSnippet?: string) => {
    let ctx = `Problem: "${problem.title}" (${problem.difficulty})\nPattern: ${problem.pattern}\nDescription: ${problem.description?.slice(0, 500)}\n\nStudent's current code (${language}):\n\`\`\`\n${code}\n\`\`\``;
    if (extraSnippet) {
      ctx += `\n\nThe student has selected this specific code snippet and is asking about it:\n\`\`\`\n${extraSnippet}\n\`\`\``;
    }
    return ctx;
  };

  const handleSend = () => {
    if (!input.trim() || ai.isStreaming) return;
    if (!LOCAL_PROVIDERS.has(config.provider) && !config.apiKey) {
      setShowSettings(true);
      return;
    }
    abortRef.current = new AbortController();
    ai.ask(input, config, buildSystemContext(selectedCode || undefined), abortRef.current.signal);
    setInput('');
  };

  const handleAskAboutSelection = (question: string) => {
    if (!selectedCode || ai.isStreaming) return;
    if (!LOCAL_PROVIDERS.has(config.provider) && !config.apiKey) {
      setShowSettings(true);
      return;
    }
    const msg = `[Selected code]\n\`\`\`\n${selectedCode}\n\`\`\`\n\n${question}`;
    abortRef.current = new AbortController();
    ai.ask(msg, config, buildSystemContext(selectedCode), abortRef.current.signal);
  };

  const handleSaveSettings = () => {
    saveAIConfig(config);
    setShowSettings(false);
  };

  if (showSettings) {
    return (
      <div className="flex flex-col h-full">
        <div className="flex h-9 items-center justify-between border-b border-gray-800 px-4">
          <span className="text-xs font-medium text-purple-400">AI Settings</span>
          <button onClick={() => setShowSettings(false)} className="text-gray-400 hover:text-gray-200">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
        <div className="p-4 space-y-3">
          <div>
            <label className="mb-1 block text-xs text-gray-400">Provider</label>
            <select
              value={config.provider}
              onChange={e => {
                const p = e.target.value as AIProvider;
                setConfig(prev => ({ ...prev, provider: p, model: getModels(p)[0] }));
              }}
              className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-xs text-gray-200 outline-none"
            >
              <optgroup label="Local CLI (no API key)">
                <option value="claude-code">Claude Code</option>
                <option value="codex">Codex CLI</option>
                <option value="gemini-cli">Gemini CLI</option>
              </optgroup>
              <optgroup label="Cloud API (needs key)">
                <option value="openai">OpenAI</option>
                <option value="anthropic">Anthropic</option>
                <option value="google">Google Gemini</option>
                <option value="deepseek">DeepSeek</option>
                <option value="qwen">Qwen (Alibaba)</option>
              </optgroup>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs text-gray-400">Model</label>
            <select
              value={config.model}
              onChange={e => setConfig(prev => ({ ...prev, model: e.target.value }))}
              className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-xs text-gray-200 outline-none"
            >
              {getModels(config.provider).map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          {LOCAL_PROVIDERS.has(config.provider) ? (
            <div className="rounded-lg border border-gray-700 bg-gray-800/50 p-3">
              <p className="text-xs text-gray-400">No API key needed. Uses your local CLI.</p>
              <p className="mt-1 text-xs text-gray-500">Run <code className="rounded bg-gray-700 px-1">npm run server</code> to start the local server.</p>
            </div>
          ) : (
            <div>
              <label className="mb-1 block text-xs text-gray-400">API Key</label>
              <input
                type="password"
                value={config.apiKey}
                onChange={e => setConfig(prev => ({ ...prev, apiKey: e.target.value }))}
                placeholder="sk-..."
                className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-xs text-gray-200 placeholder-gray-500 outline-none"
              />
            </div>
          )}
          <button
            onClick={handleSaveSettings}
            className="w-full rounded-lg bg-purple-600 py-2 text-xs font-medium text-white hover:bg-purple-700"
          >
            Save
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex h-9 items-center justify-between border-b border-gray-800 px-4">
        <span className="flex items-center gap-1.5 text-xs font-medium text-purple-400">
          <Bot className="h-3.5 w-3.5" />
          AI Advisor
        </span>
        <div className="flex items-center gap-1">
          <button onClick={() => ai.clearMessages()} className="text-xs text-gray-500 hover:text-gray-300 px-1">Clear</button>
          <button onClick={() => setShowSettings(true)} className="text-gray-400 hover:text-gray-200">
            <Settings className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-3 space-y-3 min-h-0">
        {ai.messages.length === 0 && (
          <div className="text-center py-4">
            <Bot className="mx-auto h-8 w-8 text-gray-700 mb-2" />
            <p className="text-xs text-gray-500">Ask for hints, approach ideas, or help debugging — without spoilers.</p>
            <div className="mt-3 flex flex-wrap gap-1.5 justify-center">
              {['Give me a hint', 'What pattern should I use?', 'Help me debug'].map(q => (
                <button
                  key={q}
                  onClick={() => { setInput(q); }}
                  className="rounded-full border border-gray-700 bg-gray-800 px-2.5 py-1 text-xs text-gray-400 hover:border-purple-500/50 hover:text-purple-300"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}
        {ai.messages.map((msg, i) => (
          <div key={i} className={`text-xs leading-relaxed ${msg.role === 'user' ? 'text-gray-300' : 'text-purple-200'}`}>
            <span className={`text-[10px] font-medium uppercase tracking-wider ${msg.role === 'user' ? 'text-gray-500' : 'text-purple-500'}`}>
              {msg.role === 'user' ? 'You' : 'AI'}
            </span>
            <p className="mt-0.5 whitespace-pre-wrap">{msg.content}{ai.isStreaming && i === ai.messages.length - 1 && msg.role === 'assistant' ? '▊' : ''}</p>
          </div>
        ))}
        {ai.error && (
          <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-2 text-xs text-red-400">
            {ai.error}
          </div>
        )}
        <div ref={chatEndRef} />
      </div>
      <div className="border-t border-gray-800">
        {selectedCode && (
          <div className="border-b border-gray-800 px-2 py-1.5">
            <div className="flex items-center gap-1.5 mb-1.5">
              <Code2 className="h-3 w-3 text-blue-400 flex-shrink-0" />
              <span className="text-[10px] text-blue-400 font-medium truncate">
                Selected: {selectedCode.split('\n')[0].slice(0, 40)}{selectedCode.length > 40 ? '...' : ''}
              </span>
            </div>
            <div className="flex flex-wrap gap-1">
              {['Explain this code', 'Is this correct?', 'How to optimize this?', 'What\'s the time complexity?'].map(q => (
                <button
                  key={q}
                  onClick={() => handleAskAboutSelection(q)}
                  disabled={ai.isStreaming}
                  className="rounded-full border border-blue-500/30 bg-blue-500/10 px-2 py-0.5 text-[10px] text-blue-300 hover:bg-blue-500/20 disabled:opacity-50"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}
        <div className="flex gap-1.5 p-2">
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSend()}
            placeholder={config.apiKey ? (selectedCode ? 'Ask about selection or type a question...' : 'Ask for a hint...') : 'Set API key in settings first'}
            disabled={!config.apiKey && !showSettings}
            className="flex-1 rounded-lg border border-gray-700 bg-gray-800 px-3 py-1.5 text-xs text-gray-200 placeholder-gray-500 outline-none focus:border-purple-500/50 disabled:opacity-50"
          />
          <button
            onClick={handleSend}
            disabled={ai.isStreaming || !input.trim()}
            className="rounded-lg bg-purple-600 px-2.5 py-1.5 text-white transition-colors hover:bg-purple-700 disabled:opacity-50"
          >
            {ai.isStreaming ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
          </button>
        </div>
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
  isCode = false,
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

function SimilarProblems({ problem }: { problem: any }) {
  const navigate = useNavigate();
  const { category } = useCategory();
  const { getBySlug, getByPattern, addCustomProblem, patterns } = useProblems(category);
  const [importing, setImporting] = useState<string | null>(null);

  // Same-pattern problems (excluding current)
  const samePattern = getByPattern(problem.pattern)
    .filter(p => p.id !== problem.id)
    .slice(0, 3);

  // LeetCode similar questions from the problem data
  const similarFromLC: SimilarQuestion[] = (problem.similarQuestions || []).slice(0, 5);

  if (samePattern.length === 0 && similarFromLC.length === 0) return null;

  const handleImportSimilar = async (slug: string) => {
    const existing = getBySlug(slug);
    if (existing) {
      navigate(`/${category}/problem/${existing.id}`);
      return;
    }

    setImporting(slug);
    try {
      const data = await fetchLeetCodeProblem(slug);
      const q = data.data.question;
      const pat = patterns.find(p => p.id === problem.pattern);
      const newProblem = buildProblemFromLeetCode(q, slug, pat?.name || '');
      addCustomProblem(newProblem);
      navigate(`/${category}/problem/${newProblem.id}`);
    } catch {
      // Fallback: navigate to import page
      navigate(`/import`);
    } finally {
      setImporting(null);
    }
  };

  const diffColors: Record<string, string> = {
    Easy: 'text-green-400', Medium: 'text-yellow-400', Hard: 'text-red-400',
  };

  return (
    <div className="mb-6">
      <h2 className="mb-3 text-sm font-semibold text-gray-400 uppercase tracking-wider">
        Similar Problems
      </h2>

      <div className="space-y-2">
        {/* Same-pattern problems already in the app */}
        {samePattern.map(p => (
          <Link
            key={p.id}
            to={`/${category}/problem/${p.id}`}
            className="flex items-center justify-between rounded-lg border border-gray-800 bg-gray-900/50 p-3 transition-colors hover:bg-gray-800/50"
          >
            <div className="min-w-0">
              <div className="text-sm font-medium text-gray-200 truncate">
                {p.leetcodeNumber ? `${p.leetcodeNumber}. ` : ''}{p.title}
              </div>
            </div>
            <span className={`ml-2 flex-shrink-0 text-xs font-medium ${diffColors[p.difficulty] || 'text-gray-400'}`}>
              {p.difficulty}
            </span>
          </Link>
        ))}

        {/* LeetCode similar questions (may need import) */}
        {similarFromLC.map(sq => {
          const existing = getBySlug(sq.titleSlug);
          if (existing && samePattern.some(p => p.id === existing.id)) return null;

          return (
            <button
              key={sq.titleSlug}
              onClick={() => existing ? navigate(`/${category}/problem/${existing.id}`) : handleImportSimilar(sq.titleSlug)}
              disabled={importing === sq.titleSlug}
              className="flex w-full items-center justify-between rounded-lg border border-gray-800 bg-gray-900/50 p-3 text-left transition-colors hover:bg-gray-800/50 disabled:opacity-50"
            >
              <div className="flex items-center gap-2 min-w-0">
                {!existing && (
                  importing === sq.titleSlug
                    ? <Loader2 className="h-3.5 w-3.5 flex-shrink-0 text-blue-400 animate-spin" />
                    : <PlusCircle className="h-3.5 w-3.5 flex-shrink-0 text-blue-400" />
                )}
                <span className="text-sm font-medium text-gray-200 truncate">{sq.title}</span>
              </div>
              <div className="flex items-center gap-2 ml-2 flex-shrink-0">
                <span className={`text-xs font-medium ${diffColors[sq.difficulty] || 'text-gray-400'}`}>
                  {sq.difficulty}
                </span>
                {!existing && (
                  <Link2 className="h-3 w-3 text-gray-600" />
                )}
              </div>
            </button>
          );
        })}
      </div>
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
