import { useState, useCallback, useRef } from 'react';
import Editor from '@monaco-editor/react';
import { Panel, Group as PanelGroup, Separator as PanelResizeHandle } from 'react-resizable-panels';
import DiagramEditor from '../components/DiagramEditor';
import { useCodeExecution } from '../hooks/useCodeExecution';
import { Code2, PenTool, GripVertical, Play, Loader2 } from 'lucide-react';
import type { Language } from '../types';

const STORAGE_KEY = 'playground-code';
const LANG_KEY = 'playground-language';

export default function Playground() {
  const [language, setLanguage] = useState<Language>(
    () => (localStorage.getItem(LANG_KEY) as Language) || 'javascript'
  );
  const [code, setCode] = useState(() => localStorage.getItem(STORAGE_KEY) || '');
  const saveTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const editorRef = useRef<any>(null);
  const { execute, output, errors, isRunning } = useCodeExecution();

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
    execute(code, [], language);
  }, [code, isRunning, execute, language]);

  const handleFormat = () => {
    editorRef.current?.getAction('editor.action.formatDocument')?.run();
  };

  const handleEditorMount = (editor: any) => {
    editorRef.current = editor;
  };

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
            onClick={handleFormat}
            className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-gray-400 transition-colors hover:bg-gray-800 hover:text-gray-200"
          >
            <Code2 className="h-3.5 w-3.5" />
            Format
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

      {/* Side-by-side panels */}
      <PanelGroup orientation="horizontal" className="flex-1">
        <Panel defaultSize={50} minSize={25}>
          <PanelGroup orientation="vertical">
            <Panel defaultSize={70} minSize={30}>
              <Editor
                height="100%"
                language={language}
                theme="vs-dark"
                value={code}
                onChange={handleCodeChange}
                onMount={handleEditorMount}
                options={{
                  fontSize: 14,
                  minimap: { enabled: false },
                  wordWrap: 'on',
                  lineNumbers: 'on',
                  scrollBeyondLastLine: false,
                  padding: { top: 12 },
                  automaticLayout: true,
                  tabSize: 2,
                }}
              />
            </Panel>
            <PanelResizeHandle className="group relative flex h-2 items-center justify-center bg-gray-900 hover:bg-gray-800 transition-colors">
              <div className="h-0.5 w-8 rounded-full bg-gray-700 group-hover:bg-gray-500 transition-colors" />
            </PanelResizeHandle>
            <Panel defaultSize={30} minSize={10}>
              <div className="flex flex-col h-full overflow-y-auto bg-gray-900">
                <div className="flex h-9 items-center border-b border-gray-800 px-4">
                  <span className="text-xs font-medium text-gray-400">Output</span>
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
