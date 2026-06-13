'use client';

import React, { useState } from 'react';
import { Play, Square, Loader2, Trash2, BrainCircuit, CheckCircle2, AlertCircle, Sparkles, Keyboard } from 'lucide-react';

interface CodeCellProps {
  id: string;
  initialCode?: string;
  initialLanguage?: string;
  onDelete?: () => void;
  onCodeChange?: (code: string) => void;
  onLanguageChange?: (language: string) => void;
  onStdinChange?: (stdin: string) => void;
  onAiHelper?: () => void;
  onExecutionComplete?: (success: boolean) => void;
}

const DEFAULT_CODE: Record<string, string> = {
  python3: 'print("Hello from CollabCode!")\nfor i in range(5):\n    print(f"Counting: {i}")',
  cpp17: '#include <iostream>\n\nint main() {\n    std::cout << "Hello from C++17!" << std::endl;\n    return 0;\n}',
  java: 'public class MyClass {\n    public static void main(String args[]) {\n        System.out.println("Hello from Java!");\n    }\n}',
  nodejs: 'console.log("Hello from Node.js!");\nfor (let i = 0; i < 5; i++) {\n    console.log(`Counting: ${i}`);\n}'
};

export default function CodeCell({ id, initialCode = '', initialLanguage = 'python3', initialStdin = '', onDelete, onCodeChange, onLanguageChange, onStdinChange, onAiHelper, onExecutionComplete }: CodeCellProps) {
  const [language, setLanguage] = useState(initialLanguage);
  const [codeContent, setCodeContent] = useState(initialCode);
  
  const [isRunning, setIsRunning] = useState(false);
  const [executionResult, setExecutionResult] = useState<any>(null);
  const [isStdinOpen, setIsStdinOpen] = useState(!!initialStdin);
  const [stdinContent, setStdinContent] = useState(initialStdin);

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

    try {
      // Fetch via Next.js server-side proxy to avoid client CORS/Failed to fetch errors
      const res = await fetch('/api/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
            code: codeContent,
            language: language,
            stdin: stdinContent
        }),
      });
      
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP Error ${res.status}`);
      }
      
      const data = await res.json();
      setExecutionResult(data);
      if (data.status === 'Accepted' && !data.error && !data.stderr) {
        onExecutionComplete?.(true);
      } else {
        onExecutionComplete?.(false);
      }
    } catch (err: any) {
      setExecutionResult({ error: err.message || 'Network error occurred. Ensure the backend is running on port 8080.' });
      onExecutionComplete?.(false);
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="flex flex-col rounded-xl border border-outline-variant bg-surface-container overflow-hidden shadow-xl ring-1 ring-white/5 mb-0 card-hover transition-all">
      {/* Cell Header */}
      <div className="flex items-center justify-between px-4 h-11 bg-surface-container-high border-b border-outline-variant/30">
        <div className="flex items-center gap-3">
          <span className="text-outline font-code-bold text-[11px]">[{id}]</span>
          
          {/* Language Dropdown */}
          <select 
            value={language}
            onChange={handleLanguageChange}
            className="bg-surface-variant border border-outline-variant rounded-lg px-2.5 py-1 text-ui-label font-ui-label text-on-surface hover:border-primary/55 hover:bg-surface-variant/90 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/25 transition-all cursor-pointer font-semibold duration-200"
          >
            <option value="python3">Python 3</option>
            <option value="cpp17">C++ 17</option>
            <option value="java">Java</option>
            <option value="nodejs">Node.js</option>
          </select>
        </div>
        <div className="flex items-center gap-2">
          {/* AI Helper Toggle */}
          <button
            onClick={onAiHelper}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-ui-label text-[12px] font-semibold text-primary bg-primary/10 border border-primary/20 hover:bg-primary hover:text-on-primary transition-all duration-200 shadow-sm"
            title="Ask AI Helper"
          >
            <Sparkles size={14} />
            <span>AI Helper</span>
          </button>
 
          <button
            onClick={() => setIsStdinOpen(!isStdinOpen)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-ui-label text-[12px] font-semibold transition-all duration-200 shadow-sm ${
              isStdinOpen 
                ? 'bg-surface-variant text-on-surface border border-outline-variant/60' 
                : 'text-on-surface-variant hover:bg-surface-variant border border-transparent hover:border-outline-variant/30'
            }`}
            title="Provide Standard Input (stdin)"
          >
            <Keyboard size={14} />
            <span>Input</span>
          </button>

          <button 
            onClick={handleRun}
            disabled={isRunning}
            data-run-btn="true"
            className={`flex items-center gap-1.5 bg-secondary text-on-secondary border border-secondary/25 px-4 py-1.5 rounded-lg font-ui-label text-[12px] font-semibold transition-all duration-200 shadow-md shadow-secondary/20 hover:brightness-110 active:scale-95 ${
              isRunning ? 'opacity-70 cursor-not-allowed' : ''
            }`}
          >
            {isRunning ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} fill="currentColor" />}
            {isRunning ? 'Running...' : 'Run'}
          </button>
          
          {onDelete && (
            <button 
              onClick={onDelete}
              className="text-on-surface-variant hover:text-error hover:bg-error/10 transition-all duration-200 flex items-center p-1.5 rounded-lg ml-1"
              title="Delete cell"
            >
              <Trash2 size={16} />
            </button>
          )}
        </div>
      </div>
      {/* Editor Content */}
      <div className="flex bg-surface-container-lowest relative">
        <div className="absolute inset-0 bg-gradient-to-b from-surface-container/20 to-transparent pointer-events-none"></div>
        {/* Line Numbers */}
        <div className="w-12 bg-surface-container-high/20 py-4 flex flex-col items-center font-code-block text-outline opacity-50 select-none border-r border-outline-variant/30">
          {codeContent.split('\n').map((_, i) => (
            <div key={i}>{i + 1}</div>
          ))}
        </div>
        {/* Code Area */}
        <div className="flex-1 font-code-block text-code-block text-on-surface-variant leading-relaxed relative flex">
          <textarea 
            value={codeContent}
            onChange={handleCodeChange}
            className="w-full bg-transparent p-4 outline-none resize-none overflow-hidden text-on-surface-variant font-code-block leading-relaxed"
            rows={Math.max(codeContent.split('\n').length, 5)}
            spellCheck={false}
          />
        </div>
      </div>

      {/* Standard Input Area */}
      {isStdinOpen && (
        <div className="bg-surface-container-low border-t border-outline-variant/40 p-3 flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="font-ui-label text-[10px] uppercase tracking-wider text-outline font-semibold flex items-center gap-1.5">
              <Keyboard size={12} /> Standard Input (stdin)
            </span>
          </div>
          <textarea
            value={stdinContent}
            onChange={(e) => {
              setStdinContent(e.target.value);
              onStdinChange?.(e.target.value);
            }}
            placeholder="Type input here (e.g., for Python input() or C++ std::cin)..."
            className="w-full bg-surface-container border border-outline-variant/40 rounded-lg p-2.5 text-[12px] font-console-text text-on-surface focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-all resize-y min-h-[60px]"
            spellCheck={false}
          />
        </div>
      )}

      {/* Output Console */}
      <div className="bg-surface-container-lowest border-t border-outline-variant p-4 min-h-[80px]">
        {isRunning ? (
          <div className="flex items-center gap-2">
            <Loader2 size={16} className="text-outline animate-spin" />
            <span className="font-console-text text-console-text text-outline/80 text-[11px]">Executing code on JDoodle...</span>
          </div>
        ) : executionResult ? (
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {executionResult.stderr || executionResult.error || executionResult.status !== 'Accepted' ? (
                  <AlertCircle size={15} className="text-error" />
                ) : (
                  <CheckCircle2 size={15} className="text-secondary" />
                )}
                <span className={`font-console-text text-[11px] ${executionResult.stderr || executionResult.error || executionResult.status !== 'Accepted' ? 'text-error/80' : 'text-secondary/80'}`}>
                  {executionResult.error ? executionResult.error : `${executionResult.status || 'Accepted'} ${executionResult.time ? `(Time: ${executionResult.time}s, Mem: ${executionResult.memory}KB)` : ''}`}
                </span>
              </div>
              <span className="font-ui-label text-[9px] text-outline uppercase tracking-wider">Output</span>
            </div>
            {executionResult.stdout && (
              <pre className="font-console-text text-[12px] text-on-surface whitespace-pre-wrap mt-1">{executionResult.stdout}</pre>
            )}
            {executionResult.stderr && (
              <pre className="font-console-text text-[12px] text-error whitespace-pre-wrap mt-1">{executionResult.stderr}</pre>
            )}
            {executionResult.compile_output && (
              <pre className="font-console-text text-[12px] text-error whitespace-pre-wrap mt-1">{executionResult.compile_output}</pre>
            )}
          </div>
        ) : (
          <div className="flex items-center justify-between text-outline/50">
            <div className="flex items-center gap-2">
              <BrainCircuit size={15} />
              <span className="font-console-text text-[11px]">Console ready...</span>
            </div>
            <span className="font-ui-label text-[9px] uppercase tracking-wider">Output</span>
          </div>
        )}
      </div>
    </div>
  );
}
