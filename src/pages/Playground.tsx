import { useState, useCallback, useRef } from 'react';
import { Panel, Group as PanelGroup, Separator as PanelResizeHandle } from 'react-resizable-panels';
import { compressToEncodedURIComponent, decompressFromEncodedURIComponent } from 'lz-string';
import DiagramEditor from '../components/DiagramEditor';
import CodeEditor from '../components/CodeEditor';
import { useCodeExecution } from '../hooks/useCodeExecution';
import { Code2, PenTool, GripVertical, Play, Loader2, Copy, Check, Share2, Clock } from 'lucide-react';
import type { Language } from '../types';

const STORAGE_KEY = 'playground-code';
const LANG_KEY = 'playground-language';

function loadFromHash(): { code: string; lang: Language } | null {
  const hash = window.location.hash.slice(1);
  if (!hash) return null;
  try {
    const json = decompressFromEncodedURIComponent(hash);
    if (!json) return null;
    const parsed = JSON.parse(json);
    return { code: parsed.c || '', lang: parsed.l || 'javascript' };
  } catch {
    return null;
  }
}

export default function Playground() {
  const shared = loadFromHash();

  const [language, setLanguage] = useState<Language>(
    () => shared?.lang || (localStorage.getItem(LANG_KEY) as Language) || 'javascript'
  );
  const [code, setCode] = useState(() => shared?.code || localStorage.getItem(STORAGE_KEY) || '');
  const saveTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const editorRef = useRef<any>(null);
  const { execute, output, errors, isRunning, execTimeMs } = useCodeExecution();
  const [copied, setCopied] = useState(false);
  const [shared_, setShared] = useState(false);
  const [hasRun, setHasRun] = useState(false);

  const handleCodeChange = useCallback((value: string | undefined) => {
    const v = value || '';
    setCode(v);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => localStorage.setItem(STORAGE_KEY, v), 800);
  }, []);

  const handleLanguageChange = (lang: Language) => {
    setLanguage(lang);
    localStorage.setItem(LANG_KEY, lang);
  };

  const handleRun = useCallback(() => {
    if (isRunning) return;
    setHasRun(true);
    execute(code, [], language);
  }, [code, isRunning, execute, language]);

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

  const langBtn = (active: boolean) =>
    `px-2 py-1 rounded text-xs font-medium transition-colors ${
      active ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-gray-200'
    }`;

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col">
      {/* Toolbar */}
      <div className="flex items-center justify-between border-b border-gray-800 bg-gray-950 px-4 py-2">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs font-medium text-gray-400">
            <Code2 className="h-3.5 w-3.5" />
            <span>Code</span>
          </div>
          <div className="flex items-center gap-1 rounded-lg bg-gray-800 p-0.5">
            <button onClick={() => handleLanguageChange('javascript')} className={langBtn(language === 'javascript')}>JS</button>
            <button onClick={() => handleLanguageChange('typescript')} className={langBtn(language === 'typescript')}>TS</button>
          </div>
          <div className="mx-2 h-4 w-px bg-gray-800" />
          <div className="flex items-center gap-1.5 text-xs font-medium text-gray-400">
            <PenTool className="h-3.5 w-3.5" />
            <span>Excalidraw</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleShare}
            className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-gray-400 transition-colors hover:bg-gray-800 hover:text-gray-200"
          >
            {shared_ ? <Check className="h-3.5 w-3.5 text-green-400" /> : <Share2 className="h-3.5 w-3.5" />}
            {shared_ ? 'Link copied!' : 'Share'}
          </button>
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
        </div>
      </div>

      {/* Side-by-side panels */}
      <PanelGroup orientation="horizontal" className="flex-1">
        <Panel defaultSize={50} minSize={25}>
          <PanelGroup orientation="vertical">
            <Panel defaultSize={hasRun ? 60 : 85} minSize={30}>
              <CodeEditor
                code={code}
                language={language}
                onChange={handleCodeChange}
                onMount={(editor) => { editorRef.current = editor; }}
                onRun={handleRun}
              />
            </Panel>
            <PanelResizeHandle className="group relative flex h-2 items-center justify-center bg-gray-900 hover:bg-gray-800 transition-colors">
              <div className="h-0.5 w-8 rounded-full bg-gray-700 group-hover:bg-gray-500 transition-colors" />
            </PanelResizeHandle>
            <Panel defaultSize={hasRun ? 40 : 15} minSize={10}>
              <div className="flex flex-col h-full overflow-y-auto bg-gray-900">
                <div className="flex h-9 items-center justify-between border-b border-gray-800 px-4">
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-medium text-gray-400">Output</span>
                    {hasRun && execTimeMs > 0 && (
                      <span className="flex items-center gap-1 text-xs text-gray-500">
                        <Clock className="h-3 w-3" />
                        {formatTime(execTimeMs)}
                      </span>
                    )}
                  </div>
                  {(output || errors) && (
                    <button
                      onClick={handleCopy}
                      className="flex items-center gap-1 rounded px-1.5 py-0.5 text-xs text-gray-500 transition-colors hover:bg-gray-800 hover:text-gray-300"
                    >
                      {copied ? <Check className="h-3 w-3 text-green-400" /> : <Copy className="h-3 w-3" />}
                      {copied ? 'Copied' : 'Copy'}
                    </button>
                  )}
                </div>
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
              </div>
            </Panel>
          </PanelGroup>
        </Panel>
        <PanelResizeHandle className="group flex w-2 items-center justify-center bg-gray-900 transition-colors hover:bg-gray-700">
          <GripVertical className="h-4 w-4 text-gray-600 group-hover:text-gray-400" />
        </PanelResizeHandle>
        <Panel defaultSize={50} minSize={25}>
          <DiagramEditor problemId="playground" />
        </Panel>
      </PanelGroup>
    </div>
  );
}
