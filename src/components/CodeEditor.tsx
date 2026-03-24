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
  errorLine?: number | null;
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
  errorLine,
}: CodeEditorProps) {
  const editorRef = useRef<any>(null);
  const runRef = useRef<(() => void) | undefined>(undefined);
  const decorationsRef = useRef<any>(null);
  runRef.current = onRun;

  const handleFormat = useCallback(async () => {
    const editor = editorRef.current;
    if (!editor) return;
    if (language === 'go') {
      // Prettier doesn't support Go — use Monaco's built-in formatter
      editor.getAction('editor.action.formatDocument')?.run();
      return;
    }
    try {
      const formatted = await formatCode(editor.getValue(), language);
      const pos = editor.getPosition();
      editor.setValue(formatted);
      if (pos) editor.setPosition(pos);
    } catch {
      // formatting error — ignore silently
    }
  }, [language]);

  // Cmd+S = format + run
  const handleSave = useCallback(async () => {
    await handleFormat();
    runRef.current?.();
  }, [handleFormat]);

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
      editor.addAction({
        id: 'save-format-run',
        label: 'Format & Run',
        keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS],
        run: () => handleSave(),
      });
    }
    onMount?.(editor);
  }, [onMount, handleFormat, handleSave]);

  // Expose format on the editor instance for toolbar buttons
  useEffect(() => {
    if (editorRef.current) {
      (editorRef.current as any).__prettierFormat = handleFormat;
    }
  }, [handleFormat]);

  // Error line highlighting
  useEffect(() => {
    const editor = editorRef.current;
    const monaco = (window as any).monaco;
    if (!editor || !monaco) return;

    if (errorLine && errorLine > 0) {
      decorationsRef.current = editor.createDecorationsCollection([
        {
          range: new monaco.Range(errorLine, 1, errorLine, 1),
          options: {
            isWholeLine: true,
            className: 'bg-red-500/15',
            glyphMarginClassName: 'text-red-400',
            overviewRuler: { color: '#ef4444', position: 1 },
          },
        },
      ]);
    } else if (decorationsRef.current) {
      decorationsRef.current.clear();
      decorationsRef.current = null;
    }
  }, [errorLine]);

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
        // Autocomplete
        quickSuggestions: true,
        suggestOnTriggerCharacters: true,
        acceptSuggestionOnEnter: 'on',
        parameterHints: { enabled: true },
        // Bracket pair colorization
        bracketPairColorization: { enabled: true },
        matchBrackets: 'always',
        // Sticky scroll
        stickyScroll: { enabled: true },
        // Smooth cursor
        cursorSmoothCaretAnimation: 'on',
        cursorBlinking: 'smooth',
        // Linked editing (rename tag pairs)
        linkedEditing: true,
        // Auto-close & surround
        autoClosingBrackets: 'always',
        autoClosingQuotes: 'always',
        autoSurround: 'languageDefined',
        // Guides
        guides: {
          bracketPairs: true,
          indentation: true,
        },
        // Folding
        folding: true,
        foldingStrategy: 'indentation',
        showFoldingControls: 'mouseover',
        // Smooth scrolling
        smoothScrolling: true,
      }}
    />
  );
}
