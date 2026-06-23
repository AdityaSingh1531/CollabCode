'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Play, Loader2, Trash2, BrainCircuit, CheckCircle2, AlertCircle,
  Sparkles, Keyboard, Copy, Check, GripVertical
} from 'lucide-react';

interface CodeCellProps {
  id: string;
  initialCode?: string;
  initialLanguage?: string;
  initialStdin?: string;
  injectedStdin?: string;          // externally injected via Data Sources sidebar
  onDelete?: () => void;
  onCodeChange?: (code: string) => void;
  onLanguageChange?: (language: string) => void;
  onStdinChange?: (stdin: string) => void;
  onAiHelper?: () => void;
  onExecutionComplete?: (success: boolean) => void;
  onFocus?: () => void;             // called when cell is clicked / focused
  runAllTrigger?: number;
  onDragStart?: (e: React.DragEvent) => void;
  onDragEnd?: (e: React.DragEvent) => void;
  onDragOver?: (e: React.DragEvent) => void;
  onDrop?: (e: React.DragEvent) => void;
  isDragOver?: boolean;
}

const DEFAULT_CODE: Record<string, string> = {
  python3: 'print("Hello from CollabCode!")\nfor i in range(5):\n    print(f"Counting: {i}")',
  cpp17: '#include <iostream>\n\nint main() {\n    std::cout << "Hello from C++17!" << std::endl;\n    return 0;\n}',
  java: 'public class MyClass {\n    public static void main(String args[]) {\n        System.out.println("Hello from Java!");\n    }\n}',
  nodejs: 'console.log("Hello from Node.js!");\nfor (let i = 0; i < 5; i++) {\n    console.log(`Counting: ${i}`);\n}'
};

export default function CodeCell({
  id, initialCode = '', initialLanguage = 'python3', initialStdin = '',
  injectedStdin,
  onDelete, onCodeChange, onLanguageChange, onStdinChange,
  onAiHelper, onExecutionComplete, onFocus, runAllTrigger,
  onDragStart, onDragEnd, onDragOver, onDrop, isDragOver
}: CodeCellProps) {
  const [language, setLanguage]           = useState(initialLanguage);
  const [codeContent, setCodeContent]     = useState(initialCode);
  const [isRunning, setIsRunning]         = useState(false);
  const [executionResult, setExecutionResult] = useState<any>(null);
  const [isStdinOpen, setIsStdinOpen]     = useState(!!initialStdin);
  const [stdinContent, setStdinContent]   = useState(initialStdin);
  const [copiedStdout, setCopiedStdout]   = useState(false);
  const [copiedStderr, setCopiedStderr]   = useState(false);
  const [dataInjected, setDataInjected]   = useState(false);

  useEffect(() => {
    if (runAllTrigger !== undefined && runAllTrigger > 0) {
      handleRun();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runAllTrigger]);

  // Apply externally injected stdin from the Data Sources sidebar
  useEffect(() => {
    if (injectedStdin !== undefined && injectedStdin !== '') {
      // Strip tick suffix added by page.tsx to force re-trigger on same content
      const clean = injectedStdin.split('\0tick:')[0];
      setStdinContent(clean);
      setIsStdinOpen(true);
      setDataInjected(true);
      onStdinChange?.(clean);
      setTimeout(() => setDataInjected(false), 3000);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [injectedStdin]);

  const handleLanguageChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newLang = e.target.value;
    setLanguage(newLang);
    onLanguageChange?.(newLang);
  };

  const handleCodeChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newCode = e.target.value;
    setCodeContent(newCode);
    onCodeChange?.(newCode);
  };

  const handleRun = async () => {
    if (isRunning) return;
    setIsRunning(true);
    setExecutionResult(null);
    const startTime = performance.now();

    try {
      const res = await fetch('/api/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: codeContent, language, stdin: stdinContent }),
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
  };

  /* ── Expandable icon-button helper ─────────────────────── */
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
      {/* Cell Header */}
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
            <option value="cpp17" className="bg-[#1b263b] text-white">C++ 17</option>
            <option value="java" className="bg-[#1b263b] text-white">Java</option>
            <option value="nodejs" className="bg-[#1b263b] text-white">Node.js</option>
            <option value="sql" className="bg-[#1b263b] text-white">SQL / MySQL</option>
          </select>

          {/* Data-injected badge */}
          {dataInjected && (
            <span className="flex items-center gap-1 text-[9px] font-bold text-secondary bg-secondary/10 border border-secondary/20 rounded-full px-2 py-0.5 animate-pulse select-none">
              📎 Data injected
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5">
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

      {/* Editor */}
      <div className="flex bg-surface-container-lowest relative">
        <div className="absolute inset-0 bg-gradient-to-b from-surface-container/20 to-transparent pointer-events-none" />
        {/* Line Numbers */}
        <div className="w-10 bg-surface-container-high/20 py-4 flex flex-col items-center font-code-block text-outline opacity-50 select-none border-r border-outline-variant/30 text-[11px] leading-relaxed">
          {codeContent.split('\n').map((_, i) => <div key={i}>{i + 1}</div>)}
        </div>
        <div className="flex-1 relative">
          <textarea
            value={codeContent}
            onChange={handleCodeChange}
            onKeyDown={(e) => {
              if (e.ctrlKey && e.key === 'Enter') { e.preventDefault(); handleRun(); }
            }}
            className="w-full bg-transparent p-4 outline-none resize-none overflow-hidden text-on-surface-variant font-code-block leading-relaxed text-[13px]"
            rows={Math.max(codeContent.split('\n').length, 5)}
            spellCheck={false}
          />
        </div>
      </div>

      {/* Stdin */}
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

      {/* Output Console */}
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
