'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import Editor, { type OnMount } from '@monaco-editor/react';
import { useTheme } from '@/components/ThemeProvider';
import {
  Play, Loader2, Trash2, BrainCircuit, CheckCircle2, AlertCircle,
  Sparkles, Keyboard, Copy, Check, GripVertical, Lightbulb
} from 'lucide-react';

/* ── Language map ─────────────────────────────────────────────── */
const MONACO_LANG: Record<string, string> = {
  python3:  'python',
  cpp17:    'cpp',
  java:     'java',
  nodejs:   'javascript',
  sql:      'sql',
};

/* ── Monaco theme names ───────────────────────────────────────── */
const DARK_THEME  = 'collabcode-dark';
const LIGHT_THEME = 'collabcode-solarized';

/* ── Register both themes once ────────────────────────────────── */
let themesRegistered = false;
function registerThemes(monaco: any) {
  if (themesRegistered) return;
  themesRegistered = true;

  /* Dark theme */
  monaco.editor.defineTheme(DARK_THEME, {
    base: 'vs-dark',
    inherit: true,
    rules: [
      { token: 'comment',   foreground: '6b7db3', fontStyle: 'italic' },
      { token: 'keyword',   foreground: 'c792ea' },
      { token: 'string',    foreground: 'c3e88d' },
      { token: 'number',    foreground: 'f78c6c' },
      { token: 'type',      foreground: '82aaff' },
      { token: 'function',  foreground: '82aaff' },
      { token: 'variable',  foreground: 'eeffff' },
      { token: 'delimiter', foreground: '89ddff' },
    ],
    colors: {
      'editor.background':                '#0d111a',
      'editor.foreground':                '#cdd6f4',
      'editorLineNumber.foreground':      '#3a4157',
      'editorLineNumber.activeForeground':'#7c87aa',
      'editor.selectionBackground':       '#3b82f626',
      'editor.inactiveSelectionBackground':'#3b82f614',
      'editor.lineHighlightBackground':   '#161c2a',
      'editor.lineHighlightBorder':       '#1e2740',
      'editorCursor.foreground':          '#82aaff',
      'editorIndentGuide.background':     '#1e2740',
      'editorIndentGuide.activeBackground':'#3b4561',
      'editorBracketMatch.background':    '#3b82f620',
      'editorBracketMatch.border':        '#82aaff60',
      'scrollbar.shadow':                 '#00000000',
      'scrollbarSlider.background':       '#3b456140',
      'scrollbarSlider.hoverBackground':  '#3b456170',
      'scrollbarSlider.activeBackground': '#3b4561aa',
      'editor.findMatchBackground':       '#f78c6c40',
      'editor.findMatchHighlightBackground':'#c792ea20',
    },
  });

  /* Light / Solarized theme */
  monaco.editor.defineTheme(LIGHT_THEME, {
    base: 'vs',
    inherit: true,
    rules: [
      { token: 'comment',   foreground: '93a1a1', fontStyle: 'italic' },
      { token: 'keyword',   foreground: '859900', fontStyle: 'bold' },
      { token: 'string',    foreground: '2aa198' },
      { token: 'number',    foreground: 'd33682' },
      { token: 'type',      foreground: '268bd2' },
      { token: 'function',  foreground: '268bd2' },
      { token: 'variable',  foreground: '657b83' },
      { token: 'delimiter', foreground: '2aa198' },
      { token: 'operator',  foreground: '657b83' },
    ],
    colors: {
      'editor.background':                '#fdf6e3',
      'editor.foreground':                '#657b83',
      'editorLineNumber.foreground':      '#b5b5a0',
      'editorLineNumber.activeForeground':'#839496',
      'editor.selectionBackground':       '#eee8d5',
      'editor.inactiveSelectionBackground':'#eee8d5aa',
      'editor.lineHighlightBackground':   '#eee8d588',
      'editor.lineHighlightBorder':       '#e0d9c8',
      'editorCursor.foreground':          '#268bd2',
      'editorIndentGuide.background':     '#ddd8c8',
      'editorIndentGuide.activeBackground':'#c5bfae',
      'editorBracketMatch.background':    '#268bd220',
      'editorBracketMatch.border':        '#268bd280',
      'scrollbar.shadow':                 '#00000000',
      'scrollbarSlider.background':       '#c5bfae50',
      'scrollbarSlider.hoverBackground':  '#c5bfae99',
      'scrollbarSlider.activeBackground': '#c5bfaecc',
      'editor.findMatchBackground':       '#d3368240',
      'editor.findMatchHighlightBackground':'#85990020',
    },
  });
}

