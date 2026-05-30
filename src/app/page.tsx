'use client';

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useTheme } from '@/components/ThemeProvider';
import CodeCell from '@/components/CodeCell';
import TextCell from '@/components/TextCell';

export default function CollabCodeIDE() {
  const { isDark, toggleTheme } = useTheme();

  // State for title
  const [title, setTitle] = useState("Data Analysis v1");
  const [isEditingTitle, setIsEditingTitle] = useState(false);

  // State for notebook cells
  const [cells, setCells] = useState<Array<{ id: string; type: 'code' | 'text'; language?: string; code?: string; content?: string }>>([    { id: '1', type: 'code', language: 'python3', code: '' },
    { id: '2', type: 'code', language: 'nodejs', code: '' }
  ]);

  // Ref for the notebook canvas area (for screenshot)
  const notebookRef = useRef<HTMLDivElement>(null);

  // Ref for hidden file input (for import)
  const fileInputRef = useRef<HTMLInputElement>(null);

  // State for share dropdown visibility
  const [isShareOpen, setIsShareOpen] = useState(false);
  const shareRef = useRef<HTMLDivElement>(null);

  // State for import modal
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [pendingImportCells, setPendingImportCells] = useState<Array<{ id: string; type: 'code' | 'text'; language?: string; code?: string; content?: string }>>([]);
  const [showOverwriteConfirm, setShowOverwriteConfirm] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [activeHelpTab, setActiveHelpTab] = useState<'overview' | 'ai' | 'share' | 'shortcuts'>('overview');

  // Close share dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (shareRef.current && !shareRef.current.contains(e.target as Node)) {
        setIsShareOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const addCodeCell = () => {
    const newId = Date.now().toString();
    setCells([...cells, { id: newId, type: 'code', language: 'python3', code: '' }]);
  };

  const addTextCell = () => {
    const newId = Date.now().toString();
    setCells([...cells, { id: newId, type: 'text', content: '' }]);
  };

  const deleteCell = (id: string) => {
    setCells(cells.filter(cell => cell.id !== id));
  };

  const clearAllCells = () => {
    if (window.confirm('Are you sure you want to clear all cells? This action cannot be undone.')) {
      setCells([]);
    }
  };

  // --- Content tracking callbacks ---
  const handleCodeChange = useCallback((id: string, code: string) => {
    setCells(prev => prev.map(c => c.id === id ? { ...c, code } : c));
  }, []);

  const handleLanguageChange = useCallback((id: string, language: string) => {
    setCells(prev => prev.map(c => c.id === id ? { ...c, language } : c));
  }, []);

  const handleTextContentChange = useCallback((id: string, content: string) => {
    setCells(prev => prev.map(c => c.id === id ? { ...c, content } : c));
  }, []);

  // --- Share: PNG screenshot (using html-to-image – avoids oklab parse errors from Tailwind v4) ---
  const handleExportPng = async () => {
    setIsShareOpen(false);
    const cellsWrapper = document.getElementById('notebook-cells');
    if (!cellsWrapper || cellsWrapper.children.length === 0) return;
    
    // Remember original styles to restore them later
    const originalDisplay = cellsWrapper.style.display;
    const originalGridTemplateRows = cellsWrapper.style.gridTemplateRows;
    const originalGridAutoFlow = cellsWrapper.style.gridAutoFlow;
    const originalGap = cellsWrapper.style.gap;
    const originalPadding = cellsWrapper.style.padding;
    const originalMaxWidth = cellsWrapper.parentElement ? cellsWrapper.parentElement.style.maxWidth : '';
    const originalWidth = cellsWrapper.style.width;

    const childStyles: Array<{ element: HTMLElement; width: string; marginBottom: string }> = [];
    
    try {
      // Modify child styles temporarily for column consistency and layout
      Array.from(cellsWrapper.children).forEach((child) => {
        const htmlChild = child as HTMLElement;
        childStyles.push({
          element: htmlChild,
          width: htmlChild.style.width,
          marginBottom: htmlChild.style.marginBottom,
        });
        htmlChild.style.width = '800px';
        htmlChild.style.marginBottom = '0';
      });

      // Apply the grid layout (max 10 rows per column) directly on the live container
      cellsWrapper.style.display = 'grid';
      cellsWrapper.style.gridTemplateRows = 'repeat(10, min-content)';
      cellsWrapper.style.gridAutoFlow = 'column';
      cellsWrapper.style.gap = '32px';
      cellsWrapper.style.width = 'max-content';

      // Temporary background and padding container styling
      const originalBgColor = cellsWrapper.style.backgroundColor;
      cellsWrapper.style.backgroundColor = isDark ? '#0b1326' : '#fdf6e3';
      cellsWrapper.style.padding = '48px';
      if (cellsWrapper.parentElement) {
        cellsWrapper.parentElement.style.maxWidth = 'none';
      }

      const { toPng } = await import('html-to-image');
      const dataUrl = await toPng(cellsWrapper, {
        pixelRatio: 2,
        backgroundColor: isDark ? '#0b1326' : '#fdf6e3',
        skipFonts: true, // Prevents cssRules SecurityError from external Google Fonts
      });
      
      // Restore styles
      cellsWrapper.style.display = originalDisplay;
      cellsWrapper.style.gridTemplateRows = originalGridTemplateRows;
      cellsWrapper.style.gridAutoFlow = originalGridAutoFlow;
      cellsWrapper.style.gap = originalGap;
      cellsWrapper.style.padding = originalPadding;
      cellsWrapper.style.backgroundColor = originalBgColor;
      cellsWrapper.style.width = originalWidth;
      if (cellsWrapper.parentElement) {
        cellsWrapper.parentElement.style.maxWidth = originalMaxWidth;
      }

      childStyles.forEach(({ element, width, marginBottom }) => {
        element.style.width = width;
        element.style.marginBottom = marginBottom;
      });

      // Clean title for safe filename
      const safeTitle = title.replace(/[^a-zA-Z0-9_-]/g, '_');
      const link = document.createElement('a');
      const ts = new Date().toISOString().replace(/[:.]/g, '-');
      link.download = `${safeTitle}-${ts}.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      // Revert styles in case of error
      cellsWrapper.style.display = originalDisplay;
      cellsWrapper.style.gridTemplateRows = originalGridTemplateRows;
      cellsWrapper.style.gridAutoFlow = originalGridAutoFlow;
      cellsWrapper.style.gap = originalGap;
      cellsWrapper.style.padding = originalPadding;
      cellsWrapper.style.width = originalWidth;
      if (cellsWrapper.parentElement) {
        cellsWrapper.parentElement.style.maxWidth = originalMaxWidth;
      }
      childStyles.forEach(({ element, width, marginBottom }) => {
        element.style.width = width;
        element.style.marginBottom = marginBottom;
      });

      console.error('Screenshot failed:', err);
      alert('Screenshot failed. Check console for details.');
    }
  };

  // --- Share: JSON export ---
  const handleExportJson = () => {
    setIsShareOpen(false);
    const exportData = cells.map(cell => {
      if (cell.type === 'code') {
        return { type: 'code', language: cell.language || 'python3', code: cell.code || '' };
      } else {
        return { type: 'text', content: cell.content || '' };
      }
    });
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const link = document.createElement('a');
    const ts = new Date().toISOString().replace(/[:.]/g, '-');
    link.download = `session-code-${ts}.json`;
    link.href = URL.createObjectURL(blob);
    link.click();
    URL.revokeObjectURL(link.href);
  };

  // --- Insert: JSON import (parses file, then shows modal for overwrite vs append) ---
  const handleImportJson = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const raw = ev.target?.result as string;
        if (!raw) throw new Error('File is empty');
        const data = JSON.parse(raw);
        if (!Array.isArray(data)) throw new Error('Expected a JSON array at the top level');
        const newCells = data.map((item: any, idx: number) => {
          const newId = Date.now().toString() + '-' + idx + '-' + Math.random().toString(36).slice(2, 7);
          if (item.type === 'code') {
            return { id: newId, type: 'code' as const, language: item.language || 'python3', code: item.code || '' };
          } else {
            return { id: newId, type: 'text' as const, content: item.content || '' };
          }
        });
        setPendingImportCells(newCells);
        setImportModalOpen(true);
      } catch (err: any) {
        alert('Failed to import: ' + (err.message || 'invalid JSON format.'));
        console.error('Import error:', err);
      }
    };
    reader.onerror = () => {
      alert('Failed to read file.');
      console.error('FileReader error:', reader.error);
    };
    reader.readAsText(file);
  };

  const handleImportAppend = () => {
    setCells(prev => [...prev, ...pendingImportCells]);
    setPendingImportCells([]);
    setImportModalOpen(false);
  };

  const handleImportOverwrite = () => {
    // Show confirmation warning first
    setShowOverwriteConfirm(true);
  };

  const handleConfirmOverwrite = () => {
    setCells(pendingImportCells);
    setPendingImportCells([]);
    setImportModalOpen(false);
    setShowOverwriteConfirm(false);
  };

  const handleCancelImport = () => {
    setPendingImportCells([]);
    setImportModalOpen(false);
    setShowOverwriteConfirm(false);
  };

  // Reset the file input after each import attempt so the same file can be re-selected
  const handleFileInputClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // State for files
  const [files, setFiles] = useState([
    { id: '1', name: 'main.py', icon: 'folder_open', active: true },
    { id: '2', name: 'data_clean.csv', icon: 'table_chart', active: false },
    { id: '3', name: 'README.md', icon: 'description', active: false },
  ]);

  // State for Terminal
  const [isTerminalOpen, setIsTerminalOpen] = useState(false);
  const [terminalLines, setTerminalLines] = useState<Array<{ type: 'command' | 'output' | 'error'; text: string }>>([
    { type: 'output', text: 'CollabCode Interactive Terminal v1.0' },
    { type: 'output', text: 'Connected to local host shell. Type a command (e.g. dir, echo hello, npm run dev) and press Enter.' }
  ]);
  const [currentCommand, setCurrentCommand] = useState('');
  const [isTerminalRunning, setIsTerminalRunning] = useState(false);
  const terminalBottomRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom of terminal
  useEffect(() => {
    if (isTerminalOpen && terminalBottomRef.current) {
      terminalBottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [terminalLines, isTerminalOpen]);

  const handleTerminalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cmd = currentCommand.trim();
    if (!cmd) return;

    // Add command to history list
    setTerminalLines(prev => [...prev, { type: 'command', text: cmd }]);
    setCurrentCommand('');
    setIsTerminalRunning(true);

    try {
      const response = await fetch('/api/terminal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command: cmd }),
      });
      const data = await response.json();
      if (data.stdout) {
        setTerminalLines(prev => [...prev, { type: 'output', text: data.stdout }]);
      }
      if (data.stderr) {
        setTerminalLines(prev => [...prev, { type: 'error', text: data.stderr }]);
      }
    } catch (err: any) {
      setTerminalLines(prev => [...prev, { type: 'error', text: 'Error connecting to terminal API.' }]);
    } finally {
      setIsTerminalRunning(false);
    }
  };

  const handleTitleSubmit = (e: React.KeyboardEvent<HTMLInputElement> | React.FocusEvent<HTMLInputElement>) => {
    if ('key' in e && e.key === 'Enter') {
      setIsEditingTitle(false);
    } else if (e.type === 'blur') {
      setIsEditingTitle(false);
    }
  };

  const addFile = () => {
    const newId = Date.now().toString();
    setFiles([...files, { id: newId, name: 'untitled.py', icon: 'description', active: false }]);
  };

  const deleteFile = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setFiles(files.filter(f => f.id !== id));
  };

  const selectFile = (id: string) => {
    setFiles(files.map(f => ({ ...f, active: f.id === id })));
  };

  return (
    <div className="flex flex-col h-screen bg-background text-on-background font-ui-body selection:bg-primary/30">
      {/* TopNavBar */}
      <header className="flex items-center justify-between w-full h-12 px-4 bg-surface-container border-b border-outline-variant shrink-0">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <span className="font-ui-header text-ui-header font-bold text-primary">CollabCode</span>
            <div className="h-4 w-px bg-outline-variant mx-2"></div>
            {isEditingTitle ? (
              <input
                autoFocus
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onBlur={handleTitleSubmit}
                onKeyDown={handleTitleSubmit}
                className="bg-surface border border-primary rounded px-2 py-1 text-ui-header font-ui-header text-on-surface focus:outline-none"
              />
            ) : (
              <span 
                className="font-ui-header text-ui-header text-on-surface-variant opacity-80 cursor-pointer hover:opacity-100 transition-opacity"
                onClick={() => setIsEditingTitle(true)}
                title="Click to rename"
              >
                {title}
              </span>
            )}
          </div>
          <nav className="hidden md:flex items-center gap-4">
            {['File', 'Edit', 'View', 'Runtime', 'Tools'].map(item => (
              <span key={item} className="font-ui-label text-ui-label text-on-surface-variant font-medium cursor-pointer hover:bg-surface-variant px-2 py-1 rounded transition-colors">{item}</span>
            ))}
            <span 
              onClick={() => setIsHelpOpen(true)}
              className="font-ui-label text-ui-label text-primary font-semibold cursor-pointer hover:bg-primary/10 px-2 py-1 rounded transition-colors flex items-center gap-1"
            >
              <span className="material-symbols-outlined text-[15px]">help</span>
              Help
            </span>
            <button
              onClick={() => { handleFileInputClick(); fileInputRef.current?.click(); }}
              className="font-ui-label text-ui-label text-on-surface-variant font-medium cursor-pointer hover:bg-surface-variant px-2 py-1 rounded transition-colors flex items-center gap-1"
            >
              <span className="material-symbols-outlined text-[16px]">upload_file</span>
              Insert
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json,application/json"
              className="hidden"
              onChange={handleImportJson}
            />
          </nav>
        </div>
        <div className="flex items-center gap-4">
          {/* Share Dropdown */}
          <div className="relative" ref={shareRef}>
            <button
              onClick={() => setIsShareOpen(!isShareOpen)}
              className="bg-primary text-on-primary font-ui-label text-ui-label px-4 py-1.5 rounded-lg hover:opacity-90 active:opacity-80 transition-opacity font-semibold flex items-center gap-1.5"
            >
              <span className="material-symbols-outlined text-[18px]">share</span>
              Share
              <span className="material-symbols-outlined text-[14px]">{isShareOpen ? 'expand_less' : 'expand_more'}</span>
            </button>
            {isShareOpen && (
              <div className="absolute right-0 top-full mt-2 w-64 bg-surface-container-highest border border-outline-variant rounded-xl shadow-2xl z-50 overflow-hidden animate-in">
                <button
                  onClick={handleExportPng}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-surface-variant transition-colors text-left"
                >
                  <span className="material-symbols-outlined text-primary text-[20px]">photo_camera</span>
                  <div>
                    <div className="font-ui-label text-ui-label text-on-surface font-semibold">Export as PNG</div>
                    <div className="font-ui-label text-[11px] text-outline">Screenshot all cells &amp; outputs</div>
                  </div>
                </button>
                <div className="h-px bg-outline-variant mx-3"></div>
                <button
                  onClick={handleExportJson}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-surface-variant transition-colors text-left"
                >
                  <span className="material-symbols-outlined text-secondary text-[20px]">data_object</span>
                  <div>
                    <div className="font-ui-label text-ui-label text-on-surface font-semibold">Export as JSON</div>
                    <div className="font-ui-label text-[11px] text-outline">Code &amp; text cells data</div>
                  </div>
                </button>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2 text-on-surface-variant">
            <span 
              className="material-symbols-outlined cursor-pointer hover:bg-surface-variant p-1 rounded transition-colors"
              onClick={toggleTheme}
            >
              {isDark ? 'light_mode' : 'dark_mode'}
            </span>
            <span className="material-symbols-outlined cursor-pointer hover:bg-surface-variant p-1 rounded">settings</span>
            <span className="material-symbols-outlined cursor-pointer hover:bg-surface-variant p-1 rounded">account_circle</span>
          </div>
        </div>
      </header>

      {/* Sidebar & Main Content */}
      <div className="flex flex-1 overflow-hidden relative">
      {/* Main Workspace Canvas */}
        <main className="flex-1 flex flex-col bg-background overflow-y-auto scroll-smooth relative">
          <div ref={notebookRef} className="max-w-5xl mx-auto w-full p-8 flex flex-col pb-16">
            
            {/* Render Reusable Code and Text Cells */}
            <div id="notebook-cells" className="flex flex-col gap-8 mb-8">
              {cells.map((cell) => {
                if (cell.type === 'code') {
                  return (
                    <CodeCell 
                      key={cell.id} 
                      id={cell.id} 
                      initialCode={cell.code}
                      initialLanguage={cell.language} 
                      onDelete={() => deleteCell(cell.id)}
                      onCodeChange={(code) => handleCodeChange(cell.id, code)}
                      onLanguageChange={(lang) => handleLanguageChange(cell.id, lang)}
                    />
                  );
                } else {
                  return (
                    <TextCell 
                      key={cell.id} 
                      id={cell.id}
                      initialContent={cell.content}
                      onDelete={() => deleteCell(cell.id)}
                      onContentChange={(content) => handleTextContentChange(cell.id, content)}
                    />
                  );
                }
              })}
            </div>

            {/* Floating Toolbar for Actions */}
            <div className="flex justify-center mt-4">
              <div className="bg-surface-container-highest border border-outline-variant rounded-full px-6 py-3 flex items-center gap-6 shadow-2xl">
                <button 
                  onClick={addCodeCell}
                  className="flex items-center gap-2 cursor-pointer group bg-transparent border-none text-left"
                >
                  <span className="material-symbols-outlined text-primary group-hover:scale-110 transition-transform">add_circle</span>
                  <span className="font-ui-label text-ui-label text-on-surface-variant font-bold">Code Cell</span>
                </button>
                <div className="h-4 w-px bg-outline-variant"></div>
                <button 
                  onClick={addTextCell}
                  className="flex items-center gap-2 cursor-pointer group bg-transparent border-none text-left"
                >
                  <span className="material-symbols-outlined text-on-surface-variant group-hover:scale-110 transition-transform">text_fields</span>
                  <span className="font-ui-label text-ui-label text-on-surface-variant font-bold">Text Cell</span>
                </button>
                <div className="h-4 w-px bg-outline-variant"></div>
                <button 
                  onClick={clearAllCells}
                  className="flex items-center gap-2 cursor-pointer group bg-transparent border-none text-left"
                >
                  <span className="material-symbols-outlined text-error group-hover:scale-110 transition-transform">delete</span>
                  <span className="font-ui-label text-ui-label text-on-surface-variant font-bold">Clear All</span>
                </button>
              </div>
            </div>
          </div>

          {/* Terminal Section */}
          {isTerminalOpen && (
            <div className="absolute bottom-0 left-0 right-0 z-40 flex flex-col bg-surface-container-lowest border-t border-outline-variant shadow-2xl">
              <div className="flex items-center justify-between px-4 h-9 bg-surface-container-high border-b border-outline-variant">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[18px] text-on-surface-variant">terminal</span>
                    <span className="font-ui-label text-ui-label text-on-surface-variant font-bold uppercase tracking-wider">Terminal</span>
                  </div>
                  <div className="flex items-center gap-2 px-2 py-0.5 bg-surface-container border border-outline-variant rounded cursor-pointer hover:border-primary transition-colors">
                    <span className="font-ui-label text-[11px] text-primary">Local Shell (Next.js)</span>
                  </div>
                </div>
                <div className="flex items-center gap-3 text-on-surface-variant">
                  <span 
                    className="material-symbols-outlined text-[18px] cursor-pointer hover:text-primary transition-colors"
                    onClick={() => {
                      setTerminalLines([
                        { type: 'output', text: 'Terminal cleared.' }
                      ]);
                    }}
                    title="Clear Console"
                  >
                    block
                  </span>
                  <span 
                    className="material-symbols-outlined text-[18px] cursor-pointer hover:text-error transition-colors"
                    onClick={() => setIsTerminalOpen(false)}
                  >
                    close
                  </span>
                </div>
              </div>
              <div className="p-4 font-code-block text-console-text max-h-[250px] min-h-[150px] overflow-y-auto bg-surface-container-lowest select-text">
                <div className="flex flex-col gap-1.5 font-mono text-[12px] whitespace-pre-wrap">
                  {terminalLines.map((line, idx) => {
                    if (line.type === 'command') {
                      return (
                        <div key={idx} className="flex gap-2">
                          <span className="text-secondary font-bold shrink-0">user@collabcode:~/project$</span>
                          <span className="text-on-surface font-semibold">{line.text}</span>
                        </div>
                      );
                    } else if (line.type === 'error') {
                      return (
                        <div key={idx} className="text-error font-medium leading-relaxed mb-1">
                          {line.text}
                        </div>
                      );
                    } else {
                      return (
                        <div key={idx} className="text-on-surface-variant opacity-85 leading-relaxed mb-1">
                          {line.text}
                        </div>
                      );
                    }
                  })}
                  
                  {/* Current Active Input Prompt */}
                  <form onSubmit={handleTerminalSubmit} className="flex gap-2 items-center mt-1">
                    <span className="text-secondary font-bold shrink-0">user@collabcode:~/project$</span>
                    {isTerminalRunning ? (
                      <div className="flex items-center gap-2 text-outline text-[11px]">
                        <span className="animate-spin material-symbols-outlined text-[14px]">sync</span>
                        <span>Running command...</span>
                      </div>
                    ) : (
                      <input
                        type="text"
                        value={currentCommand}
                        onChange={(e) => setCurrentCommand(e.target.value)}
                        className="flex-1 bg-transparent border-none outline-none text-on-surface font-mono text-[12px] focus:ring-0 p-0"
                        placeholder="Type command and press Enter..."
                        autoFocus
                      />
                    )}
                  </form>
                  <div ref={terminalBottomRef} />
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Utility Status Bar */}
      <footer className="w-full h-6 bg-surface-container-lowest border-t border-outline-variant flex items-center justify-between px-4 z-50 shrink-0">
        <div className="flex items-center gap-4 text-[10px] font-ui-label text-outline uppercase tracking-tighter">
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-secondary"></span> Connected</span>
          <span className="flex items-center gap-1">RAM: 1.2GB / 8GB</span>
          <span className="flex items-center gap-1">GPU: Active</span>
          <div className="h-3 w-px bg-outline-variant mx-2"></div>
          <button 
            className={`flex items-center gap-1 hover:text-primary transition-colors ${isTerminalOpen ? 'text-primary' : ''}`}
            onClick={() => setIsTerminalOpen(!isTerminalOpen)}
          >
            <span className="material-symbols-outlined text-[14px]">terminal</span>
            <span>Terminal</span>
          </button>
        </div>
        <div className="flex items-center gap-4 text-[10px] font-ui-label text-outline">
          <span className="">UTF-8</span>
          <span className="">JDoodle Backend Ready</span>
          <span className="material-symbols-outlined text-[14px] cursor-pointer hover:text-on-surface transition-colors">notifications</span>
        </div>
      </footer>

      {/* Import Mode Modal */}
      {importModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex items-center justify-center" onClick={handleCancelImport}>
          <div
            className="bg-surface-container-highest border border-outline-variant rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden animate-in"
            onClick={(e) => e.stopPropagation()}
          >
            {!showOverwriteConfirm ? (
              <>
                {/* Modal Header */}
                <div className="flex items-center gap-3 px-6 py-4 border-b border-outline-variant">
                  <span className="material-symbols-outlined text-primary text-[24px]">upload_file</span>
                  <div>
                    <h3 className="font-ui-header text-on-surface font-bold text-base">Import Cells</h3>
                    <p className="font-ui-label text-[12px] text-outline mt-0.5">
                      {pendingImportCells.length} cell{pendingImportCells.length !== 1 ? 's' : ''} found in file
                    </p>
                  </div>
                </div>

                {/* Options */}
                <div className="p-4 flex flex-col gap-3">
                  <button
                    onClick={handleImportOverwrite}
                    className="flex items-center gap-4 w-full px-4 py-3.5 rounded-xl border border-outline-variant hover:border-error/50 hover:bg-error/5 transition-all text-left group"
                  >
                    <span className="material-symbols-outlined text-error text-[22px] group-hover:scale-110 transition-transform">swap_horiz</span>
                    <div>
                      <div className="font-ui-label text-on-surface font-semibold">Overwrite Current</div>
                      <div className="font-ui-label text-[11px] text-outline mt-0.5">Replace all existing cells with imported data</div>
                    </div>
                  </button>

                  <button
                    onClick={handleImportAppend}
                    className="flex items-center gap-4 w-full px-4 py-3.5 rounded-xl border border-outline-variant hover:border-secondary/50 hover:bg-secondary/5 transition-all text-left group"
                  >
                    <span className="material-symbols-outlined text-secondary text-[22px] group-hover:scale-110 transition-transform">playlist_add</span>
                    <div>
                      <div className="font-ui-label text-on-surface font-semibold">Append to End</div>
                      <div className="font-ui-label text-[11px] text-outline mt-0.5">Add imported cells after your existing work</div>
                    </div>
                  </button>
                </div>

                {/* Cancel */}
                <div className="px-4 pb-4">
                  <button
                    onClick={handleCancelImport}
                    className="w-full py-2 rounded-lg text-outline font-ui-label text-[13px] hover:bg-surface-variant transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </>
            ) : (
              <>
                {/* Overwrite Confirmation Warning */}
                <div className="flex items-center gap-3 px-6 py-4 border-b border-error/30 bg-error/5">
                  <span className="material-symbols-outlined text-error text-[24px]">warning</span>
                  <h3 className="font-ui-header text-error font-bold text-base">Confirm Overwrite</h3>
                </div>

                <div className="p-6">
                  <p className="font-ui-body text-on-surface-variant leading-relaxed">
                    This will <strong className="text-error">permanently replace</strong> all <strong>{cells.length}</strong> existing cell{cells.length !== 1 ? 's' : ''} with the <strong>{pendingImportCells.length}</strong> imported cell{pendingImportCells.length !== 1 ? 's' : ''}.
                  </p>
                  <p className="font-ui-body text-on-surface-variant leading-relaxed mt-2 text-[13px] text-outline">
                    Any unsaved code and text in your current session will be lost. This action cannot be undone.
                  </p>
                </div>

                <div className="flex gap-3 px-6 pb-5">
                  <button
                    onClick={() => setShowOverwriteConfirm(false)}
                    className="flex-1 py-2.5 rounded-lg border border-outline-variant font-ui-label font-semibold text-on-surface-variant hover:bg-surface-variant transition-colors"
                  >
                    Go Back
                  </button>
                  <button
                    onClick={handleConfirmOverwrite}
                    className="flex-1 py-2.5 rounded-lg bg-error text-on-primary font-ui-label font-semibold hover:brightness-110 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                  >
                    <span className="material-symbols-outlined text-[18px]">delete_sweep</span>
                    Overwrite
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Modern Interactive Help Modal */}
      {isHelpOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-[100] flex items-center justify-center p-4 animate-in fade-in duration-200" onClick={() => setIsHelpOpen(false)}>
          <div
            className="bg-surface-container-highest border border-outline-variant rounded-2xl shadow-2xl w-full max-w-4xl h-[600px] flex flex-col md:flex-row overflow-hidden animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Sidebar Navigation */}
            <div className="w-full md:w-64 bg-surface-container border-b md:border-b-0 md:border-r border-outline-variant p-5 flex flex-col justify-between shrink-0">
              <div className="flex flex-col gap-6">
                <div>
                  <div className="flex items-center gap-2 text-primary">
                    <span className="material-symbols-outlined text-[28px] font-bold">help_center</span>
                    <span className="font-ui-header text-lg font-bold text-on-surface">Help Center</span>
                  </div>
                  <p className="font-ui-label text-[11px] text-outline mt-1">CollabCode v1.0 User Guide</p>
                </div>
                
                <nav className="flex md:flex-col gap-1.5 overflow-x-auto md:overflow-x-visible pb-2 md:pb-0">
                  <button
                    onClick={() => setActiveHelpTab('overview')}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-xl font-ui-label text-[13px] font-semibold text-left transition-all whitespace-nowrap ${
                      activeHelpTab === 'overview'
                        ? 'bg-primary text-on-primary shadow-md shadow-primary/20'
                        : 'text-on-surface-variant hover:bg-surface-variant'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[18px]">dashboard</span>
                    <span>Workspace Overview</span>
                  </button>
                  <button
                    onClick={() => setActiveHelpTab('ai')}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-xl font-ui-label text-[13px] font-semibold text-left transition-all whitespace-nowrap ${
                      activeHelpTab === 'ai'
                        ? 'bg-primary text-on-primary shadow-md shadow-primary/20'
                        : 'text-on-surface-variant hover:bg-surface-variant'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[18px]">smart_toy</span>
                    <span>AI Code Assistant</span>
                  </button>
                  <button
                    onClick={() => setActiveHelpTab('share')}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-xl font-ui-label text-[13px] font-semibold text-left transition-all whitespace-nowrap ${
                      activeHelpTab === 'share'
                        ? 'bg-primary text-on-primary shadow-md shadow-primary/20'
                        : 'text-on-surface-variant hover:bg-surface-variant'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[18px]">ios_share</span>
                    <span>Sharing & Exports</span>
                  </button>
                  <button
                    onClick={() => setActiveHelpTab('shortcuts')}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-xl font-ui-label text-[13px] font-semibold text-left transition-all whitespace-nowrap ${
                      activeHelpTab === 'shortcuts'
                        ? 'bg-primary text-on-primary shadow-md shadow-primary/20'
                        : 'text-on-surface-variant hover:bg-surface-variant'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[18px]">keyboard</span>
                    <span>Shortcuts & Tips</span>
                  </button>
                </nav>
              </div>

              <div className="hidden md:block">
                <div className="p-3 bg-surface-container-low rounded-xl border border-outline-variant/50 text-[11px] text-outline leading-relaxed">
                  <div className="font-bold text-on-surface-variant mb-1">💡 Quick Tip</div>
                  You can double click the notebook title to customize the project name!
                </div>
              </div>
            </div>

            {/* Content Container */}
            <div className="flex-1 flex flex-col min-w-0 bg-surface-container-lowest">
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-outline-variant/60">
                <h3 className="font-ui-header text-on-surface font-bold text-base uppercase tracking-wider">
                  {activeHelpTab === 'overview' && 'Workspace & Core Features'}
                  {activeHelpTab === 'ai' && 'AI Code Analyser & Helper'}
                  {activeHelpTab === 'share' && 'Share, PNG & JSON Functions'}
                  {activeHelpTab === 'shortcuts' && 'Keyboard Shortcuts & Dev Tips'}
                </h3>
                <button
                  onClick={() => setIsHelpOpen(false)}
                  className="p-1 rounded-full hover:bg-surface-container-high transition-colors"
                >
                  <span className="material-symbols-outlined text-[20px] text-outline hover:text-on-surface">close</span>
                </button>
              </div>

              {/* Tab Content Body */}
              <div className="flex-1 p-6 overflow-y-auto font-ui-body text-sm leading-relaxed text-on-surface-variant">
                {activeHelpTab === 'overview' && (
                  <div className="flex flex-col gap-5 animate-in fade-in duration-200">
                    <p>
                      Welcome to <strong>CollabCode</strong>, an interactive notebook workspace to write, run, and document code blocks synchronously.
                    </p>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="p-4 bg-surface-container-low rounded-xl border border-outline-variant/40">
                        <div className="flex items-center gap-2 text-primary font-bold mb-2">
                          <span className="material-symbols-outlined text-[18px]">code</span>
                          <span>Run Code Cells</span>
                        </div>
                        <p className="text-[12px] text-outline">
                          Write Python or JavaScript scripts in code cells. Click the play button next to the cell to run code and view output instantly.
                        </p>
                      </div>

                      <div className="p-4 bg-surface-container-low rounded-xl border border-outline-variant/40">
                        <div className="flex items-center gap-2 text-secondary font-bold mb-2">
                          <span className="material-symbols-outlined text-[18px]">text_fields</span>
                          <span>Write Explanations</span>
                        </div>
                        <p className="text-[12px] text-outline">
                          Add text cells to format headers, bullet points, or markdown explanations to document your analysis.
                        </p>
                      </div>

                      <div className="p-4 bg-surface-container-low rounded-xl border border-outline-variant/40">
                        <div className="flex items-center gap-2 text-tertiary font-bold mb-2">
                          <span className="material-symbols-outlined text-[18px]">palette</span>
                          <span>Change Theme</span>
                        </div>
                        <p className="text-[12px] text-outline">
                          Toggle between Solarized Light and Space Dark modes using the theme switcher icon in the top right.
                        </p>
                      </div>

                      <div className="p-4 bg-surface-container-low rounded-xl border border-outline-variant/40">
                        <div className="flex items-center gap-2 text-on-surface font-bold mb-2">
                          <span className="material-symbols-outlined text-[18px]">terminal</span>
                          <span>Local Console</span>
                        </div>
                        <p className="text-[12px] text-outline">
                          Use the terminal drawer at the bottom to execute commands and view outputs in real time.
                        </p>
                      </div>
                    </div>

                    <div className="p-4 bg-secondary/5 border border-secondary/20 rounded-xl">
                      <div className="flex items-center gap-2 text-secondary font-bold mb-1">
                        <span className="material-symbols-outlined text-[18px]">lightbulb</span>
                        <span className="text-[12px]">Preloaded Examples</span>
                      </div>
                      <p className="text-[12px] text-outline">
                        The workspace comes preloaded with Python and Node.js code examples. You can test execution right away by clicking the Play icon on either cell.
                      </p>
                    </div>
                  </div>
                )}

                {activeHelpTab === 'ai' && (
                  <div className="flex flex-col gap-5 animate-in fade-in duration-200">
                    <p>
                      CollabCode includes a smart <strong>AI Code Assistant</strong> directly within the workspace to help explain, edit, and optimize your logic.
                    </p>

                    <div className="flex flex-col gap-4">
                      <div className="flex gap-3">
                        <span className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-[12px] shrink-0">1</span>
                        <div>
                          <h4 className="font-bold text-on-surface text-[13px]">Ask AI</h4>
                          <p className="text-[12px] text-outline">
                            On any code cell, type a custom instruction in the input field (e.g. "Create a fibonacci list") and press "Ask AI".
                          </p>
                        </div>
                      </div>

                      <div className="flex gap-3">
                        <span className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-[12px] shrink-0">2</span>
                        <div>
                          <h4 className="font-bold text-on-surface text-[13px]">Quick Actions</h4>
                          <p className="text-[12px] text-outline">
                            Use preset helper buttons (Explain Code, Debug, Optimize) to analyze the selected cell instantly.
                          </p>
                        </div>
                      </div>

                      <div className="flex gap-3">
                        <span className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-[12px] shrink-0">3</span>
                        <div>
                          <h4 className="font-bold text-on-surface text-[13px]">Safe Guard</h4>
                          <p className="text-[12px] text-outline">
                            If you attempt to ask the AI to explain or optimize an empty cell, the assistant will friendly remind you that the cell contains no code yet.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {activeHelpTab === 'share' && (
                  <div className="flex flex-col gap-5 animate-in fade-in duration-200">
                    <p>
                      Share your findings and save/load your workspace sessions seamlessly.
                    </p>

                    <div className="flex flex-col gap-3">
                      <div className="p-4 bg-surface-container-low rounded-xl border border-outline-variant/40 flex items-start gap-4">
                        <span className="material-symbols-outlined text-primary text-[24px]">photo_camera</span>
                        <div>
                          <h4 className="font-bold text-on-surface text-[13px]">Save Image (PNG)</h4>
                          <p className="text-[12px] text-outline mt-1">
                            Export your workspace cells as a single high-resolution image poster, styled cleanly using your current theme settings.
                          </p>
                          <p className="text-[11px] text-primary mt-1 font-semibold">
                            📁 The file will be named using your project title (e.g., <code>Data_Analysis_v1-[timestamp].png</code>).
                          </p>
                        </div>
                      </div>

                      <div className="p-4 bg-surface-container-low rounded-xl border border-outline-variant/40 flex items-start gap-4">
                        <span className="material-symbols-outlined text-secondary text-[24px]">data_object</span>
                        <div>
                          <h4 className="font-bold text-on-surface text-[13px]">Backup Session (JSON)</h4>
                          <p className="text-[12px] text-outline mt-1">
                            Download the raw cell structure and code data to your computer. Import it back using the <strong>Insert</strong> button at the top header to append cells or replace your workspace.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {activeHelpTab === 'shortcuts' && (
                  <div className="flex flex-col gap-5 animate-in fade-in duration-200">
                    <p>
                      Use keyboard shortcuts to work efficiently inside CollabCode.
                    </p>

                    <div className="border border-outline-variant/60 rounded-xl overflow-hidden">
                      <table className="w-full text-left text-[12px] border-collapse">
                        <thead>
                          <tr className="bg-surface-container border-b border-outline-variant">
                            <th className="p-3 font-semibold text-on-surface">Action</th>
                            <th className="p-3 font-semibold text-on-surface">Shortcut</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr className="border-b border-outline-variant/40">
                            <td className="p-3">Run Selected Cell</td>
                            <td className="p-3"><kbd className="px-2 py-1 bg-surface-container rounded border border-outline-variant font-mono">Ctrl + Enter</kbd></td>
                          </tr>
                          <tr className="border-b border-outline-variant/40">
                            <td className="p-3">Switch Theme Mode</td>
                            <td className="p-3">Click the Sun/Moon toggle icon in the header</td>
                          </tr>
                          <tr className="border-b border-outline-variant/40">
                            <td className="p-3">Open/Close Terminal drawer</td>
                            <td className="p-3">Click the Terminal button in the footer bar</td>
                          </tr>
                          <tr>
                            <td className="p-3">Rename Project</td>
                            <td className="p-3">Click the project title at the top left to edit</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>

                    <div className="p-4 bg-surface-container-low rounded-xl border border-outline-variant/40 mt-1">
                      <div className="font-bold text-on-surface text-[13px] mb-1">🔧 Troubleshooting Connection</div>
                      <p className="text-[12px] text-outline leading-relaxed">
                        If code execution takes too long, check the bottom-left status bar to confirm you are connected, and check that the server status says "Connected/Ready".
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="px-6 py-4 bg-surface-container-low border-t border-outline-variant/50 flex justify-between items-center shrink-0">
                <span className="text-[11px] text-outline">Press ESC or click outside to dismiss this window.</span>
                <button
                  onClick={() => setIsHelpOpen(false)}
                  className="px-4 py-1.5 bg-primary text-on-primary font-ui-label text-[12px] font-semibold rounded-lg hover:opacity-90 active:scale-95 transition-all"
                >
                  Got it
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

