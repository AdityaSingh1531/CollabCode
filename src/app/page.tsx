'use client';

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useTheme } from '@/components/ThemeProvider';
import CodeCell from '@/components/CodeCell';
import TextCell from '@/components/TextCell';
import { Share2, Settings, UserCircle, Sun, Moon, HelpCircle, FilePlus, CheckCircle2, Activity, Zap, Bell, Trash2, X, Copy, Sparkles, AlertCircle, TrendingUp, Maximize2, Info, Play, Save, History } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import InsertBar from '@/components/InsertBar';
import FocusMusicWidget from '@/components/FocusMusicWidget';
import LoginModal from '@/components/LoginModal';
import DataSourcesSidebar from '@/components/DataSourcesSidebar';

/* ── Virtual file injection ────────────────────────────────────────────────────
   Generates code that, when prepended to the user's script, creates a real file
   in JDoodle's sandbox FS so `open('filename')` works normally.
──────────────────────────────────────────────────────────────────────────────── */
function generateFileInjectionCode(content: string, filename: string, language: string): string {
  // UTF-8 → binary → base64
  const bytes = new TextEncoder().encode(content);
  let binary = '';
  bytes.forEach(b => { binary += String.fromCharCode(b); });
  const b64 = btoa(binary);

  const banner  = `# ── CollabCode: "${filename}" injected as virtual file ──`;
  const divider = `# ──────────────────────────────────────────────────────`;

  switch (language) {
    case 'python3':
      return [
        banner,
        `import base64 as _b64`,
        `with open('${filename}', 'wb') as _fh:`,
        `    _fh.write(_b64.b64decode('${b64}'))`,
        `del _b64, _fh`,
        divider,
        ``,
        ``,
      ].join('\n');

    case 'nodejs':
      return [
        `// ── CollabCode: "${filename}" injected as virtual file ──`,
        `require('fs').writeFileSync('${filename}', Buffer.from('${b64}', 'base64'));`,
        `// ──────────────────────────────────────────────────────`,
        ``,
        ``,
      ].join('\n');

    case 'cpp17': {
      // Raw-string literal approach (safe for text files)
      // Use a delimiter unlikely to appear in user content
      const delim = 'CCRAW_INJECT';
      return [
        `// ── CollabCode: "${filename}" injected as virtual file ──`,
        `#include <fstream>`,
        `namespace { struct _CCFileInit {`,
        `  _CCFileInit() {`,
        `    std::ofstream _f("${filename}");`,
        `    _f << R"${delim}(${content})${delim}";`,
        `  }`,
        `} _cc_fi; }`,
        `// ──────────────────────────────────────────────────────`,
        ``,
        ``,
      ].join('\n');
    }

    case 'java':
      // Java requires code inside a class; generate a static block snippet
      // and instruct user to paste into their class
      return [
        `// ── CollabCode: "${filename}" injected as virtual file ──`,
        `// Add the following INSIDE your class (as a static block before main):`,
        `/*`,
        `  static {`,
        `    try {`,
        `      byte[] _d = java.util.Base64.getDecoder().decode("${b64}");`,
        `      try (java.io.FileOutputStream _f = new java.io.FileOutputStream("${filename}")) { _f.write(_d); }`,
        `    } catch (Exception _e) { _e.printStackTrace(); }`,
        `  }`,
        `*/`,
        `// ──────────────────────────────────────────────────────`,
        ``,
        ``,
      ].join('\n');

    default:
      return `# File: ${filename} — content injected by CollabCode\n\n`;
  }
}