/* ── Default starter code ─────────────────────────────────────── */
const DEFAULT_CODE: Record<string, string> = {
  python3: 'print("Hello from CollabCode!")\nfor i in range(5):\n    print(f"Counting: {i}")',
  cpp17:   '#include <iostream>\n\nint main() {\n    std::cout << "Hello from C++17!" << std::endl;\n    return 0;\n}',
  java:    'public class MyClass {\n    public static void main(String args[]) {\n        System.out.println("Hello from Java!");\n    }\n}',
  nodejs:  'console.log("Hello from Node.js!");\nfor (let i = 0; i < 5; i++) {\n    console.log(`Counting: ${i}`);\n}',
  sql:     'SELECT 1 + 1 AS result;',
};

/* ── Props ────────────────────────────────────────────────────── */
interface CodeCellProps {
  id: string;
  initialCode?: string;
  initialLanguage?: string;
  initialStdin?: string;
  injectedStdin?: string;
  injectedCode?: string;
  onDelete?: () => void;
  onCodeChange?: (code: string) => void;
  onLanguageChange?: (language: string) => void;
  onStdinChange?: (stdin: string) => void;
  onAiHelper?: () => void;
  onExecutionComplete?: (success: boolean) => void;
  onFocus?: () => void;
  runAllTrigger?: number;
  onDragStart?: (e: React.DragEvent) => void;
  onDragEnd?: (e: React.DragEvent) => void;
  onDragOver?: (e: React.DragEvent) => void;
  onDrop?: (e: React.DragEvent) => void;
  isDragOver?: boolean;
}

