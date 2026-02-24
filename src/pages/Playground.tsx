import { useState, useCallback, useRef } from 'react';
import Editor from '@monaco-editor/react';
import { Panel, Group as PanelGroup, Separator as PanelResizeHandle } from 'react-resizable-panels';
import DiagramEditor from '../components/DiagramEditor';
import { Code2, PenTool, GripVertical } from 'lucide-react';
import type { Language } from '../types';

const STORAGE_KEY = 'playground-code';
const LANG_KEY = 'playground-language';

export default function Playground() {
  const [language, setLanguage] = useState<Language>(
    () => (localStorage.getItem(LANG_KEY) as Language) || 'javascript'
  );
  const [code, setCode] = useState(() => localStorage.getItem(STORAGE_KEY) || '');
  const saveTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

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

  const langBtn = (active: boolean) =>
    `px-2 py-1 rounded text-xs font-medium transition-colors ${
      active ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-gray-200'
    }`;

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col">
      {/* Toolbar */}
      <div className="flex items-center gap-3 border-b border-gray-800 bg-gray-950 px-4 py-2">
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

      {/* Side-by-side panels */}
      <PanelGroup orientation="horizontal" className="flex-1">
        <Panel defaultSize={50} minSize={25}>
          <Editor
            height="100%"
            language={language}
            theme="vs-dark"
            value={code}
            onChange={handleCodeChange}
            options={{
              fontSize: 14,
              minimap: { enabled: false },
              wordWrap: 'on',
              lineNumbers: 'on',
              scrollBeyondLastLine: false,
              padding: { top: 12 },
            }}
          />
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