export default function CollabCodeIDE() {

  // ── Auth state ─────────────────────────────────────────────────────────────
  interface UserProfile { id: string; username: string; displayName: string; createdAt: string; }
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    setCurrentUser(null);
    setIsProfileMenuOpen(false);
  };

  // State for title
  const [title, setTitle] = useState("Data Analysis v1");
  const [isEditingTitle, setIsEditingTitle] = useState(false);

  // ── Data Sources sidebar state ──────────────────────────────────────────────
  const [activeCellId, setActiveCellId] = useState<string | null>(null);
  // Map from cellId → injected stdin string
  const [injectedStdins, setInjectedStdins] = useState<Record<string, { content: string; tick: number }>>({});
  // Map from cellId → injected code snippet (virtual file creation)
  const [injectedCodes, setInjectedCodes]   = useState<Record<string, { code: string; tick: number }>>({});

  const handleInjectData = (content: string) => {
    const targetId = activeCellId ?? cells.find(c => c.type === 'code')?.id ?? null;
    if (!targetId) return;
    setInjectedStdins(prev => ({
      ...prev,
      [targetId]: { content, tick: (prev[targetId]?.tick ?? 0) + 1 },
    }));
  };

  const handleInjectAsFile = (content: string, filename: string) => {
    const targetId = activeCellId ?? cells.find(c => c.type === 'code')?.id ?? null;
    if (!targetId) return;
    const lang = cells.find(c => c.id === targetId)?.language ?? 'python3';
    const code = generateFileInjectionCode(content, filename, lang);
    setInjectedCodes(prev => ({
      ...prev,
      [targetId]: { code, tick: (prev[targetId]?.tick ?? 0) + 1 },
    }));
  };

  // State for notebook cells
  const [cells, setCells] = useState<Array<{ id: string; type: 'code' | 'text'; language?: string; code?: string; content?: string; stdin?: string }>>([
    { id: '1', type: 'code', language: 'python3', code: '', stdin: '' },
    { id: '2', type: 'code', language: 'nodejs', code: '', stdin: '' }
  ]);

  const [hasHydrated, setHasHydrated] = useState(false);

  // Load from localStorage + check auth on mount
  useEffect(() => {
    const savedTitle = localStorage.getItem('collabcode_title');
    if (savedTitle) setTitle(savedTitle);

    const savedCells = localStorage.getItem('collabcode_cells');
    if (savedCells) {
      try {
        const parsed = JSON.parse(savedCells);
        if (Array.isArray(parsed) && parsed.length > 0) setCells(parsed);
      } catch (e) {
        console.error('Failed to parse saved cells:', e);
      }
    }
    setHasHydrated(true);

    // Check if user is already logged in via HttpOnly session cookie
    fetch('/api/auth/me')
      .then(async (res) => {
        if (res.ok) {
          const data = await res.json();
          setCurrentUser(data.user);
        }
      })
      .catch(() => {})
      .finally(() => setAuthChecked(true));
  }, []);

  // Ref for the notebook canvas area (for screenshot)
  const notebookRef = useRef<HTMLDivElement>(null);

  // Ref for hidden file input (for import)
  const fileInputRef = useRef<HTMLInputElement>(null);

  // State for share dropdown visibility
  const [isShareOpen, setIsShareOpen] = useState(false);
  const [runAllTrigger, setRunAllTrigger] = useState(0);
  const shareRef = useRef<HTMLDivElement>(null);

  // State for localStorage auto-save status
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'idle'>('saved');

  // State for import modal
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [pendingImportCells, setPendingImportCells] = useState<Array<{ id: string; type: 'code' | 'text'; language?: string; code?: string; content?: string; stdin?: string }>>([]);
  const [showOverwriteConfirm, setShowOverwriteConfirm] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [activeHelpTab, setActiveHelpTab] = useState<'overview' | 'ai' | 'data-sources' | 'share' | 'shortcuts'>('overview');

  // Audio instances ref for preloading to prevent lag
  const audioRefs = useRef<{ [key: string]: HTMLAudioElement }>({});
  const [isLoaded, setIsLoaded] = useState(false);
  const [loadingText, setLoadingText] = useState('Initializing compiler environments...');

  const { isDark, toggleTheme, isMuted, toggleMute } = useTheme();

  // Set up loop for Pop sound during loading
  useEffect(() => {
    let popAudio: HTMLAudioElement | null = null;
    let textInterval: NodeJS.Timeout;
    
    if (typeof window !== 'undefined' && !isLoaded) {
      popAudio = new Audio('/Sound-eff/Pop1_Pop2_pop3.mp3.mpeg');
      popAudio.loop = true;
      popAudio.volume = 0.4;
      if (!isMuted) {
        popAudio.play().catch(e => console.log('Autoplay pop sound blocked:', e));
      }

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
  }, [isLoaded, isMuted]);

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

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Sound effects logic
  const playSound = useCallback((type: 'bubble' | 'pop' | 'correct' | 'error') => {
    if (isMuted) return;
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
  }, [isMuted]);

  // Global Button Click Sound (excluding Run button and no-sound zones)
  useEffect(() => {
    const handleGlobalClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      // Skip if inside a no-sound zone (e.g. Focus Music widget)
      if (target.closest('[data-no-sound="true"]')) return;
      const button = target.closest('button') || target.closest('[role="button"]') || (target.tagName.toLowerCase() === 'button' ? target : null);
      if (button) {
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

  // Resize and History dropdown states
  const [aiSidebarWidth, setAiSidebarWidth] = useState(384);
  const [showHistoryList, setShowHistoryList] = useState(false);
  const isResizingRef = useRef(false);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isResizingRef.current = true;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, []);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizingRef.current) return;
      const newWidth = window.innerWidth - e.clientX;
      if (newWidth >= 285 && newWidth <= 800) {
        setAiSidebarWidth(newWidth);
      }
    };

    const handleMouseUp = () => {
      if (isResizingRef.current) {
        isResizingRef.current = false;
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  // Chat History / Multi-Chat States
  interface ChatItem { id: string; title: string; cell_id: string; created_at: string; }
  interface ChatMessage { role: 'user' | 'assistant'; content: string; }
  const [userChats, setUserChats] = useState<ChatItem[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);

  // Load chats for active cell
  const loadUserChats = useCallback(async (cellId: string) => {
    if (!currentUser) {
      setUserChats([]);
      return;
    }
    try {
      const res = await fetch(`/api/analyze/chats?cellId=${cellId}`);
      if (res.ok) {
        const data = await res.json();
        setUserChats(data.chats || []);
      }
    } catch (e) {
      console.error('Failed to load user chats:', e);
    }
  }, [currentUser]);

  // Load messages for specific chat
  const loadChatMessages = useCallback(async (chatId: string) => {
    try {
      const res = await fetch(`/api/analyze/messages?chatId=${chatId}`);
      if (res.ok) {
        const data = await res.json();
        setChatMessages(data.messages || []);
        if (data.messages && data.messages.length > 0) {
          const lastUserMsg = [...data.messages].reverse().find(m => m.role === 'user');
          const lastAiMsg = [...data.messages].reverse().find(m => m.role === 'assistant');
          setLastQuery(lastUserMsg?.content || '');
          setAiResponse(lastAiMsg?.content || '');
        } else {
          setLastQuery('');
          setAiResponse('');
        }
      }
    } catch (e) {
      console.error('Failed to load messages:', e);
    }
  }, []);

  const handleOpenAiSidebar = (cellId: string) => {
    setActiveCellIdForAi(cellId);
    setIsAiSidebarOpen(true);
    setChatMessages([]);
    setActiveChatId(null);
    setLastQuery('');
    setAiResponse('');
    loadUserChats(cellId);
  };

  const closeAiSidebar = () => {
    setIsAiSidebarOpen(false);
    setActiveCellIdForAi(null);
    setActiveChatId(null);
    setChatMessages([]);
  };

  const handleSelectChat = (chatId: string) => {
    setActiveChatId(chatId);
    loadChatMessages(chatId);
  };

  const handleStartNewChat = () => {
    setActiveChatId(null);
    setChatMessages([]);
    setLastQuery('');
    setAiResponse('');
  };

  const handleAiAnalyze = async (customPrompt?: string) => {
    const promptToSend = customPrompt || aiQuery;
    if (!promptToSend.trim() && !customPrompt) return;
    const activeCell = cells.find(c => c.id === activeCellIdForAi);
    if (!activeCell || activeCell.type !== 'code') return;
    
    setLastQuery(promptToSend);
    setIsAiLoading(true);
    setAiResponse('');

    const newHistory = [...chatMessages, { role: 'user', content: promptToSend }];
    setChatMessages(newHistory as any);

    try {
      // 1. Get AI completions
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: activeCell.code || '',
          language: activeCell.language || 'python3',
          prompt: promptToSend,
          history: newHistory
        })
      });
      if (!res.ok) throw new Error(`API error: ${res.status}`);
      const data = await res.json();
      setAiResponse(data.response);

      const aiMsg = { role: 'assistant', content: data.response };
      setChatMessages(prev => [...prev, aiMsg as any]);

      // 2. Persist in database if logged in
      if (currentUser) {
        // Create or get chat ID
        const chatTitle = promptToSend.substring(0, 30) + (promptToSend.length > 30 ? '...' : '');
        const chatRes = await fetch('/api/analyze/chats', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chatId: activeChatId,
            cellId: activeCell.id,
            title: chatTitle,
            message: { role: 'user', content: promptToSend }
          })
        });
        if (chatRes.ok) {
          const chatData = await chatRes.json();
          const targetId = chatData.chatId;
          if (!activeChatId) {
            setActiveChatId(targetId);
            loadUserChats(activeCell.id);
          }
          // Save assistant message
          await fetch('/api/analyze/chats', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chatId: targetId,
              message: aiMsg
            })
          });
        }
      }
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

  // Save title to localStorage on change
  useEffect(() => {
    if (hasHydrated) {
      setSaveStatus('saving');
      localStorage.setItem('collabcode_title', title);
      const timer = setTimeout(() => setSaveStatus('saved'), 800);
      return () => clearTimeout(timer);
    }
  }, [title, hasHydrated]);

  // Save cells to localStorage on change
  useEffect(() => {
    if (hasHydrated) {
      setSaveStatus('saving');
      localStorage.setItem('collabcode_cells', JSON.stringify(cells));
      const timer = setTimeout(() => setSaveStatus('saved'), 800);
      return () => clearTimeout(timer);
    }
  }, [cells, hasHydrated]);

  const addCodeCell = () => {
    const newId = Date.now().toString();
    setCells([...cells, { id: newId, type: 'code', language: 'python3', code: '', stdin: '' }]);
  };

  const addTextCell = () => {
    const newId = Date.now().toString();
    setCells([...cells, { id: newId, type: 'text', content: '' }]);
  };

  // Insert cell at a specific index
  const addCodeCellAt = useCallback((atIdx: number) => {
    const newId = Date.now().toString();
    setCells(prev => {
      const next = [...prev];
      next.splice(atIdx, 0, { id: newId, type: 'code', language: 'python3', code: '', stdin: '' });
      return next;
    });
  }, []);

  const addTextCellAt = useCallback((atIdx: number) => {
    const newId = Date.now().toString();
    setCells(prev => {
      const next = [...prev];
      next.splice(atIdx, 0, { id: newId, type: 'text', content: '' });
      return next;
    });
  }, []);

  // Drag-and-drop reordering state
  const dragCellIdRef = useRef<string | null>(null);
  const [dragOverCellId, setDragOverCellId] = useState<string | null>(null);

  const handleDragStart = useCallback((cellId: string) => (e: React.DragEvent) => {
    dragCellIdRef.current = cellId;
    e.dataTransfer.effectAllowed = 'move';
    const target = (e.target as HTMLElement).closest('.collabcode-cell');
    if (target) {
      e.dataTransfer.setDragImage(target as Element, 20, 20);
      setTimeout(() => {
        (target as HTMLElement).style.opacity = '0.4';
      }, 0);
    }
  }, []);

  const handleDragEnd = useCallback(() => (e: React.DragEvent) => {
    dragCellIdRef.current = null;
    setDragOverCellId(null);
    const target = (e.target as HTMLElement).closest('.collabcode-cell');
    if (target) {
      (target as HTMLElement).style.opacity = '1';
    }
  }, []);

  const handleDragOver = useCallback((cellId: string) => (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverCellId(cellId);
  }, []);

  const handleDrop = useCallback((targetCellId: string) => (e: React.DragEvent) => {
    e.preventDefault();
    setDragOverCellId(null);
    const fromId = dragCellIdRef.current;
    dragCellIdRef.current = null;
    if (!fromId || fromId === targetCellId) return;
    setCells(prev => {
      const fromIdx = prev.findIndex(c => c.id === fromId);
      const toIdx   = prev.findIndex(c => c.id === targetCellId);
      if (fromIdx === -1 || toIdx === -1) return prev;
      const next = [...prev];
      const [moved] = next.splice(fromIdx, 1);
      next.splice(toIdx, 0, moved);
      return next;
    });
  }, []);

  // Run all cells handler
  const runAllCells = () => {
    setRunAllTrigger(prev => prev + 1);
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
          <div className="w-72 h-72 rounded-2xl overflow-hidden shadow-xl shadow-primary/20 animate-bounce">
            <img src="/logo.jpg" alt="Logo" className="w-full h-full object-cover" />
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
            <div className="flex items-center justify-center w-7 h-7 rounded-lg overflow-hidden border border-outline-variant/30 bg-[#070c1b]">
              <img src="/collabcode-logo.jpg" alt="Logo" className="w-full h-full object-contain p-0.5" />
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
            {/* Help – icon-only expandable */}
            <button
              onClick={() => setIsHelpOpen(true)}
              title="Help"
              className="group relative flex items-center justify-center h-7 rounded-md text-primary hover:bg-primary/10 transition-all duration-200 overflow-hidden px-2 max-w-[28px] hover:max-w-[90px] hover:px-3 ml-1 border border-transparent hover:border-primary/20"
            >
              <HelpCircle size={14} className="shrink-0" />
              <span className="w-0 opacity-0 group-hover:w-auto group-hover:opacity-100 transition-all duration-200 whitespace-nowrap overflow-hidden ml-0 group-hover:ml-1.5 text-[11px] font-semibold">Help</span>
            </button>
            {/* Insert – icon-only expandable */}
            <button
              onClick={() => { handleFileInputClick(); fileInputRef.current?.click(); }}
              title="Import JSON"
              className="group relative flex items-center justify-center h-7 rounded-md text-on-surface-variant hover:bg-surface-variant hover:text-on-surface transition-all duration-200 overflow-hidden px-2 max-w-[28px] hover:max-w-[90px] hover:px-3 border border-transparent hover:border-outline-variant/30"
            >
              <FilePlus size={14} className="shrink-0" />
              <span className="w-0 opacity-0 group-hover:w-auto group-hover:opacity-100 transition-all duration-200 whitespace-nowrap overflow-hidden ml-0 group-hover:ml-1.5 text-[11px] font-semibold">Insert</span>
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
          {/* Share Dropdown – icon-only expandable */}
          <div className="relative" ref={shareRef}>
            <button
              onClick={() => setIsShareOpen(!isShareOpen)}
              title="Share / Export"
              className="group relative flex items-center justify-center h-8 rounded-lg bg-primary text-on-primary transition-all duration-200 overflow-hidden px-2.5 max-w-[34px] hover:max-w-[110px] hover:px-3.5 font-semibold shadow-sm shadow-primary/20 hover:brightness-110 active:brightness-95"
            >
              <Share2 size={14} className="shrink-0" />
              <span className="w-0 opacity-0 group-hover:w-auto group-hover:opacity-100 transition-all duration-200 whitespace-nowrap overflow-hidden ml-0 group-hover:ml-1.5 text-[11px] font-bold uppercase tracking-wide">Share</span>
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
            {/* LocalStorage / Auto-Save Indicator Button */}
            <button
              onClick={() => {
                if (typeof window !== 'undefined') {
                  setSaveStatus('saving');
                  localStorage.setItem('collabcode_cells', JSON.stringify(cells));
                  localStorage.setItem('collabcode_title', title);
                  setTimeout(() => {
                    setSaveStatus('saved');
                    playSound('correct');
                  }, 500);
                }
              }}
              className="group relative flex items-center justify-center h-8 rounded-lg bg-surface-variant hover:bg-primary/10 active:bg-primary/20 text-on-surface-variant hover:text-primary transition-all duration-300 overflow-hidden px-2 hover:px-3 active:px-3 max-w-[32px] hover:max-w-[170px] active:max-w-[170px] border border-outline-variant/30 shrink-0"
              title="Save status (LocalStorage)"
            >
              <Save size={16} className={`shrink-0 ${saveStatus === 'saving' ? 'animate-bounce text-primary' : 'text-secondary'}`} />
              <span className="w-0 opacity-0 group-hover:w-auto group-hover:opacity-100 group-active:w-auto group-active:opacity-100 transition-all duration-300 ease-out whitespace-nowrap overflow-hidden ml-0 group-hover:ml-2 group-active:ml-2 text-[11px] font-semibold">
                {saveStatus === 'saving' ? 'Saving...' : 'Auto-Saved to Local'}
              </span>
            </button>
            <button 
              className="p-1.5 rounded-md hover:bg-surface-variant hover:text-primary transition-colors shrink-0"
              onClick={toggleTheme}
              title="Toggle Theme"
            >
              {isDark ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            <div className="relative">
              <button 
                onClick={() => setIsSettingsOpen(!isSettingsOpen)}
                className={`p-1.5 rounded-md hover:bg-surface-variant transition-colors ${isSettingsOpen ? 'text-primary' : ''}`} 
                title="Settings"
              >
                <Settings size={18} />
              </button>
              {isSettingsOpen && (
                <div 
                  onMouseLeave={() => setIsSettingsOpen(false)}
                  className="absolute right-0 top-10 w-48 bg-surface-container-highest border border-outline-variant rounded-xl shadow-2xl z-50 p-3"
                >
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-ui-label text-on-surface">Mute Sounds</span>
                    <button
                      onClick={toggleMute}
                      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${isMuted ? 'bg-primary' : 'bg-surface-variant'}`}
                    >
                      <span className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${isMuted ? 'translate-x-4' : 'translate-x-0'}`} />
                    </button>
                  </div>
                </div>
              )}
            </div>
            {/* Profile + Logout Dropdown */}
            <div className="relative">
              <button
                onClick={() => setIsProfileMenuOpen((v) => !v)}
                className="w-8 h-8 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center text-primary font-bold text-xs hover:bg-primary/30 transition-colors"
                title={currentUser ? `${currentUser.displayName} (@${currentUser.username})` : 'Profile'}
              >
                {currentUser
                  ? currentUser.displayName.charAt(0).toUpperCase()
                  : <UserCircle size={18} />}
              </button>
              {isProfileMenuOpen && (
                <div
                  onMouseLeave={() => setIsProfileMenuOpen(false)}
                  className="absolute right-0 top-10 w-52 bg-surface-container-highest border border-outline-variant rounded-xl shadow-2xl z-50 overflow-hidden"
                >
                  {currentUser && (
                    <div className="px-4 py-3 border-b border-outline-variant/40">
                      <p className="font-semibold text-sm text-on-surface truncate">{currentUser.displayName}</p>
                      <p className="text-[11px] text-outline truncate">@{currentUser.username}</p>
                    </div>
                  )}
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-error hover:bg-error/10 transition-colors"
                  >
                    <X size={14} />
                    Sign Out
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Sidebar & Main Content */}
      <div className="flex flex-1 overflow-hidden relative">
        {/* Data Sources Sidebar */}
        <DataSourcesSidebar onInject={handleInjectData} onInjectAsFile={handleInjectAsFile} />

        {/* Main Workspace Canvas */}
        <main className="flex-1 flex flex-col bg-background overflow-y-auto scroll-smooth relative">
          <div ref={notebookRef} className="max-w-5xl mx-auto w-full p-6 flex flex-col pb-16">
            
            {/* Render Cells with drag-and-drop and between-cell insert */}
            <div
              id="notebook-cells"
              className="flex flex-col gap-0 mb-0"
              onDragLeave={() => setDragOverCellId(null)}
            >
              {/* Insert bar above first cell */}
              <InsertBar onAddCode={() => addCodeCellAt(0)} onAddText={() => addTextCellAt(0)} />

              {cells.map((cell, idx) => (
                <React.Fragment key={cell.id}>
                  {cell.type === 'code' ? (
                    <CodeCell
                      id={cell.id}
                      initialCode={cell.code}
                      initialLanguage={cell.language}
                      initialStdin={cell.stdin}
                      injectedStdin={
                        injectedStdins[cell.id]
                          ? `${injectedStdins[cell.id].content}\u0000tick:${injectedStdins[cell.id].tick}`
                          : undefined
                      }
                      injectedCode={
                        injectedCodes[cell.id]
                          ? `${injectedCodes[cell.id].code}\u0000tick:${injectedCodes[cell.id].tick}`
                          : undefined
                      }
                      onFocus={() => setActiveCellId(cell.id)}
                      onDelete={() => deleteCell(cell.id)}
                      onCodeChange={(code) => handleCodeChange(cell.id, code)}
                      onLanguageChange={(lang) => handleLanguageChange(cell.id, lang)}
                      onStdinChange={(stdin) => handleStdinChange(cell.id, stdin)}
                      onAiHelper={() => handleOpenAiSidebar(cell.id)}
                      onExecutionComplete={(success) => { if (success) playSound('correct'); else playSound('error'); }}
                      runAllTrigger={runAllTrigger}
                      onDragStart={handleDragStart(cell.id)}
                      onDragEnd={handleDragEnd()}
                      onDragOver={handleDragOver(cell.id)}
                      onDrop={handleDrop(cell.id)}
                      isDragOver={dragOverCellId === cell.id}
                    />
                  ) : (
                    <TextCell
                      id={cell.id}
                      initialContent={cell.content}
                      onDelete={() => deleteCell(cell.id)}
                      onContentChange={(content) => handleTextContentChange(cell.id, content)}
                      onDragStart={handleDragStart(cell.id)}
                      onDragEnd={handleDragEnd()}
                      onDragOver={handleDragOver(cell.id)}
                      onDrop={handleDrop(cell.id)}
                      isDragOver={dragOverCellId === cell.id}
                    />
                  )}
                  {/* Insert bar between/after each cell */}
                  <InsertBar onAddCode={() => addCodeCellAt(idx + 1)} onAddText={() => addTextCellAt(idx + 1)} />
                </React.Fragment>
              ))}
            </div>

            {/* Bottom Toolbar – Clear All & Run All */}
            <div className="flex justify-center mt-6">
              <div className="bg-surface-container-highest/85 backdrop-blur-md border border-outline-variant/60 rounded-full px-5 py-2 flex items-center gap-4 shadow-2xl">
                <button
                  onClick={clearAllCells}
                  className="group relative flex items-center justify-center h-9 rounded-full bg-transparent hover:bg-error/10 text-on-surface-variant hover:text-error transition-all duration-200 overflow-hidden px-2.5 max-w-[36px] hover:max-w-[130px] hover:px-4 border border-transparent hover:border-error/25 shrink-0"
                  title="Clear all cells"
                >
                  <Trash2 size={17} className="shrink-0" />
                  <span className="w-0 opacity-0 group-hover:w-auto group-hover:opacity-100 transition-all duration-200 whitespace-nowrap overflow-hidden ml-0 group-hover:ml-2 text-[12px] font-semibold">Clear All</span>
                </button>
                <div className="h-5 w-px bg-outline-variant/60" />
                <button
                  onClick={runAllCells}
                  className="group relative flex items-center justify-center h-9 rounded-full bg-transparent hover:bg-secondary/10 text-on-surface-variant hover:text-secondary transition-all duration-200 overflow-hidden px-2.5 max-w-[36px] hover:max-w-[130px] hover:px-4 border border-transparent hover:border-secondary/25 shrink-0"
                  title="Run all cells"
                >
                  <Play size={17} className="shrink-0 text-secondary" />
                  <span className="w-0 opacity-0 group-hover:w-auto group-hover:opacity-100 transition-all duration-200 whitespace-nowrap overflow-hidden ml-0 group-hover:ml-2 text-[12px] font-semibold text-secondary">Run All</span>
                </button>
              </div>
            </div>
          </div>
        </main>

        {/* Right-Hand AI Sidebar */}
        {isAiSidebarOpen && (
          <aside 
            style={{ width: `${aiSidebarWidth}px` }}
            className="relative flex-shrink-0 bg-surface-container-lowest border-l border-outline-variant flex flex-col z-40 animate-in slide-in-from-right duration-200"
          >
            {/* Left border drag handle for resizing */}
            <div
              onMouseDown={handleMouseDown}
              className="absolute top-0 bottom-0 left-0 w-1.5 cursor-col-resize hover:bg-primary/20 active:bg-primary/45 transition-colors z-50 flex items-center justify-center group"
              title="Drag to resize"
            >
              <div className="w-[2px] h-10 bg-outline-variant/30 rounded-full group-hover:bg-primary/60 transition-colors" />
            </div>

            <div className="flex items-center justify-between pl-5 pr-4 h-14 border-b border-outline-variant/60 bg-surface-container/50 backdrop-blur-md shrink-0">
              <div className="flex items-center gap-2 text-primary">
                <Sparkles size={18} />
                <span className="font-ui-header text-[14px] font-bold tracking-tight">AI Assistant</span>
              </div>
              <div className="flex items-center gap-1.5">
                {currentUser && (
                  <>
                    {/* Circle History button */}
                    <button
                      onClick={() => setShowHistoryList(prev => !prev)}
                      className={`w-8 h-8 rounded-full border transition-all relative group flex items-center justify-center ${
                        showHistoryList 
                          ? 'bg-primary/20 text-primary border-primary/40' 
                          : 'bg-transparent text-outline hover:text-primary hover:bg-primary/10 border-transparent'
                      }`}
                    >
                      <History size={16} />
                      <span className="absolute bottom-full right-0 mb-2 hidden group-hover:block bg-surface-container-highest text-on-surface text-[10px] font-semibold px-2.5 py-1 rounded shadow-lg border border-outline-variant/40 whitespace-nowrap z-50">
                        Previous chats
                      </span>
                    </button>

                    {/* Circle New Chat button */}
                    <button
                      onClick={handleStartNewChat}
                      className="w-8 h-8 rounded-full border border-transparent text-primary hover:bg-primary/10 transition-colors relative group flex items-center justify-center"
                    >
                      <FilePlus size={16} />
                      <span className="absolute bottom-full right-0 mb-2 hidden group-hover:block bg-surface-container-highest text-on-surface text-[10px] font-semibold px-2.5 py-1 rounded shadow-lg border border-outline-variant/40 whitespace-nowrap z-50">
                        New Chat
                      </span>
                    </button>
                  </>
                )}
                <button 
                  onClick={closeAiSidebar}
                  className="w-8 h-8 rounded-full flex items-center justify-center text-outline hover:text-on-surface hover:bg-surface-variant transition-colors"
                  title="Close AI Sidebar"
                >
                  <X size={17} />
                </button>
              </div>
            </div>

            {/* Dropdown for Previous Chats */}
            {currentUser && showHistoryList && (
              <div className="bg-surface-container-high/90 backdrop-blur border-b border-outline-variant/50 p-3.5 max-h-56 overflow-y-auto animate-in slide-in-from-top duration-200 shrink-0">
                <div className="font-ui-label text-[10px] font-bold text-outline uppercase tracking-wider mb-2">Previous Chats</div>
                {userChats.length === 0 ? (
                  <div className="text-[11px] text-outline/60 italic py-2 px-1">No previous chats in this cell.</div>
                ) : (
                  <div className="flex flex-col gap-1">
                    {userChats.map((chat) => (
                      <button
                        key={chat.id}
                        onClick={() => {
                          handleSelectChat(chat.id);
                          setShowHistoryList(false);
                        }}
                        className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl text-left text-[11.5px] font-medium font-ui-label transition-all truncate hover:bg-primary/10 hover:text-primary ${
                          activeChatId === chat.id
                            ? 'bg-primary/15 text-primary border border-primary/20'
                            : 'text-on-surface-variant border border-transparent'
                        }`}
                      >
                        <History size={12} className="shrink-0 opacity-75" />
                        <span className="truncate">{chat.title}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Sidebar main body */}
            <div className="flex-1 flex flex-col min-w-0 overflow-hidden p-5 gap-4">
              
              <div className="flex flex-col gap-1.5 shrink-0">
                <div className="font-ui-label text-[9px] font-bold text-outline uppercase tracking-widest">Active Workspace Scope</div>
                <div className="px-3 py-2 bg-surface-container/60 rounded-xl border border-outline-variant/30 flex items-center justify-between shadow-sm">
                  <div className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse"></div>
                    <span className="font-code-block text-[11px] text-on-surface-variant font-medium">Cell {activeCellIdForAi}</span>
                  </div>
                  <span className="text-[9px] font-ui-label text-outline bg-surface-container-high px-2 py-0.5 rounded-md font-bold uppercase tracking-wider">Python</span>
                </div>
              </div>

              {/* Chat Thread container (fills the center section) */}
              <div className="flex-1 overflow-y-auto flex flex-col gap-6 scrollbar-thin pr-1">
                {chatMessages.length === 0 && !isAiLoading && (
                  <div className="flex flex-col items-center justify-center h-full gap-4 text-center px-4 opacity-70 my-auto py-8">
                    <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary mb-2 shadow-inner">
                      <Sparkles size={24} />
                    </div>
                    <h3 className="font-ui-header text-[14px] text-on-surface font-semibold">How can I assist you?</h3>
                    <p className="font-ui-body text-[11.5px] text-on-surface-variant leading-relaxed">
                      Ask me to explain this cell's code, look for bugs, or suggest optimizations.
                    </p>
                    {/* Quick Actions */}
                    <div className="flex flex-col w-full gap-2 mt-4">
                      <button 
                        onClick={() => handleAiAnalyze('Explain this code step by step')}
                        className="flex items-center justify-between w-full px-4 py-2.5 rounded-xl bg-surface-container border border-outline-variant/45 hover:bg-primary/5 hover:border-primary/30 transition-all text-left group shadow-sm"
                      >
                        <span className="text-[12px] font-ui-label text-on-surface font-medium group-hover:text-primary transition-colors">Explain code</span>
                        <Info size={14} className="text-outline group-hover:text-primary transition-colors" />
                      </button>
                      <button 
                        onClick={() => handleAiAnalyze('Find any bugs or issues in this code')}
                        className="flex items-center justify-between w-full px-4 py-2.5 rounded-xl bg-surface-container border border-outline-variant/45 hover:bg-error/5 hover:border-error/30 transition-all text-left group shadow-sm"
                      >
                        <span className="text-[12px] font-ui-label text-on-surface font-medium group-hover:text-error transition-colors">Check for bugs</span>
                        <AlertCircle size={14} className="text-outline group-hover:text-error transition-colors" />
                      </button>
                      <button 
                        onClick={() => handleAiAnalyze('Suggest ways to optimize this code')}
                        className="flex items-center justify-between w-full px-4 py-2.5 rounded-xl bg-surface-container border border-outline-variant/45 hover:bg-secondary/5 hover:border-secondary/30 transition-all text-left group shadow-sm"
                      >
                        <span className="text-[12px] font-ui-label text-on-surface font-medium group-hover:text-secondary transition-colors">Optimize performance</span>
                        <TrendingUp size={14} className="text-outline group-hover:text-secondary transition-colors" />
                      </button>
                    </div>
                  </div>
                )}

                {/* Render full message thread history */}
                {chatMessages.length > 0 && (
                  <div className="flex flex-col gap-5 py-2">
                    {chatMessages.map((msg, index) => (
                      <div key={index} className={`flex flex-col gap-2 ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                        {msg.role === 'assistant' && (
                          <div className="flex items-center gap-2 ml-1">
                            <div className="w-5 h-5 rounded-lg bg-surface-variant flex items-center justify-center text-primary shadow-sm border border-outline-variant/50">
                              <Sparkles size={10} />
                            </div>
                            <span className="font-ui-header text-[11px] font-semibold text-on-surface">CollabCode AI</span>
                          </div>
                        )}
                        <div className={`px-4 py-2.5 rounded-2xl text-[12.5px] font-ui-body shadow-sm max-w-[92%] ${
                          msg.role === 'user' 
                            ? 'bg-primary text-on-primary rounded-tr-sm shadow-md' 
                            : 'glass-panel bg-surface-container/60 border border-outline-variant/50 rounded-tl-sm text-on-surface leading-relaxed prose prose-sm max-w-none prose-headings:font-ui-header prose-headings:text-on-surface prose-headings:font-semibold prose-p:my-1.5 prose-pre:my-3 prose-pre:bg-[#0d1117] prose-pre:border prose-pre:border-white/10 prose-pre:rounded-xl prose-pre:shadow-inner prose-pre:text-[11px] prose-code:text-primary prose-code:bg-primary/10 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded-md prose-code:font-code-block prose-code:before:content-none prose-code:after:content-none'
                        }`}>
                          {msg.role === 'user' ? (
                            msg.content
                          ) : (
                            <ReactMarkdown remarkPlugins={[remarkGfm]}>
                              {msg.content}
                            </ReactMarkdown>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {isAiLoading && (
                  <div className="flex items-center gap-3 p-4 bg-surface-container/30 border border-outline-variant/40 rounded-xl max-w-[90%] animate-pulse mt-2">
                    <Activity size={14} className="animate-spin text-primary" />
                    <span className="font-ui-body text-[12px] text-on-surface-variant font-medium">Thinking...</span>
                  </div>
                )}
              </div>

              {/* Chat Input Footer */}
              <div className="pt-4 border-t border-outline-variant/30 shrink-0">
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
                        setAiQuery('');
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
                    onClick={() => setActiveHelpTab('data-sources')}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-xl font-ui-label text-[13px] font-semibold text-left transition-all whitespace-nowrap ${
                      activeHelpTab === 'data-sources'
                        ? 'bg-primary text-on-primary shadow-md shadow-primary/20'
                        : 'text-on-surface-variant hover:bg-surface-variant'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[18px]">database</span>
                    <span>Data & Stdin</span>
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
                  {activeHelpTab === 'data-sources' && 'Data Sources & Stdin Injection'}
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
                          Write Python, JavaScript, C++, or Java scripts in code cells. Click the play button next to the cell to run code and view output instantly.
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
                          <span className="material-symbols-outlined text-[18px]">drag_indicator</span>
                          <span>Drag-and-Drop Reordering</span>
                        </div>
                        <p className="text-[12px] text-outline">
                          Reorder your analysis notebook easily by grabbing any cell handler and dragging it to your desired position.
                        </p>
                      </div>

                      <div className="p-4 bg-surface-container-low rounded-xl border border-outline-variant/40">
                        <div className="flex items-center gap-2 text-primary font-bold mb-2">
                          <span className="material-symbols-outlined text-[18px]">music_note</span>
                          <span>Focus Music</span>
                        </div>
                        <p className="text-[12px] text-outline">
                          Access ambient lofi tracks via the Focus Music Widget floating in the bottom-left corner of the workspace.
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

                  {activeHelpTab === 'data-sources' && (
                    <div className="flex flex-col gap-5 animate-in fade-in duration-200">
                      <p>
                        CollabCode allows you to bind external inputs directly to code runtime environments.
                      </p>
                      
                      <div className="flex flex-col gap-4">
                        <div className="p-4 bg-surface-container-low rounded-xl border border-outline-variant/40">
                          <div className="flex items-center gap-2 text-primary font-semibold mb-1">
                            <span className="material-symbols-outlined text-[18px]">upload</span>
                            <span>File Upload</span>
                          </div>
                          <p className="text-[12px] text-outline leading-relaxed">
                            Drag or click inside the File Upload area in the <strong>Data Sources</strong> sidebar to upload <code>.csv</code>, <code>.txt</code>, or custom logs.
                          </p>
                        </div>

                        <div className="p-4 bg-surface-container-low rounded-xl border border-outline-variant/40">
                          <div className="flex items-center gap-2 text-secondary font-semibold mb-1">
                            <span className="material-symbols-outlined text-[18px]">link</span>
                            <span>Google Sheets CSV Import</span>
                          </div>
                          <p className="text-[12px] text-outline leading-relaxed">
                            Paste a Google Sheet URL (shared publicly as 'Anyone with the link can view'). The workspace will fetch its contents and parse it dynamically as a local CSV source.
                          </p>
                        </div>

                        <div className="p-4 bg-surface-container-low rounded-xl border border-outline-variant/40">
                          <div className="flex items-center gap-2 text-tertiary font-semibold mb-1">
                            <span className="material-symbols-outlined text-[18px]">input</span>
                            <span>Stdin Injection</span>
                          </div>
                          <p className="text-[12px] text-outline leading-relaxed">
                            Click <strong>"Inject into active cell"</strong> on any added source. The next execution run of the target code cell will consume the file content as its <code>stdin</code> input.
                          </p>
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
      {/* Alpha version label */}
      <div className="fixed bottom-4 right-4 z-[99] pointer-events-none select-none">
        <span className="text-[10px] font-bold font-ui-label text-primary uppercase tracking-widest bg-surface-container-highest/80 backdrop-blur-md px-3 py-1.5 rounded-full border border-outline-variant/30 shadow-md">
          this is currently in Alpha version
        </span>
      </div>

      <FocusMusicWidget />

      {/* Auth Gate — blocks the IDE until user is authenticated */}
      {authChecked && !currentUser && (
        <LoginModal onAuthenticated={(user) => setCurrentUser(user)} />
      )}
    </div>
  );
}