/* ── Component ────────────────────────────────────────────────── */
export default function CodeCell({
  id, initialCode = '', initialLanguage = 'python3', initialStdin = '',
  injectedStdin,
  injectedCode,
  onDelete, onCodeChange, onLanguageChange, onStdinChange,
  onAiHelper, onExecutionComplete, onFocus, runAllTrigger,
  onDragStart, onDragEnd, onDragOver, onDrop, isDragOver
}: CodeCellProps) {
  const { isDark }                          = useTheme();

  const [language, setLanguage]             = useState(initialLanguage);
  const [codeContent, setCodeContent]       = useState(initialCode || DEFAULT_CODE[initialLanguage] || '');
  const [isRunning, setIsRunning]           = useState(false);
  const [executionResult, setExecutionResult] = useState<any>(null);
  const [isStdinOpen, setIsStdinOpen]       = useState(!!initialStdin);
  const [stdinContent, setStdinContent]     = useState(initialStdin);
  const [copiedStdout, setCopiedStdout]     = useState(false);
  const [copiedStderr, setCopiedStderr]     = useState(false);
  const [dataInjected, setDataInjected]     = useState(false);
  const [intellisenseOn, setIntellisenseOn] = useState(true);

  const editorRef  = useRef<any>(null);
  const monacoRef  = useRef<any>(null);
  const runRef     = useRef<() => void>(() => {});
  const codeRef    = useRef(codeContent);

  /* keep codeRef in sync */
  useEffect(() => { codeRef.current = codeContent; }, [codeContent]);

  /* ── Dynamic Monaco theme when app theme changes ─────────────*/
  useEffect(() => {
    if (monacoRef.current) {
      monacoRef.current.editor.setTheme(isDark ? DARK_THEME : LIGHT_THEME);
    }
  }, [isDark]);

  /* ── Dynamic IntelliSense toggle ────────────────────────────*/
  useEffect(() => {
    if (editorRef.current) {
      editorRef.current.updateOptions({
        quickSuggestions:   intellisenseOn
          ? { other: true, comments: false, strings: false }
          : false,
        suggestOnTriggerCharacters: intellisenseOn,
        parameterHints:     { enabled: intellisenseOn },
        wordBasedSuggestions: intellisenseOn ? 'matchingDocuments' : 'off',
        suggest:            { showKeywords: intellisenseOn, showSnippets: intellisenseOn },
        inlineSuggest:      { enabled: intellisenseOn },
      });
    }
  }, [intellisenseOn]);

  /* ── run-all trigger ──────────────────────────────────────────*/
  useEffect(() => {
    if (runAllTrigger !== undefined && runAllTrigger > 0) handleRun();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runAllTrigger]);

  /* ── injected code (virtual file) – prepend to Monaco editor ──────*/
  useEffect(() => {
    if (!injectedCode) return;
    const clean = injectedCode.split('\0tick:')[0];
    if (!clean) return;
    if (editorRef.current) {
      const current = editorRef.current.getValue();
      editorRef.current.setValue(clean + current);
      // Move cursor to end of injected block (after the divider line)
      const newLines = clean.split('\n').length;
      editorRef.current.setPosition({ lineNumber: newLines + 1, column: 1 });
      editorRef.current.focus();
    } else {
      // Editor not mounted yet — patch into state so defaultValue picks it up
      setCodeContent(prev => clean + prev);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [injectedCode]);

  /* ── injected stdin ───────────────────────────────────────────*/
  useEffect(() => {
    if (injectedStdin !== undefined && injectedStdin !== '') {
      const clean = injectedStdin.split('\0tick:')[0];
      setStdinContent(clean);
      setIsStdinOpen(true);
      setDataInjected(true);
      onStdinChange?.(clean);
      setTimeout(() => setDataInjected(false), 3000);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [injectedStdin]);

  /* ── language change → update Monaco model language ──────────*/
  useEffect(() => {
    if (editorRef.current && monacoRef.current) {
      const model = editorRef.current.getModel();
      if (model) {
        monacoRef.current.editor.setModelLanguage(model, MONACO_LANG[language] || 'plaintext');
      }
    }
  }, [language]);

  /* ── handlers ────────────────────────────────────────────────*/
  const handleLanguageChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newLang = e.target.value;
    setLanguage(newLang);
    onLanguageChange?.(newLang);
  };

  const handleRun = useCallback(async () => {
    if (isRunning) return;
    setIsRunning(true);
    setExecutionResult(null);
    const startTime = performance.now();

    try {
      const res = await fetch('/api/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: codeRef.current, language, stdin: stdinContent }),
      });

      const endTime = performance.now();
      const elapsedMs = endTime - startTime;

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP Error ${res.status}`);
      }

      const data = await res.json();
      data.elapsedTimeMs = elapsedMs;
      setExecutionResult(data);
      if (data.status === 'Accepted' && !data.error && !data.stderr) {
        onExecutionComplete?.(true);
      } else {
        onExecutionComplete?.(false);
      }
    } catch (err: any) {
      const endTime = performance.now();
      setExecutionResult({
        error: err.message || 'Network error occurred.',
        elapsedTimeMs: endTime - startTime,
      });
      onExecutionComplete?.(false);
    } finally {
      setIsRunning(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [language, stdinContent]);

  /* keep runRef fresh */
  useEffect(() => { runRef.current = handleRun; }, [handleRun]);

  /* ── Monaco mount ────────────────────────────────────────────*/
  const handleEditorMount: OnMount = (editor, monaco) => {
    editorRef.current  = editor;
    monacoRef.current  = monaco;
    registerThemes(monaco);
    // Apply correct theme based on current app theme
    monaco.editor.setTheme(isDark ? DARK_THEME : LIGHT_THEME);

    // Ctrl+Enter / Cmd+Enter → run
    editor.addCommand(
      monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter,
      () => runRef.current()
    );

    editor.updateOptions({ automaticLayout: true });
  };

  /* ── editor height (grows with content, capped) ──────────────*/
  const lineCount    = codeContent.split('\n').length;
  const editorHeight = Math.min(Math.max(lineCount * 21 + 40, 160), 560);

  /* ── editor bg matches theme ────────────────────────────────*/
  const editorBg = isDark ? '#0d111a' : '#fdf6e3';

  /* ── icon button helper ──────────────────────────────────────*/
  const iconBtn = (
    icon: React.ReactNode,
    label: string,
    onClick: () => void,
    colorClass = 'hover:bg-primary/10 hover:text-primary',
    extraClass = '',
    disabled = false,
    dataAttr: Record<string, string> = {}
  ) => (
    <button
      onClick={onClick}
      disabled={disabled}
      {...dataAttr}
      title={label}
      className={`group relative flex items-center justify-center h-7 rounded-lg bg-transparent ${colorClass} text-on-surface-variant transition-all duration-200 overflow-hidden px-2 max-w-[28px] hover:max-w-[140px] hover:px-3 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-on-surface-variant shrink-0 border border-transparent hover:border-outline-variant/30 ${extraClass}`}
    >
      <span className="shrink-0">{icon}</span>
      <span className="w-0 opacity-0 group-hover:w-auto group-hover:opacity-100 transition-all duration-200 whitespace-nowrap overflow-hidden ml-0 group-hover:ml-1.5 text-[10px] font-bold uppercase tracking-wide">
        {label}
      </span>
    </button>
  );

  return (
    <div
      className={`collabcode-cell flex flex-col rounded-xl border bg-surface-container overflow-hidden shadow-xl ring-1 ring-white/5 transition-all duration-150 ${
        isDragOver
          ? 'border-primary/60 ring-2 ring-primary/30 scale-[1.01]'
          : 'border-outline-variant'
      }`}
      onClick={onFocus}
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      {/* ── Cell Header ────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-3 h-11 bg-surface-container-high border-b border-outline-variant/30">
        <div className="flex items-center gap-2">
          {/* Drag Handle */}
          <div
            draggable
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
            className="cursor-grab active:cursor-grabbing text-outline hover:text-primary transition-colors p-1 rounded"
            title="Drag to reorder"
          >
            <GripVertical size={15} />
          </div>

          <span className="text-outline font-code-bold text-[11px] select-none">[{id}]</span>

          {/* Language Dropdown */}
          <select
            value={language}
            onChange={handleLanguageChange}
            className="bg-[#1b263b] border border-outline-variant rounded-lg px-2 py-1 text-[11px] font-semibold text-white hover:border-primary/55 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/25 transition-all cursor-pointer"
          >
            <option value="python3" className="bg-[#1b263b] text-white">Python 3</option>
            <option value="cpp17"   className="bg-[#1b263b] text-white">C++ 17</option>
            <option value="java"    className="bg-[#1b263b] text-white">Java</option>
            <option value="nodejs"  className="bg-[#1b263b] text-white">Node.js</option>
            <option value="sql"     className="bg-[#1b263b] text-white">SQL / MySQL</option>
          </select>

          {/* Data-injected badge */}
          {dataInjected && (
            <span className="flex items-center gap-1 text-[9px] font-bold text-secondary bg-secondary/10 border border-secondary/20 rounded-full px-2 py-0.5 animate-pulse select-none">
              📎 Data injected
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          {/* IntelliSense toggle */}
          <button
            onClick={() => setIntellisenseOn(v => !v)}
            title={intellisenseOn ? 'IntelliSense ON — click to disable' : 'IntelliSense OFF — click to enable'}
            className={`group relative flex items-center justify-center h-7 rounded-lg transition-all duration-200 overflow-hidden px-2 max-w-[28px] hover:max-w-[140px] hover:px-3 shrink-0 border ${
              intellisenseOn
                ? 'bg-primary/10 text-primary border-primary/20 hover:bg-primary/20'
                : 'bg-transparent text-outline border-transparent hover:border-outline-variant/30 hover:bg-surface-variant opacity-50 hover:opacity-80'
            }`}
          >
            <Lightbulb size={14} className={`shrink-0 transition-all ${intellisenseOn ? 'fill-primary/20' : ''}`} />
            <span className="w-0 opacity-0 group-hover:w-auto group-hover:opacity-100 transition-all duration-200 whitespace-nowrap overflow-hidden ml-0 group-hover:ml-1.5 text-[10px] font-bold uppercase tracking-wide">
              {intellisenseOn ? 'IntelliSense On' : 'IntelliSense Off'}
            </span>
          </button>

          {/* AI Helper */}
          {iconBtn(
            <Sparkles size={14} />,
            'AI Helper',
            () => onAiHelper?.(),
            'hover:bg-primary/10 hover:text-primary'
          )}

          {/* Input (stdin) */}
          <button
            onClick={() => setIsStdinOpen(!isStdinOpen)}
            title="Standard Input"
            className={`group relative flex items-center justify-center h-7 rounded-lg transition-all duration-200 overflow-hidden px-2 max-w-[28px] hover:max-w-[100px] hover:px-3 shrink-0 border ${
              isStdinOpen
                ? 'bg-surface-variant text-on-surface border-outline-variant/60'
                : 'bg-transparent text-on-surface-variant border-transparent hover:border-outline-variant/30 hover:bg-surface-variant'
            }`}
          >
            <Keyboard size={14} className="shrink-0" />
            <span className="w-0 opacity-0 group-hover:w-auto group-hover:opacity-100 transition-all duration-200 whitespace-nowrap overflow-hidden ml-0 group-hover:ml-1.5 text-[10px] font-bold uppercase tracking-wide">
              Input
            </span>
          </button>

          {/* Run */}
          <button
            onClick={handleRun}
            disabled={isRunning}
            data-run-btn="true"
            title={isRunning ? 'Running…' : 'Run (Ctrl+Enter)'}
            className={`group relative flex items-center justify-center h-7 rounded-lg bg-secondary text-on-secondary border border-secondary/25 transition-all duration-200 overflow-hidden px-2.5 max-w-[32px] hover:max-w-[100px] hover:px-3.5 shrink-0 shadow-md shadow-secondary/20 hover:brightness-110 active:scale-95 ${isRunning ? 'opacity-70 cursor-not-allowed' : ''}`}
          >
            {isRunning
              ? <Loader2 size={14} className="animate-spin shrink-0" />
              : <Play size={14} fill="currentColor" className="shrink-0" />}
            <span className="w-0 opacity-0 group-hover:w-auto group-hover:opacity-100 transition-all duration-200 whitespace-nowrap overflow-hidden ml-0 group-hover:ml-1.5 text-[10px] font-bold uppercase tracking-wide">
              {isRunning ? 'Running' : 'Run'}
            </span>
          </button>

          {/* Delete */}
          {onDelete && iconBtn(
            <Trash2 size={14} />,
            'Delete',
            onDelete,
            'hover:bg-error/10 hover:text-error',
            'ml-1'
          )}
        </div>
      </div>

      {/* ── Monaco Editor ──────────────────────────────────────── */}
      <div className="relative transition-colors duration-300" style={{ backgroundColor: editorBg }}>
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/20 to-transparent pointer-events-none z-10" />

        <Editor
          height={editorHeight}
          language={MONACO_LANG[language] || 'plaintext'}
          defaultValue={codeContent}
          theme={isDark ? DARK_THEME : LIGHT_THEME}
          onMount={handleEditorMount}
          onChange={(value) => {
            const newCode = value ?? '';
            setCodeContent(newCode);
            codeRef.current = newCode;
            onCodeChange?.(newCode);
          }}
          loading={
            <div className="flex items-center justify-center gap-2 py-10 text-outline/60">
              <Loader2 size={16} className="animate-spin" />
              <span className="text-[12px] font-mono">Loading editor…</span>
            </div>
          }
          options={{
            fontSize:                     13,
            fontFamily:                   "'JetBrains Mono', 'Fira Code', 'Cascadia Code', 'Consolas', monospace",
            fontLigatures:                true,
            lineHeight:                   21,
            letterSpacing:                0.3,
            padding:                      { top: 16, bottom: 16 },
            minimap:                      { enabled: false },
            scrollBeyondLastLine:         false,
            automaticLayout:              true,
            wordWrap:                     'off',
            tabSize:                      4,
            insertSpaces:                 true,
            renderWhitespace:             'selection',
            renderLineHighlight:          'gutter',
            cursorBlinking:               'smooth',
            cursorSmoothCaretAnimation:   'on',
            smoothScrolling:              true,
            bracketPairColorization:      { enabled: true },
            guides:                       { bracketPairs: true, indentation: true },
            /* IntelliSense — controlled by intellisenseOn state */
            quickSuggestions:             intellisenseOn
              ? { other: true, comments: false, strings: false }
              : false,
            suggestOnTriggerCharacters:   intellisenseOn,
            parameterHints:               { enabled: intellisenseOn },
            wordBasedSuggestions:         intellisenseOn ? 'matchingDocuments' : 'off',
            suggest:                      { showKeywords: intellisenseOn, showSnippets: intellisenseOn },
            inlineSuggest:                { enabled: intellisenseOn },
            folding:                      true,
            foldingHighlight:             true,
            showFoldingControls:          'mouseover',
            overviewRulerLanes:           0,
            hideCursorInOverviewRuler:    true,
            scrollbar: {
              vertical:              'auto',
              horizontal:            'auto',
              verticalScrollbarSize:  6,
              horizontalScrollbarSize: 6,
            },
            lineNumbersMinChars:          3,
          }}
        />
      </div>

      {/* ── Stdin ─────────────────────────────────────────────────*/}
      {isStdinOpen && (
        <div className="bg-surface-container-low border-t border-outline-variant/40 p-3 flex flex-col gap-2">
          <span className="font-ui-label text-[10px] uppercase tracking-wider text-outline font-semibold flex items-center gap-1.5">
            <Keyboard size={12} /> Standard Input (stdin)
          </span>
          <textarea
            value={stdinContent}
            onChange={(e) => { setStdinContent(e.target.value); onStdinChange?.(e.target.value); }}
            placeholder="Type input here (e.g., for Python input() or C++ std::cin)..."
            className="w-full bg-surface-container border border-outline-variant/40 rounded-lg p-2.5 text-[12px] font-console-text text-on-surface focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-all resize-y min-h-[60px]"
            spellCheck={false}
          />
        </div>
      )}

      {/* ── Output Console ────────────────────────────────────────*/}
      <div className="bg-surface-container-lowest border-t border-outline-variant p-4 min-h-[70px]">
        {isRunning ? (
          <div className="flex items-center gap-2">
            <Loader2 size={16} className="text-outline animate-spin" />
            <span className="font-console-text text-outline/80 text-[11px]">Executing via JDoodle…</span>
          </div>
        ) : executionResult ? (
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2 flex-wrap">
                {executionResult.stderr || executionResult.error || executionResult.status !== 'Accepted' ? (
                  <AlertCircle size={15} className="text-error" />
                ) : (
                  <CheckCircle2 size={15} className="text-secondary" />
                )}
                <span className={`font-console-text text-[11px] font-semibold ${executionResult.stderr || executionResult.error || executionResult.status !== 'Accepted' ? 'text-error/80' : 'text-secondary/80'}`}>
                  {executionResult.error ? 'Execution Failed' : (executionResult.status || 'Accepted')}
                </span>
                {executionResult.time !== null && executionResult.time !== undefined && (
                  <span className="text-[10px] text-primary bg-primary/10 px-2 py-0.5 rounded-full font-bold">
                    Response Time: {executionResult.time}s
                  </span>
                )}
              </div>
              <span className="font-ui-label text-[9px] text-outline uppercase tracking-wider">Output</span>
            </div>
            {executionResult.stdout && (
              <div className="flex items-start gap-2">
                <pre className="font-console-text text-[12px] text-on-surface whitespace-pre-wrap mt-1 flex-1">{executionResult.stdout}</pre>
                <button
                  onClick={() => { navigator.clipboard.writeText(executionResult.stdout); setCopiedStdout(true); setTimeout(() => setCopiedStdout(false), 2000); }}
                  className="group relative flex items-center justify-center h-7 rounded-lg bg-surface-container hover:bg-primary/10 text-on-surface-variant hover:text-primary transition-all duration-200 overflow-hidden px-2 max-w-[28px] hover:max-w-[110px] hover:px-3 border border-outline-variant/30 shrink-0 mt-1"
                  title="Copy output"
                >
                  {copiedStdout ? <Check className="shrink-0 text-secondary" size={13} /> : <Copy className="shrink-0" size={13} />}
                  <span className="w-0 opacity-0 group-hover:w-auto group-hover:opacity-100 transition-all duration-200 whitespace-nowrap overflow-hidden ml-0 group-hover:ml-1.5 text-[10px] font-semibold">
                    {copiedStdout ? 'Copied!' : 'Copy'}
                  </span>
                </button>
              </div>
            )}
            {executionResult.stderr && (
              <div className="flex items-start gap-2">
                <pre className="font-console-text text-[12px] text-error whitespace-pre-wrap mt-1 flex-1">{executionResult.stderr}</pre>
                <button
                  onClick={() => { navigator.clipboard.writeText(executionResult.stderr); setCopiedStderr(true); setTimeout(() => setCopiedStderr(false), 2000); }}
                  className="group relative flex items-center justify-center h-7 rounded-lg bg-surface-container hover:bg-error/10 text-on-surface-variant hover:text-error transition-all duration-200 overflow-hidden px-2 max-w-[28px] hover:max-w-[110px] hover:px-3 border border-outline-variant/30 shrink-0 mt-1"
                  title="Copy error"
                >
                  {copiedStderr ? <Check className="shrink-0 text-error" size={13} /> : <Copy className="shrink-0" size={13} />}
                  <span className="w-0 opacity-0 group-hover:w-auto group-hover:opacity-100 transition-all duration-200 whitespace-nowrap overflow-hidden ml-0 group-hover:ml-1.5 text-[10px] font-semibold">
                    {copiedStderr ? 'Copied!' : 'Copy'}
                  </span>
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="flex items-center justify-between text-outline/50">
            <div className="flex items-center gap-2">
              <BrainCircuit size={15} />
              <span className="font-console-text text-[11px]">Console ready…</span>
            </div>
            <span className="font-ui-label text-[9px] uppercase tracking-wider">Output</span>
          </div>
        )}
      </div>
    </div>
  );
}
