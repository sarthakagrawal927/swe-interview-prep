import { useState, useCallback, useRef } from 'react';
import { Panel, Group as PanelGroup, Separator as PanelResizeHandle } from 'react-resizable-panels';
import { compressToEncodedURIComponent, decompressFromEncodedURIComponent } from 'lz-string';
import DiagramEditor from '../components/DiagramEditor';
import CodeEditor from '../components/CodeEditor';
import { useCodeExecution } from '../hooks/useCodeExecution';
import { Code2, PenTool, GripVertical, Play, Loader2, Copy, Check, Share2, Clock, FileText, Eye, Pencil, AlertTriangle } from 'lucide-react';
import MarkdownViewer from '../components/MarkdownViewer';
import type { Language } from '../types';

const STORAGE_KEY = 'playground-code';
const LANG_KEY = 'playground-language';
const PROBLEM_KEY = 'playground-problem';
const PANELS_KEY = 'playground-panels';

type PanelId = 'problem' | 'code' | 'diagram';

function loadFromHash(): { code: string; lang: Language } | null {
  const hash = window.location.hash.slice(1);
  if (!hash) return null;
  try {
    const json = decompressFromEncodedURIComponent(hash);
    if (!json) return null;
    const parsed = JSON.parse(json);
    return { code: parsed.c || '', lang: parsed.l || 'typescript' };
  } catch {
    return null;
  }
}

function loadPanels(): Set<PanelId> {
  try {
    const saved = localStorage.getItem(PANELS_KEY);
    if (saved) return new Set(JSON.parse(saved));
  } catch {}
  return new Set(['code', 'diagram']);
}

