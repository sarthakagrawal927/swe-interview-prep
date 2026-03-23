import { useRef, useCallback, useEffect } from 'react';
import Editor from '@monaco-editor/react';
import * as prettier from 'prettier/standalone';
import * as parserBabel from 'prettier/plugins/babel';
import * as parserEstree from 'prettier/plugins/estree';
import * as parserTS from 'prettier/plugins/typescript';
import type { Language } from '../types';

interface CodeEditorProps {
  code: string;
  language: Language;
  onChange: (value: string | undefined) => void;
  onMount?: (editor: any) => void;
  onValidate?: (markers: any[]) => void;
  onRun?: () => void;
  fontSize?: number;
}

export function formatCode(code: string, language: Language): Promise<string> {
  return prettier.format(code, {
    parser: language === 'typescript' ? 'typescript' : 'babel',
    plugins: [parserBabel, parserEstree, parserTS],
    singleQuote: true,
    trailingComma: 'all',
    tabWidth: 2,
    semi: true,
  });
}

export default function CodeEditor({
  code,
  language,
  onChange,
  onMount,
  onValidate,
  onRun,
  fontSize = 14,
}: CodeEditorProps) {
  const editorRef = useRef<any>(null);
  const runRef = useRef<(() => void) | undefined>(undefined);
  runRef.current = onRun;

  const handleFormat = useCallback(async () => {
    const editor = editorRef.current;
    if (!editor) return;
    try {
      const formatted = await formatCode(editor.getValue(), language);
      const pos = editor.getPosition();
      editor.setValue(formatted);
      if (pos) editor.setPosition(pos);
    } catch {
      // formatting error — ignore silently
    }
  }, [language]);

  const handleMount = useCallback((editor: any) => {
    editorRef.current = editor;
    const monaco = (window as any).monaco;
    if (monaco) {
      editor.addAction({
        id: 'run-code',
        label: 'Run Code',
        keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter],
        run: () => runRef.current?.(),
      });
      editor.addAction({
        id: 'format-code',
        label: 'Format Code',
        keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyF],
        run: () => handleFormat(),
      });
    }
    onMount?.(editor);
  }, [onMount, handleFormat]);

  // Expose format on the editor instance for toolbar buttons
  useEffect(() => {
    if (editorRef.current) {
      (editorRef.current as any).__prettierFormat = handleFormat;
    }
  }, [handleFormat]);

  return (
    <Editor
      height="100%"
      language={language}
      theme="vs-dark"
      value={code}
      onChange={onChange}
      onValidate={onValidate}
      onMount={handleMount}
      options={{
        minimap: { enabled: false },
        fontSize,
        lineNumbers: 'on',
        scrollBeyondLastLine: false,
        padding: { top: 12 },
        automaticLayout: true,
        tabSize: 2,
        wordWrap: 'on',
      }}
    />
  );
}
