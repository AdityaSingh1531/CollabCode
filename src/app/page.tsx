'use client';

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useTheme } from '@/components/ThemeProvider';
import CodeCell from '@/components/CodeCell';
import TextCell from '@/components/TextCell';
import { Share2, Settings, UserCircle, Sun, Moon, HelpCircle, FilePlus, CheckCircle2, Activity, Zap, Bell, PlusCircle, Type, Trash2, X, Copy, Sparkles, AlertCircle, TrendingUp, Maximize2, Info, PlayCircle, Save } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

export default function CollabCodeIDE() {
  const { isDark, toggleTheme } = useTheme();

  // State for title
  const [title, setTitle] = useState("Data Analysis v1");
  const [isEditingTitle, setIsEditingTitle] = useState(false);

  // State for notebook cells
  const [cells, setCells] = useState<Array<{ id: string; type: 'code' | 'text'; language?: string; code?: string; content?: string; stdin?: string }>>([    { id: '1', type: 'code', language: 'python3', code: '', stdin: '' },
    { id: '2', type: 'code', language: 'nodejs', code: '', stdin: '' }
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
  const [pendingImportCells, setPendingImportCells] = useState<Array<{ id: string; type: 'code' | 'text'; language?: string; code?: string; content?: string; stdin?: string }>>([]);
  const [showOverwriteConfirm, setShowOverwriteConfirm] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [activeHelpTab, setActiveHelpTab] = useState<'overview' | 'ai' | 'share' | 'shortcuts'>('overview');

  // Audio instances ref for preloading to prevent lag
  const audioRefs = useRef<{ [key: string]: HTMLAudioElement }>({});

  // --- Persistence & Run All state ---
  const [showSavedToast, setShowSavedToast] = useState(false);
  const [cellRunTriggers, setCellRunTriggers] = useState<Record<string, number>>({});
  const [runAllQueue, setRunAllQueue] = useState<string[]>([]);
  const [isRunningAll, setIsRunningAll] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const [loadingText, setLoadingText] = useState('Initializing compiler environments...');

  // Set up loop for Pop sound during loading
  useEffect(() => {
    let popAudio: HTMLAudioElement | null = null;
    let textInterval: NodeJS.Timeout;
    
    if (typeof window !== 'undefined' && !isLoaded) {
      popAudio = new Audio('/Sound-eff/Pop1_Pop2_pop3.mp3.mpeg');
      popAudio.loop = true;
      popAudio.volume = 0.4;
      popAudio.play().catch(e => console.log('Autoplay pop sound blocked:', e));

      // Cycle loading messages for rich UX
      const texts = [
        'Initializing compiler environments...',
        'Connecting to execution servers...',
        'Synchronizing with JDoodle core...',
        'Optimizing editor workspace...',
        'Rendering interface modules...'
      ];
      let idx = 0;
      textInterval = setInterval(() => {
        idx = (idx + 1) % texts.length;
        setLoadingText(texts[idx]);
      }, 800);
    }

    const timer = setTimeout(() => {
      setIsLoaded(true);
      if (popAudio) {
        popAudio.pause();
      }
    }, 4000); // 4 seconds loading screen to simulate loading

    return () => {
      clearTimeout(timer);
      if (textInterval) clearInterval(textInterval);
      if (popAudio) {
        popAudio.pause();
      }
    };
  }, [isLoaded]);

  useEffect(() => {
    // Preload audio files on mount
    if (typeof window !== 'undefined') {
      audioRefs.current.bubble = new Audio('/Sound-eff/bubble.mp3.mpeg');
      audioRefs.current.bubble.preload = 'auto';
      audioRefs.current.pop = new Audio('/Sound-eff/Pop1_Pop2_pop3.mp3.mpeg');
      audioRefs.current.pop.preload = 'auto';
      audioRefs.current.correct = new Audio('/Sound-eff/correct.mp3');
      audioRefs.current.correct.preload = 'auto';
      audioRefs.current.error = new Audio('/Sound-eff/error.mp3');
      audioRefs.current.error.preload = 'auto';
    }
  }, []);

  // Sound effects logic
  const playSound = useCallback((type: 'bubble' | 'pop' | 'correct' | 'error') => {
    try {
      const audio = audioRefs.current[type];
      if (audio) {
        // Clone the node to allow overlapping sounds without fetching again
        const clone = audio.cloneNode(true) as HTMLAudioElement;
        clone.volume = 0.5;
        clone.play().catch(e => console.log('Audio play failed (maybe autoplay policy):', e));
      }
    } catch (e) {
      console.error('Failed to play sound:', e);
    }
  }, []);

  // Global Button Click Sound (excluding Run button)
  useEffect(() => {
    const handleGlobalClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      // Play bubble sound if a button or something acting like a button is clicked
      const button = target.closest('button') || target.closest('[role="button"]') || (target.tagName.toLowerCase() === 'button' ? target : null);
      if (button) {
        // Exclude Run button
        if (
          button.getAttribute('data-run-btn') === 'true' || 
          button.textContent?.trim() === 'Run' || 
          button.textContent?.trim() === 'Running...'
        ) {
          return;
        }
        playSound('bubble');
      }
    };
    document.addEventListener('click', handleGlobalClick, true);
    return () => document.removeEventListener('click', handleGlobalClick, true);
  }, [playSound]);

  // State for AI Sidebar
  const [isAiSidebarOpen, setIsAiSidebarOpen] = useState(false);
  const [activeCellIdForAi, setActiveCellIdForAi] = useState<string | null>(null);
  const [aiQuery, setAiQuery] = useState('');
  const [lastQuery, setLastQuery] = useState('');
  const [aiResponse, setAiResponse] = useState('');
  const [isAiLoading, setIsAiLoading] = useState(false);

  const handleOpenAiSidebar = (cellId: string) => {
    setActiveCellIdForAi(cellId);
    setIsAiSidebarOpen(true);
  };

  const closeAiSidebar = () => {
    setIsAiSidebarOpen(false);
    setActiveCellIdForAi(null);
  };

  const handleAiAnalyze = async (customPrompt?: string) => {
    const promptToSend = customPrompt || aiQuery;
    if (!promptToSend.trim() && !customPrompt) return;
    const activeCell = cells.find(c => c.id === activeCellIdForAi);
    if (!activeCell || activeCell.type !== 'code') return;
    
    setLastQuery(promptToSend);
    setIsAiLoading(true);
    setAiResponse('');
    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: activeCell.code || '',
          language: activeCell.language || 'python3',
          prompt: promptToSend
        })
      });
      if (!res.ok) throw new Error(`API error: ${res.status}`);
      const data = await res.json();
      setAiResponse(data.response);
    } catch (err: any) {
      setAiResponse(`❌ Error generating response: ${err.message || 'Unknown network error'}`);
    } finally {
      setIsAiLoading(false);
    }
  };

  // Close share dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (shareRef.current && !shareRef.current.contains(e.target as Node)) {
        setIsShareOpen(false);
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  // LocalStorage: load saved notebook when app finishes loading
  useEffect(() => {
    if (!isLoaded) return;
    try {
      const saved = localStorage.getItem('collabcode-notebook');
      if (saved) {
        const { cells: savedCells, title: savedTitle } = JSON.parse(saved);
        if (Array.isArray(savedCells) && savedCells.length > 0) setCells(savedCells);
        if (savedTitle) setTitle(savedTitle);
      }
    } catch (e) {
      console.warn('Could not restore notebook from localStorage:', e);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoaded]);

  // LocalStorage: debounced auto-save on every cells/title change
  useEffect(() => {
    if (!isLoaded) return;
    const timer = setTimeout(() => {
      try {
        localStorage.setItem('collabcode-notebook', JSON.stringify({ cells, title }));
        setShowSavedToast(true);
        setTimeout(() => setShowSavedToast(false), 2000);
      } catch (e) {
        console.warn('Auto-save failed:', e);
      }
    }, 600);
    return () => clearTimeout(timer);
  }, [cells, title, isLoaded]);

  // Ctrl+S → force-save immediately
  useEffect(() => {
    const handleCtrlS = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        try {
          localStorage.setItem('collabcode-notebook', JSON.stringify({ cells, title }));
          setShowSavedToast(true);
          setTimeout(() => setShowSavedToast(false), 2000);
        } catch (e) {
          console.warn('Save failed:', e);
        }
      }
    };
    document.addEventListener('keydown', handleCtrlS);
    return () => document.removeEventListener('keydown', handleCtrlS);
  }, [cells, title]);

  const addCodeCell = () => {
    const newId = Date.now().toString();
    setCells([...cells, { id: newId, type: 'code', language: 'python3', code: '', stdin: '' }]);
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

  const handleStdinChange = useCallback((id: string, stdin: string) => {
    setCells(prev => prev.map(c => c.id === id ? { ...c, stdin } : c));
  }, []);

  const handleTextContentChange = useCallback((id: string, content: string) => {
    setCells(prev => prev.map(c => c.id === id ? { ...c, content } : c));
  }, []);

  // --- Cell Reorder ---
  const moveCellUp = useCallback((id: string) => {
    setCells(prev => {
      const idx = prev.findIndex(c => c.id === id);
      if (idx <= 0) return prev;
      const next = [...prev];
      [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
      return next;
    });
  }, []);

  const moveCellDown = useCallback((id: string) => {
    setCells(prev => {
      const idx = prev.findIndex(c => c.id === id);
      if (idx >= prev.length - 1) return prev;
      const next = [...prev];
      [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
      return next;
    });
  }, []);

  // --- Run All Cells (sequential via onExecutionComplete queue) ---
  const handleRunAll = useCallback(() => {
    const codeCellIds = cells.filter(c => c.type === 'code').map(c => c.id);
    if (codeCellIds.length === 0) return;
    setIsRunningAll(true);
    const [first, ...rest] = codeCellIds;
    setRunAllQueue(rest);
    setCellRunTriggers(prev => ({ ...prev, [first]: (prev[first] || 0) + 1 }));
  }, [cells]);

  // Called when any cell completes execution
  const handleCellExecutionComplete = useCallback((cellId: string, success: boolean) => {
    if (success) playSound('correct');
    else playSound('error');
    // Advance Run All queue
    setRunAllQueue(prev => {
      if (prev.length === 0) {
        setIsRunningAll(false);
        return [];
      }
      const [next, ...rest] = prev;
      setCellRunTriggers(t => ({ ...t, [next]: (t[next] || 0) + 1 }));
      if (rest.length === 0) setIsRunningAll(false);
      return rest;
    });
  }, [playSound]);

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
        return { type: 'code', language: cell.language || 'python3', code: cell.code || '', stdin: cell.stdin || '' };
      } else {
        return { type: 'text', content: cell.content || '' };
      }
    });
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const link = document.createElement('a');
    const safeTitle = title.replace(/[^a-zA-Z0-9_-]/g, '_');
    const ts = new Date().toISOString().replace(/[:.]/g, '-');
    link.download = `${safeTitle}-${ts}-code.json`;
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
            return { id: newId, type: 'code' as const, language: item.language || 'python3', code: item.code || '', stdin: item.stdin || '' };
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

  if (!isLoaded) {
    return (
      <div className="flex flex-col items-center justify-center h-screen w-screen bg-[#0b1326] text-white font-ui-body relative overflow-hidden select-none">
        {/* Background glow effects */}
        <div className="absolute top-1/4 left-1/4 w-[350px] h-[350px] bg-primary/15 rounded-full blur-[100px] animate-pulse"></div>
        <div className="absolute bottom-1/4 right-1/4 w-[350px] h-[350px] bg-secondary/20 rounded-full blur-[100px] animate-pulse" style={{ animationDelay: '1s' }}></div>

        {/* Content container */}
        <div className="z-10 flex flex-col items-center gap-6 max-w-sm text-center px-6">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-primary to-secondary flex items-center justify-center shadow-xl shadow-primary/20 animate-bounce">
            <Sparkles size={32} className="text-white" strokeWidth={2.5} />
          </div>
          
          <div className="flex flex-col gap-2">
            <h1 className="font-ui-header text-[26px] font-bold tracking-tight bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
              CollabCode
            </h1>
            <p className="font-ui-label text-[13px] text-outline/80 font-medium tracking-wide">
              POWERFUL COLLABORATIVE IDE
            </p>
          </div>

          {/* Glowing loader bar */}
          <div className="w-64 h-1.5 bg-surface-container rounded-full overflow-hidden border border-outline-variant/30 mt-4 shadow-inner relative">
            <div className="h-full bg-gradient-to-r from-primary via-secondary to-primary w-1/2 rounded-full animate-infinite-slide absolute left-0 top-0"></div>
          </div>

          <p className="font-ui-label text-[12px] text-outline/60 mt-2 font-medium animate-pulse">
            {loadingText}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-background text-on-background font-ui-body selection:bg-primary/30">
      {/* TopNavBar */}
      <header className="flex items-center justify-between w-full h-12 px-4 bg-surface-container/90 backdrop-blur-md border-b border-outline-variant shrink-0 z-50">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-primary/10 text-primary">
              <Sparkles size={16} strokeWidth={2.5} />
            </div>
            <span className="font-ui-header text-[15px] font-bold text-on-surface tracking-tight">CollabCode</span>
            <div className="h-5 w-px bg-outline-variant mx-1"></div>
            {isEditingTitle ? (
              <input
                autoFocus
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onBlur={handleTitleSubmit}
                onKeyDown={handleTitleSubmit}
                className="bg-surface border border-primary/50 rounded px-2 py-0.5 text-[13px] font-ui-header text-on-surface focus:outline-none focus:ring-1 focus:ring-primary/40 transition-all shadow-sm"
              />
            ) : (
              <span 
                className="font-ui-header text-[13px] font-medium text-on-surface-variant hover:text-primary cursor-pointer transition-colors duration-200"
                onClick={() => setIsEditingTitle(true)}
                title="Click to rename"
              >
                {title}
              </span>
            )}
          </div>
          <nav className="hidden md:flex items-center gap-1 ml-4">
            {['File', 'Edit', 'View', 'Runtime', 'Tools'].map(item => (
              <span key={item} className="font-ui-label text-[12px] text-on-surface-variant font-medium cursor-pointer hover:bg-surface-variant hover:text-on-surface px-2.5 py-1 rounded-md transition-all duration-200">{item}</span>
            ))}
            <span 
              onClick={() => setIsHelpOpen(true)}
              className="font-ui-label text-[12px] text-primary font-medium cursor-pointer hover:bg-primary/10 px-2.5 py-1 rounded-md transition-all duration-200 flex items-center gap-1.5 ml-1"
            >
              <HelpCircle size={14} />
              Help
            </span>
            <button
              onClick={() => { handleFileInputClick(); fileInputRef.current?.click(); }}
              className="font-ui-label text-[12px] text-on-surface-variant font-medium cursor-pointer hover:bg-surface-variant hover:text-on-surface px-2.5 py-1 rounded-md transition-all duration-200 flex items-center gap-1.5"
            >
              <FilePlus size={14} />
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
        <div className="flex items-center gap-3">
          {/* Share Dropdown */}
          <div className="relative" ref={shareRef}>
            <button
              onClick={() => setIsShareOpen(!isShareOpen)}
              className="bg-primary text-on-primary font-ui-label text-[12px] px-3.5 py-1.5 rounded-lg transition-all duration-200 font-semibold flex items-center gap-1.5 hover:brightness-110 active:brightness-95 shadow-sm shadow-primary/20"
            >
              <Share2 size={14} />
              Share
            </button>
            {isShareOpen && (
              <div className="absolute right-0 top-full mt-2 w-64 glass-panel rounded-xl shadow-xl z-50 overflow-hidden animate-in fade-in duration-150">
                <button
                  onClick={handleExportPng}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-primary/10 transition-colors text-left group border-b border-outline-variant/30"
                >
                  <Maximize2 size={18} className="text-primary" />
                  <div>
                    <div className="font-ui-label text-[13px] text-on-surface font-semibold group-hover:text-primary transition-colors">Export as PNG</div>
                    <div className="font-ui-label text-[11px] text-outline mt-0.5">Screenshot all cells</div>
                  </div>
                </button>
                <button
                  onClick={handleExportJson}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-secondary/10 transition-colors text-left group"
                >
                  <FilePlus size={18} className="text-secondary" />
                  <div>
                    <div className="font-ui-label text-[13px] text-on-surface font-semibold group-hover:text-secondary transition-colors">Export as JSON</div>
                    <div className="font-ui-label text-[11px] text-outline mt-0.5">Code &amp; text data</div>
                  </div>
                </button>
              </div>
            )}
          </div>
          <div className="h-5 w-px bg-outline-variant/60 mx-1"></div>
          <div className="flex items-center gap-1 text-on-surface-variant">
            <button 
              className="p-1.5 rounded-md hover:bg-surface-variant hover:text-primary transition-colors"
              onClick={toggleTheme}
              title="Toggle Theme"
            >
              {isDark ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            <button className="p-1.5 rounded-md hover:bg-surface-variant hover:text-primary transition-colors" title="Settings">
              <Settings size={18} />
            </button>
            <button className="p-1.5 rounded-md hover:bg-surface-variant hover:text-primary transition-colors" title="Profile">
              <UserCircle size={20} />
            </button>
          </div>
        </div>
      </header>

      {/* Sidebar & Main Content */}
      <div className="flex flex-1 overflow-hidden relative">
      {/* Main Workspace Canvas */}
        <main className="flex-1 flex flex-col bg-background overflow-y-auto scroll-smooth relative">
          <div ref={notebookRef} className="max-w-5xl mx-auto w-full p-6 flex flex-col pb-16">
            
            {/* Render Reusable Code and Text Cells */}
            <div id="notebook-cells" className="flex flex-col gap-5 mb-0">
              {cells.map((cell, cellIdx) => {
                if (cell.type === 'code') {
                  return (
                      <CodeCell 
                        key={cell.id} 
                        id={cell.id} 
                        initialCode={cell.code}
                        initialLanguage={cell.language} 
                        initialStdin={cell.stdin}
                        onDelete={() => deleteCell(cell.id)}
                        onCodeChange={(code) => handleCodeChange(cell.id, code)}
                        onLanguageChange={(lang) => handleLanguageChange(cell.id, lang)}
                        onStdinChange={(stdin) => handleStdinChange(cell.id, stdin)}
                        onAiHelper={() => handleOpenAiSidebar(cell.id)}
                        onExecutionComplete={(success) => handleCellExecutionComplete(cell.id, success)}
                        onMoveUp={() => moveCellUp(cell.id)}
                        onMoveDown={() => moveCellDown(cell.id)}
                        isFirst={cellIdx === 0}
                        isLast={cellIdx === cells.length - 1}
                        runTrigger={cellRunTriggers[cell.id] || 0}
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
            <div className="flex justify-center mt-5">
              <div className="bg-surface-container-highest/85 backdrop-blur-md border border-outline-variant/60 rounded-full px-5 py-2 flex items-center gap-4 shadow-2xl transition-all duration-300">
                <button 
                  onClick={addCodeCell}
                  className="flex items-center gap-2 cursor-pointer group bg-transparent border-none text-left px-3 py-1.5 rounded-full hover:bg-primary/10 transition-all duration-200"
                >
                  <PlusCircle size={18} className="text-primary" />
                  <span className="font-ui-label text-[13px] text-on-surface-variant group-hover:text-primary transition-colors font-semibold">Code Cell</span>
                </button>
                <div className="h-5 w-px bg-outline-variant/60"></div>
                <button 
                  onClick={addTextCell}
                  className="flex items-center gap-2 cursor-pointer group bg-transparent border-none text-left px-3 py-1.5 rounded-full hover:bg-surface-variant transition-all duration-200"
                >
                  <Type size={18} className="text-on-surface-variant" />
                  <span className="font-ui-label text-[13px] text-on-surface-variant group-hover:text-on-surface transition-colors font-semibold">Text Cell</span>
                </button>
                <div className="h-5 w-px bg-outline-variant/60"></div>
                <button
                  onClick={handleRunAll}
                  disabled={isRunningAll || cells.filter(c => c.type === 'code').length === 0}
                  className="flex items-center gap-2 cursor-pointer group bg-transparent border-none text-left px-3 py-1.5 rounded-full hover:bg-secondary/10 transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
                  title="Run all code cells sequentially"
                >
                  <PlayCircle size={18} className={`${isRunningAll ? 'text-secondary animate-pulse' : 'text-secondary'}`} />
                  <span className="font-ui-label text-[13px] text-on-surface-variant group-hover:text-secondary transition-colors font-semibold">
                    {isRunningAll ? 'Running All...' : 'Run All'}
                  </span>
                </button>
                <div className="h-5 w-px bg-outline-variant/60"></div>
                <button 
                  onClick={clearAllCells}
                  className="flex items-center gap-2 cursor-pointer group bg-transparent border-none text-left px-3 py-1.5 rounded-full hover:bg-error/10 transition-all duration-200"
                >
                  <Trash2 size={18} className="text-error" />
                  <span className="font-ui-label text-[13px] text-on-surface-variant group-hover:text-error transition-colors font-semibold">Clear All</span>
                </button>
              </div>
            </div>
          </div>


        </main>

        {/* Right-Hand AI Sidebar */}
        {isAiSidebarOpen && (
          <aside className="w-96 flex-shrink-0 bg-surface-container-lowest border-l border-outline-variant flex flex-col z-40 transition-all animate-in slide-in-from-right duration-200">
            <div className="flex items-center justify-between px-5 h-14 border-b border-outline-variant/60 bg-surface-container/50 backdrop-blur-md">
              <div className="flex items-center gap-2 text-primary">
                <Sparkles size={18} />
                <span className="font-ui-header text-[14px] font-bold tracking-tight">AI Assistant</span>
              </div>
              <button 
                onClick={closeAiSidebar}
                className="p-1.5 rounded-lg text-outline hover:text-on-surface hover:bg-surface-variant transition-colors"
                title="Close AI Sidebar"
              >
                <X size={18} />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-6 scroll-smooth">
              <div className="flex flex-col gap-2">
                <div className="font-ui-label text-[10px] font-bold text-outline uppercase tracking-widest">Context</div>
                <div className="px-3 py-2 bg-surface-container rounded-lg border border-outline-variant/30 flex items-center justify-between shadow-sm">
                  <div className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse"></div>
                    <span className="font-code-block text-[11px] text-on-surface-variant font-medium">Cell {activeCellIdForAi}</span>
                  </div>
                  <span className="text-[10px] font-ui-label text-outline bg-surface-container-high px-2 py-0.5 rounded-md">Python</span>
                </div>
              </div>

              {/* Chat Thread */}
              <div className="flex flex-col gap-6 flex-1">
                {!lastQuery && !isAiLoading && !aiResponse && (
                  <div className="flex flex-col items-center justify-center h-full gap-4 text-center px-4 opacity-70">
                    <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary mb-2">
                      <Sparkles size={24} />
                    </div>
                    <h3 className="font-ui-header text-[15px] text-on-surface font-semibold">How can I help?</h3>
                    <p className="font-ui-body text-[12px] text-on-surface-variant leading-relaxed">
                      Ask me to explain code, find bugs, or suggest performance optimizations for the active cell.
                    </p>
                    {/* Quick Actions */}
                    <div className="flex flex-col w-full gap-2 mt-4">
                      <button 
                        onClick={() => handleAiAnalyze('Explain this code step by step')}
                        className="flex items-center justify-between w-full px-4 py-2.5 rounded-xl bg-surface-container border border-outline-variant/40 hover:bg-primary/5 hover:border-primary/30 transition-all text-left group shadow-sm"
                      >
                        <span className="text-[12px] font-ui-label text-on-surface font-medium group-hover:text-primary transition-colors">Explain code</span>
                        <Info size={14} className="text-outline group-hover:text-primary transition-colors" />
                      </button>
                      <button 
                        onClick={() => handleAiAnalyze('Find any bugs or issues in this code')}
                        className="flex items-center justify-between w-full px-4 py-2.5 rounded-xl bg-surface-container border border-outline-variant/40 hover:bg-error/5 hover:border-error/30 transition-all text-left group shadow-sm"
                      >
                        <span className="text-[12px] font-ui-label text-on-surface font-medium group-hover:text-error transition-colors">Check for bugs</span>
                        <AlertCircle size={14} className="text-outline group-hover:text-error transition-colors" />
                      </button>
                      <button 
                        onClick={() => handleAiAnalyze('Suggest ways to optimize this code')}
                        className="flex items-center justify-between w-full px-4 py-2.5 rounded-xl bg-surface-container border border-outline-variant/40 hover:bg-secondary/5 hover:border-secondary/30 transition-all text-left group shadow-sm"
                      >
                        <span className="text-[12px] font-ui-label text-on-surface font-medium group-hover:text-secondary transition-colors">Optimize performance</span>
                        <TrendingUp size={14} className="text-outline group-hover:text-secondary transition-colors" />
                      </button>
                    </div>
                  </div>
                )}

                {lastQuery && (
                  <div className="self-end bg-primary text-on-primary px-4 py-3 rounded-2xl rounded-tr-sm max-w-[85%] text-[13px] font-ui-body shadow-md animate-in slide-in-from-right-2 fade-in duration-200">
                    {lastQuery}
                  </div>
                )}

                {(isAiLoading || aiResponse) && (
                  <div className="flex flex-col gap-3 max-w-[95%] animate-in slide-in-from-left-2 fade-in duration-300">
                    <div className="flex items-center gap-2 ml-1">
                      <div className="w-6 h-6 rounded-lg bg-surface-variant flex items-center justify-center text-primary shadow-sm border border-outline-variant/50">
                        <Sparkles size={12} />
                      </div>
                      <span className="font-ui-header text-[12px] font-semibold text-on-surface">CollabCode AI</span>
                    </div>

                    <div className="glass-panel bg-surface-container/60 border border-outline-variant/50 rounded-2xl rounded-tl-sm p-0 shadow-lg overflow-hidden flex flex-col backdrop-blur-xl">
                      {isAiLoading ? (
                        <div className="flex items-center gap-3 p-5">
                          <Activity size={16} className="animate-spin text-primary" />
                          <span className="font-ui-body text-[13px] text-on-surface-variant">Analyzing your code...</span>
                        </div>
                      ) : (
                        <>
                          {/* Main Response Content */}
                          <div className="p-5 prose prose-sm dark:prose-invert max-w-none font-ui-body text-[13px] text-on-surface-variant leading-relaxed prose-headings:font-ui-header prose-headings:text-on-surface prose-headings:font-semibold prose-p:my-2 prose-pre:my-4 prose-pre:bg-[#0d1117] prose-pre:border prose-pre:border-white/10 prose-pre:rounded-xl prose-pre:shadow-inner prose-pre:text-[12px] prose-code:text-primary prose-code:bg-primary/10 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded-md prose-code:font-code-block prose-code:before:content-none prose-code:after:content-none">
                            <ReactMarkdown remarkPlugins={[remarkGfm]}>
                              {aiResponse}
                            </ReactMarkdown>
                          </div>
                          
                          {/* Footer Actions */}
                          <div className="bg-surface-container-low border-t border-outline-variant/40 px-3 py-2.5 flex items-center gap-2 overflow-x-auto">
                            <button
                              onClick={() => {
                                navigator.clipboard.writeText(aiResponse);
                                playSound('bubble');
                              }}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-ui-label font-medium text-on-surface-variant hover:text-on-surface hover:bg-surface-variant transition-colors"
                            >
                              <Copy size={13} /> Copy
                            </button>
                            <div className="w-px h-3 bg-outline-variant/50"></div>
                            <button
                              onClick={() => handleAiAnalyze(lastQuery)}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-ui-label font-medium text-on-surface-variant hover:text-on-surface hover:bg-surface-variant transition-colors"
                            >
                              <Activity size={13} /> Regenerate
                            </button>
                            <div className="w-px h-3 bg-outline-variant/50"></div>
                            <button
                              onClick={() => handleAiAnalyze('Explain this answer further')}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-ui-label font-medium text-on-surface-variant hover:text-on-surface hover:bg-surface-variant transition-colors"
                            >
                              <Info size={13} /> Explain
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Chat Input Footer */}
              <div className="mt-auto pt-4 border-t border-outline-variant/30">
                <div className="relative group">
                  <textarea 
                    value={aiQuery}
                    onChange={(e) => setAiQuery(e.target.value)}
                    placeholder="Ask a follow-up question..."
                    className="w-full bg-surface-container border border-outline-variant/60 rounded-xl pl-4 pr-12 py-3.5 text-[13px] text-on-surface focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all resize-none shadow-sm group-hover:border-outline-variant"
                    rows={1}
                    style={{ minHeight: '52px', maxHeight: '150px' }}
                    onKeyDown={(e) => { 
                      if (e.key === 'Enter' && !e.shiftKey) { 
                        e.preventDefault(); 
                        handleAiAnalyze(); 
                        setAiQuery(''); // Clear input after submit
                      } 
                    }}
                  />
                  <button 
                    onClick={() => { handleAiAnalyze(); setAiQuery(''); }}
                    disabled={isAiLoading || !aiQuery.trim()}
                    className="absolute right-2 bottom-2 p-2 rounded-lg bg-primary text-on-primary disabled:opacity-50 disabled:bg-surface-variant disabled:text-outline hover:brightness-110 transition-all shadow-sm flex items-center justify-center"
                  >
                    <Sparkles size={16} />
                  </button>
                </div>
                <div className="text-center mt-2">
                  <span className="text-[10px] font-ui-label text-outline font-medium">AI can make mistakes. Verify code before executing.</span>
                </div>
              </div>
            </div>
          </aside>
        )}
      </div>

      {/* Auto-save Toast */}
      <div className={`fixed bottom-12 right-4 z-[200] flex items-center gap-2 bg-surface-container-highest border border-outline-variant/60 px-3 py-2 rounded-lg shadow-lg text-[12px] font-ui-label text-on-surface transition-all duration-300 ${showSavedToast ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2 pointer-events-none'}`}>
        <Save size={13} className="text-secondary" />
        <span>Notebook saved</span>
      </div>

      {/* Utility Status Bar */}
      <footer className="w-full h-8 bg-surface-container-low border-t border-outline-variant flex items-center justify-between px-4 z-50 shrink-0">
        <div className="flex items-center gap-5 text-[11px] font-ui-label text-on-surface-variant font-medium">
          <span className="flex items-center gap-2 text-secondary">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-secondary opacity-40"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-secondary"></span>
            </span>
            Connected
          </span>
          <span className="flex items-center gap-1.5"><Activity size={14} /> RAM: 1.2GB / 8GB</span>
          <span className="flex items-center gap-1.5"><Zap size={14} className="text-amber-500" /> GPU: Active</span>

        </div>
        <div className="flex items-center gap-4 text-[11px] font-ui-label text-on-surface-variant font-medium">
          <span>UTF-8</span>
          <span className="flex items-center gap-1.5"><CheckCircle2 size={14} className="text-secondary" /> JDoodle Ready</span>
          <span className="flex items-center gap-1 text-outline/60" title="Ctrl+S to save">
            <Save size={12} /> Auto-saved
          </span>
          <button className="hover:text-primary transition-colors">
            <Bell size={14} />
          </button>
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