export default function Playground() {
  const shared = loadFromHash();

  const [language, setLanguage] = useState<Language>(
    () => shared?.lang || (localStorage.getItem(LANG_KEY) as Language) || 'typescript'
  );
  const [code, setCode] = useState(() => shared?.code || localStorage.getItem(STORAGE_KEY) || '');
  const [problem, setProblem] = useState(() => localStorage.getItem(PROBLEM_KEY) || '');
  const [visiblePanels, setVisiblePanels] = useState<Set<PanelId>>(loadPanels);
  const saveTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const problemTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const editorRef = useRef<any>(null);
  const { execute, output, errors, isRunning, execTimeMs, errorLine } = useCodeExecution();
  const [copied, setCopied] = useState(false);
  const [shared_, setShared] = useState(false);
  const [hasRun, setHasRun] = useState(false);
  const [problemPreview, setProblemPreview] = useState(false);
  const [bottomTab, setBottomTab] = useState<'output' | 'problems'>('output');
  const [markers, setMarkers] = useState<any[]>([]);

  const togglePanel = (id: PanelId) => {
    setVisiblePanels(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        if (next.size <= 1) return prev; // keep at least one
        next.delete(id);
      } else {
        next.add(id);
      }
      localStorage.setItem(PANELS_KEY, JSON.stringify([...next]));
      return next;
    });
  };

  const handleCodeChange = useCallback((value: string | undefined) => {
    const v = value || '';
    setCode(v);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => localStorage.setItem(STORAGE_KEY, v), 800);
  }, []);

  const handleProblemChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const v = e.target.value;
    setProblem(v);
    if (problemTimer.current) clearTimeout(problemTimer.current);
    problemTimer.current = setTimeout(() => localStorage.setItem(PROBLEM_KEY, v), 800);
  }, []);

  const handleLanguageChange = (lang: Language) => {
    setLanguage(lang);
    localStorage.setItem(LANG_KEY, lang);
  };

  const handleRun = useCallback(() => {
    if (isRunning) return;
    setHasRun(true);
    setBottomTab('output');
    execute(code, [], language);
  }, [code, isRunning, execute, language]);

  const handleValidation = useCallback((newMarkers: any[]) => {
    setMarkers(newMarkers.filter((m: any) => m.severity >= 8));
  }, []);

  const handleFormat = () => {
    editorRef.current?.__prettierFormat?.();
  };

  const handleCopy = () => {
    const text = [output, errors].filter(Boolean).join('\n');
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const handleShare = () => {
    const payload = JSON.stringify({ c: code, l: language });
    const compressed = compressToEncodedURIComponent(payload);
    const url = `${window.location.origin}/playground#${compressed}`;
    navigator.clipboard.writeText(url);
    window.history.replaceState(null, '', `/playground#${compressed}`);
    setShared(true);
    setTimeout(() => setShared(false), 2000);
  };

  const formatTime = (ms: number) => ms < 1 ? '<1ms' : ms < 1000 ? `${ms.toFixed(1)}ms` : `${(ms / 1000).toFixed(2)}s`;

  const panelBtn = (id: PanelId, active: boolean) =>
    `flex items-center gap-1 rounded px-2 py-1 text-xs font-medium transition-colors ${
      active ? 'bg-gray-700 text-white' : 'text-gray-500 hover:text-gray-300'
    }`;

  const langBtn = (active: boolean) =>
    `px-2 py-1 rounded text-xs font-medium transition-colors ${
      active ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-gray-200'
    }`;

  const panels = ['problem', 'code', 'diagram'].filter(id => visiblePanels.has(id as PanelId)) as PanelId[];
  const panelSize = Math.floor(100 / panels.length);

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col">
      {/* Toolbar */}
      <div className="flex items-center justify-between border-b border-gray-800 bg-gray-950 px-4 py-2">
        <div className="flex items-center gap-2">
          {/* Panel toggles */}
          <div className="flex items-center gap-1 rounded-lg bg-gray-800 p-0.5">
            <button onClick={() => togglePanel('problem')} className={panelBtn('problem', visiblePanels.has('problem'))}>
              <FileText className="h-3 w-3" />
              Problem
            </button>
            <button onClick={() => togglePanel('code')} className={panelBtn('code', visiblePanels.has('code'))}>
              <Code2 className="h-3 w-3" />
              Code
            </button>
            <button onClick={() => togglePanel('diagram')} className={panelBtn('diagram', visiblePanels.has('diagram'))}>
              <PenTool className="h-3 w-3" />
              Draw
            </button>
          </div>

          {visiblePanels.has('code') && (
            <>
              <div className="mx-1 h-4 w-px bg-gray-800" />
              <div className="flex items-center gap-1 rounded-lg bg-gray-800 p-0.5">
                <button onClick={() => handleLanguageChange('javascript')} className={langBtn(language === 'javascript')}>JS</button>
                <button onClick={() => handleLanguageChange('typescript')} className={langBtn(language === 'typescript')}>TS</button>
                <button onClick={() => handleLanguageChange('go')} className={langBtn(language === 'go')}>Go</button>
              </div>
            </>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleShare}
            className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-gray-400 transition-colors hover:bg-gray-800 hover:text-gray-200"
          >
            {shared_ ? <Check className="h-3.5 w-3.5 text-green-400" /> : <Share2 className="h-3.5 w-3.5" />}
            {shared_ ? 'Copied!' : 'Share'}
          </button>
          {visiblePanels.has('code') && (
            <>
              <button
                onClick={handleFormat}
                className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-gray-400 transition-colors hover:bg-gray-800 hover:text-gray-200"
              >
                <Code2 className="h-3.5 w-3.5" />
                Format <span className="ml-1 text-gray-500">&#x21E7;&#x2318;F</span>
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
                Run <span className="ml-1 opacity-70">&#x2318;&#x23CE;</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Panels */}
      <PanelGroup orientation="horizontal" className="flex-1" key={panels.join('-')}>
        {panels.map((id, i) => (
          <PanelWrapper key={id} id={id} index={i} total={panels.length} defaultSize={panelSize}>
            {id === 'problem' && (
              <div className="flex flex-col h-full bg-gray-950">
                <div className="flex h-9 items-center justify-between border-b border-gray-800 px-4">
                  <span className="text-xs font-medium text-gray-400">Problem Statement</span>
                  <button
                    onClick={() => setProblemPreview(!problemPreview)}
                    className="flex items-center gap-1 rounded px-1.5 py-0.5 text-xs text-gray-500 transition-colors hover:bg-gray-800 hover:text-gray-300"
                  >
                    {problemPreview ? <Pencil className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                    {problemPreview ? 'Edit' : 'Preview'}
                  </button>
                </div>
                {problemPreview ? (
                  <div className="flex-1 overflow-y-auto p-4">
                    {problem ? (
                      <MarkdownViewer content={problem} />
                    ) : (
                      <div className="flex items-center justify-center h-full text-sm text-gray-600">
                        Nothing to preview.
                      </div>
                    )}
                  </div>
                ) : (
                  <textarea
                    value={problem}
                    onChange={handleProblemChange}
                    placeholder="Paste your problem statement here (supports Markdown)..."
                    className="flex-1 resize-none bg-transparent p-4 text-sm text-gray-200 placeholder-gray-600 focus:outline-none font-mono leading-relaxed"
                  />
                )}
              </div>
            )}
            {id === 'code' && (
              <PanelGroup orientation="vertical">
                <Panel defaultSize={hasRun ? 60 : 85} minSize={30}>
                  <CodeEditor
                    code={code}
                    language={language}
                    onChange={handleCodeChange}
                    onMount={(editor) => { editorRef.current = editor; }}
                    onValidate={handleValidation}
                    onRun={handleRun}
                    errorLine={errorLine}
                  />
                </Panel>
                <PanelResizeHandle className="group relative flex h-2 items-center justify-center bg-gray-900 hover:bg-gray-800 transition-colors">
                  <div className="h-0.5 w-8 rounded-full bg-gray-700 group-hover:bg-gray-500 transition-colors" />
                </PanelResizeHandle>
                <Panel defaultSize={hasRun ? 40 : 15} minSize={10}>
                  <div className="flex flex-col h-full overflow-y-auto bg-gray-900">
                    <div className="flex h-9 items-center justify-between border-b border-gray-800 px-4">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => setBottomTab('output')}
                          className={`rounded px-2 py-1 text-xs font-medium transition-colors ${
                            bottomTab === 'output' ? 'bg-gray-800 text-gray-200' : 'text-gray-500 hover:text-gray-300'
                          }`}
                        >
                          Output
                          {hasRun && execTimeMs > 0 && (
                            <span className="ml-1.5 text-gray-500">
                              {formatTime(execTimeMs)}
                            </span>
                          )}
                        </button>
                        <button
                          onClick={() => setBottomTab('problems')}
                          className={`flex items-center gap-1 rounded px-2 py-1 text-xs font-medium transition-colors ${
                            bottomTab === 'problems'
                              ? 'bg-gray-800 text-gray-200'
                              : markers.length > 0 ? 'text-yellow-400 hover:text-yellow-300' : 'text-gray-500 hover:text-gray-300'
                          }`}
                        >
                          Problems
                          {markers.length > 0 && (
                            <span className={`rounded-full px-1.5 text-[10px] font-bold ${
                              bottomTab === 'problems' ? 'bg-yellow-500/20 text-yellow-300' : 'bg-yellow-500/20 text-yellow-400'
                            }`}>
                              {markers.length}
                            </span>
                          )}
                        </button>
                      </div>
                      {bottomTab === 'output' && (output || errors) && (
                        <button
                          onClick={handleCopy}
                          className="flex items-center gap-1 rounded px-1.5 py-0.5 text-xs text-gray-500 transition-colors hover:bg-gray-800 hover:text-gray-300"
                        >
                          {copied ? <Check className="h-3 w-3 text-green-400" /> : <Copy className="h-3 w-3" />}
                          {copied ? 'Copied' : 'Copy'}
                        </button>
                      )}
                    </div>

                    {bottomTab === 'output' && (
                      <div className="p-4 font-mono text-xs">
                        {output && (
                          <pre className="whitespace-pre-wrap rounded-lg bg-gray-950 p-3 text-gray-300">
                            {output}
                          </pre>
                        )}
                        {errors && (
                          <pre className="mt-2 whitespace-pre-wrap rounded-lg bg-red-500/10 p-3 text-red-400">
                            {errors}
                          </pre>
                        )}
                        {!output && !errors && (
                          <div className="flex items-center justify-center py-8 text-sm text-gray-600">
                            Click "Run" to execute your code.
                          </div>
                        )}
                      </div>
                    )}

                    {bottomTab === 'problems' && (
                      <div className="p-4">
                        {markers.length === 0 ? (
                          <div className="flex items-center justify-center py-8 text-sm text-gray-600">
                            No problems detected.
                          </div>
                        ) : (
                          <div className="space-y-1.5">
                            {markers.map((m: any, i: number) => (
                              <div
                                key={i}
                                className="flex items-start gap-2 rounded-lg border border-yellow-500/20 bg-yellow-500/5 px-3 py-2 cursor-pointer hover:bg-yellow-500/10 transition-colors"
                                onClick={() => {
                                  editorRef.current?.revealLineInCenter(m.startLineNumber);
                                  editorRef.current?.setPosition({ lineNumber: m.startLineNumber, column: m.startColumn });
                                  editorRef.current?.focus();
                                }}
                              >
                                <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0 text-yellow-400 mt-0.5" />
                                <div className="text-xs">
                                  <span className="text-yellow-500 font-mono">Ln {m.startLineNumber}, Col {m.startColumn}</span>
                                  <span className="text-gray-400 ml-2">{m.message}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </Panel>
              </PanelGroup>
            )}
            {id === 'diagram' && (
              <DiagramEditor problemId="playground" />
            )}
          </PanelWrapper>
        ))}
      </PanelGroup>
    </div>
  );
}

/** Wraps a panel with an optional resize handle before it */
function PanelWrapper({ id, index, total, defaultSize, children }: {
  id: string; index: number; total: number; defaultSize: number; children: React.ReactNode;
}) {
  return (
    <>
      {index > 0 && (
        <PanelResizeHandle className="group flex w-2 items-center justify-center bg-gray-900 transition-colors hover:bg-gray-700">
          <GripVertical className="h-4 w-4 text-gray-600 group-hover:text-gray-400" />
        </PanelResizeHandle>
      )}
      <Panel defaultSize={defaultSize} minSize={15}>
        {children}
      </Panel>
    </>
  );
}
