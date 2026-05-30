'use client';

import React, { useState } from 'react';

interface CodeCellProps {
  id: string;
  initialCode?: string;
  initialLanguage?: string;
  onDelete?: () => void;
  onCodeChange?: (code: string) => void;
  onLanguageChange?: (language: string) => void;
}

const DEFAULT_CODE: Record<string, string> = {
  python3: 'print("Hello from CollabCode!")\nfor i in range(5):\n    print(f"Counting: {i}")',
  cpp17: '#include <iostream>\n\nint main() {\n    std::cout << "Hello from C++17!" << std::endl;\n    return 0;\n}',
  java: 'public class MyClass {\n    public static void main(String args[]) {\n        System.out.println("Hello from Java!");\n    }\n}',
  nodejs: 'console.log("Hello from Node.js!");\nfor (let i = 0; i < 5; i++) {\n    console.log(`Counting: ${i}`);\n}'
};

export default function CodeCell({ id, initialCode = '', initialLanguage = 'python3', onDelete, onCodeChange, onLanguageChange }: CodeCellProps) {
  const [language, setLanguage] = useState(initialLanguage);
  const [codeContent, setCodeContent] = useState(initialCode);
  
  const [isRunning, setIsRunning] = useState(false);
  const [executionResult, setExecutionResult] = useState<any>(null);

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
            language: language
        }),
      });
      
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP Error ${res.status}`);
      }
      
      const data = await res.json();
      setExecutionResult(data);
    } catch (err: any) {
      setExecutionResult({ error: err.message || 'Network error occurred. Ensure the backend is running on port 8080.' });
    } finally {
      setIsRunning(false);
    }
  };

  const [isAiOpen, setIsAiOpen] = useState(false);
  const [aiQuery, setAiQuery] = useState('');
  const [aiResponse, setAiResponse] = useState('');
  const [isAiLoading, setIsAiLoading] = useState(false);

  const handleAiAnalyze = async (customPrompt?: string) => {
    const promptToSend = customPrompt || aiQuery;
    if (!promptToSend.trim() && !customPrompt) return;
    
    setIsAiLoading(true);
    setAiResponse('');
    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: codeContent,
          language,
          prompt: promptToSend
        })
      });
      
      if (!res.ok) {
        throw new Error(`API error: ${res.status}`);
      }
      
      const data = await res.json();
      setAiResponse(data.response);
    } catch (err: any) {
      setAiResponse(`❌ Error generating response: ${err.message || 'Unknown network error'}`);
    } finally {
      setIsAiLoading(false);
    }
  };

  return (
    <div className="flex flex-col rounded-lg border border-outline-variant bg-surface-container overflow-hidden shadow-xl ring-1 ring-white/5 mb-8">
      {/* Cell Header */}
      <div className="flex items-center justify-between px-4 h-10 bg-surface-container-high">
        <div className="flex items-center gap-3">
          <span className="text-outline font-code-bold text-[11px]">[{id}]</span>
          
          {/* Language Dropdown */}
          <select 
            value={language}
            onChange={handleLanguageChange}
            className="bg-surface-variant border border-outline-variant rounded px-2 py-1 text-ui-label font-ui-label text-on-surface focus:outline-none focus:border-primary transition-colors cursor-pointer"
          >
            <option value="python3">Python 3</option>
            <option value="cpp17">C++ 17</option>
            <option value="java">Java</option>
            <option value="nodejs">Node.js</option>
          </select>

          <div className="flex gap-1.5 ml-2">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500/50"></span>
            <span className="w-2.5 h-2.5 rounded-full bg-yellow-500/50"></span>
            <span className="w-2.5 h-2.5 rounded-full bg-green-500/50"></span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* AI Helper Toggle */}
          <button
            onClick={() => setIsAiOpen(!isAiOpen)}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-lg font-ui-label text-ui-label font-bold transition-all ${isAiOpen ? 'bg-primary text-on-primary' : 'bg-primary/20 text-primary hover:bg-primary/30'}`}
            title="Ask AI Helper"
          >
            <span className="material-symbols-outlined text-[18px]">psychology</span>
            <span>AI Helper</span>
          </button>

          <button 
            onClick={handleRun}
            disabled={isRunning}
            className={`flex items-center gap-1.5 bg-secondary text-on-secondary px-3 py-1 rounded-lg font-ui-label text-ui-label font-bold transition-all ${isRunning ? 'opacity-70 cursor-not-allowed' : 'hover:brightness-110 active:scale-95'}`}
          >
            <span className="material-symbols-outlined text-[18px]" style={{fontVariationSettings: "'FILL' 1"}}>
              {isRunning ? 'hourglass_empty' : 'play_arrow'}
            </span>
            {isRunning ? 'Running...' : 'Run'}
          </button>
          
          {onDelete && (
            <button 
              onClick={onDelete}
              className="text-on-surface-variant hover:text-error transition-colors flex items-center p-1 rounded hover:bg-surface-variant"
              title="Delete cell"
            >
              <span className="material-symbols-outlined text-[18px]">delete</span>
            </button>
          )}
        </div>
      </div>
      {/* Editor Content */}
      <div className="flex">
        {/* Line Numbers */}
        <div className="w-10 bg-surface-container-high/30 py-4 flex flex-col items-center font-code-block text-outline opacity-50 select-none border-r border-outline-variant/30">
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

      {/* AI Helper Panel */}
      {isAiOpen && (
        <div className="border-t border-outline-variant bg-surface-container-low p-5 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-primary">
              <span className="material-symbols-outlined text-[20px]">insights</span>
              <span className="font-ui-header text-[13px] font-bold uppercase tracking-wider">AI Assistant Context Analyser</span>
            </div>
            <button 
              onClick={() => { setAiResponse(''); setAiQuery(''); }}
              className="text-outline hover:text-on-surface text-[11px] font-ui-label"
            >
              Clear Conversation
            </button>
          </div>

          {/* Quick Prompts */}
          <div className="flex flex-wrap gap-2">
            <button 
              onClick={() => handleAiAnalyze('Explain this code')}
              className="px-3 py-1 rounded bg-surface border border-outline-variant hover:border-primary transition-colors text-[11px] font-ui-label text-on-surface-variant"
            >
              📖 Explain
            </button>
            <button 
              onClick={() => handleAiAnalyze('Check for bugs or issues')}
              className="px-3 py-1 rounded bg-surface border border-outline-variant hover:border-error transition-colors text-[11px] font-ui-label text-on-surface-variant"
            >
              🪲 Bug Check
            </button>
            <button 
              onClick={() => handleAiAnalyze('Optimize performance')}
              className="px-3 py-1 rounded bg-surface border border-outline-variant hover:border-secondary transition-colors text-[11px] font-ui-label text-on-surface-variant"
            >
              ⚡ Optimize
            </button>
          </div>

          {/* Prompt Entry Input */}
          <div className="flex gap-2">
            <input 
              type="text"
              value={aiQuery}
              onChange={(e) => setAiQuery(e.target.value)}
              placeholder="Ask anything about this specific code block..."
              className="flex-1 bg-surface border border-outline-variant rounded-lg px-3 py-2 text-[12px] text-on-surface focus:outline-none focus:border-primary"
              onKeyDown={(e) => { if (e.key === 'Enter') handleAiAnalyze(); }}
            />
            <button 
              onClick={() => handleAiAnalyze()}
              disabled={isAiLoading}
              className="bg-primary text-on-primary px-4 py-2 rounded-lg text-[12px] font-bold hover:brightness-110 active:scale-95 disabled:opacity-50 transition-all flex items-center gap-1"
            >
              {isAiLoading ? 'Analyzing...' : 'Ask'}
            </button>
          </div>

          {/* AI Helper Response Container */}
          {(aiResponse || isAiLoading) && (
            <div className="bg-surface-container-highest border border-outline-variant rounded-lg p-4 font-ui-body text-ui-body text-on-surface-variant whitespace-pre-wrap leading-relaxed animate-in max-h-[300px] overflow-y-auto">
              {isAiLoading ? (
                <div className="flex items-center gap-2 text-primary">
                  <span className="material-symbols-outlined text-[16px] animate-spin">sync</span>
                  <span className="font-ui-label text-[12px]">Analyzing cell context &amp; formatting answer...</span>
                </div>
              ) : (
                aiResponse
              )}
            </div>
          )}
        </div>
      )}

      {/* Output Console */}
      <div className="bg-surface-container-lowest border-t border-outline-variant p-6 min-h-[120px]">
        {isRunning ? (
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-outline text-[16px] animate-spin">sync</span>
            <span className="font-console-text text-console-text text-outline/80">Executing code on JDoodle...</span>
          </div>
        ) : executionResult ? (
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <span className={`material-symbols-outlined text-[16px] ${executionResult.stderr || executionResult.error || executionResult.status !== 'Accepted' ? 'text-error' : 'text-secondary'}`}>
                {executionResult.stderr || executionResult.error || executionResult.status !== 'Accepted' ? 'error' : 'check_circle'}
              </span>
              <span className={`font-console-text text-console-text ${executionResult.stderr || executionResult.error || executionResult.status !== 'Accepted' ? 'text-error/80' : 'text-secondary/80'}`}>
                {executionResult.error ? executionResult.error : `${executionResult.status || 'Accepted'} ${executionResult.time ? `(Time: ${executionResult.time}s, Mem: ${executionResult.memory}KB)` : ''}`}
              </span>
            </div>
            {executionResult.stdout && (
              <pre className="font-console-text text-console-text text-on-surface whitespace-pre-wrap mt-2">{executionResult.stdout}</pre>
            )}
            {executionResult.stderr && (
              <pre className="font-console-text text-console-text text-error whitespace-pre-wrap mt-2">{executionResult.stderr}</pre>
            )}
            {executionResult.compile_output && (
              <pre className="font-console-text text-console-text text-error whitespace-pre-wrap mt-2">{executionResult.compile_output}</pre>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-2 text-outline/50">
            <span className="material-symbols-outlined text-[16px]">info</span>
            <span className="font-console-text text-console-text">Output will appear here...</span>
          </div>
        )}
      </div>
    </div>
  );
}
