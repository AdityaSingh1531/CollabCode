'use client';

import React, { useState, useRef, useCallback } from 'react';
import {
  Database, Upload, Link2, X, ChevronRight, ChevronLeft,
  FileText, FileSpreadsheet, File, Trash2, ArrowRightCircle,
  AlertCircle, CheckCircle2, Loader2,
} from 'lucide-react';

/* ─────────────────────────────────────────────────────────── types ── */
export interface DataSource {
  id: string;
  type: 'file' | 'gsheet';
  name: string;
  content: string;          // raw text content for injection
  preview: string;          // first few lines for UI preview
  sizeLabel: string;
  url?: string;             // original URL (gsheet only)
}

interface Props {
  onInject: (content: string) => void;
}

/* ─────────────────────────────────────────────── helpers ── */
function humanSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function extractSheetId(url: string): string | null {
  const m = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
  return m ? m[1] : null;
}

function csvExportUrl(sheetId: string, gid = '0') {
  return `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${gid}`;
}

function fileIcon(name: string) {
  const ext = name.split('.').pop()?.toLowerCase();
  if (ext === 'csv') return <FileSpreadsheet size={14} className="text-secondary shrink-0" />;
  if (['txt', 'log', 'md'].includes(ext ?? '')) return <FileText size={14} className="text-primary shrink-0" />;
  return <File size={14} className="text-outline shrink-0" />;
}

/* ─────────────────────────────────────────────── component ── */
export default function DataSourcesSidebar({ onInject }: Props) {
  const [isOpen, setIsOpen]         = useState(false);
  const [sources, setSources]       = useState<DataSource[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [sheetUrl, setSheetUrl]     = useState('');
  const [sheetError, setSheetError] = useState('');
  const [sheetLoading, setSheetLoading] = useState(false);
  const [injectedId, setInjectedId] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  /* ── read file ── */
  const readFile = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const raw = e.target?.result as string;
      const lines = raw.split('\n');
      const preview = lines.slice(0, 4).join('\n') + (lines.length > 4 ? '\n…' : '');
      setSources(prev => [
        ...prev.filter(s => s.name !== file.name),
        {
          id: `file-${Date.now()}-${file.name}`,
          type: 'file',
          name: file.name,
          content: raw,
          preview,
          sizeLabel: humanSize(file.size),
        },
      ]);
    };
    // read as text for everything (binary will produce garbled chars, acceptable for stdin)
    reader.readAsText(file);
  }, []);

  /* ── drag-and-drop ── */
  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    Array.from(e.dataTransfer.files).forEach(readFile);
  }, [readFile]);

  /* ── Google Sheets ── */
  const addGSheet = async () => {
    setSheetError('');
    const id = extractSheetId(sheetUrl.trim());
    if (!id) { setSheetError('Invalid Google Sheets URL'); return; }
    if (sources.find(s => s.url?.includes(id))) { setSheetError('Sheet already added'); return; }

    setSheetLoading(true);
    try {
      const url = csvExportUrl(id);
      const res = await fetch(url);
      if (!res.ok) throw new Error('Could not fetch sheet — make sure sharing is set to "Anyone with the link"');
      const csv = await res.text();
      const lines = csv.split('\n');
      const preview = lines.slice(0, 4).join('\n') + (lines.length > 4 ? '\n…' : '');
      const name = `Sheet_${id.slice(0, 8)}.csv`;
      setSources(prev => [
        ...prev,
        {
          id: `gsheet-${Date.now()}`,
          type: 'gsheet',
          name,
          content: csv,
          preview,
          sizeLabel: humanSize(new TextEncoder().encode(csv).length),
          url: sheetUrl.trim(),
        },
      ]);
      setSheetUrl('');
    } catch (err: any) {
      setSheetError(err.message || 'Failed to fetch sheet');
    } finally {
      setSheetLoading(false);
    }
  };

  /* ── inject ── */
  const inject = (src: DataSource) => {
    onInject(src.content);
    setInjectedId(src.id);
    setTimeout(() => setInjectedId(null), 2000);
  };

  const remove = (id: string) => setSources(prev => prev.filter(s => s.id !== id));

  /* ────────────────────────── render ── */
  return (
    <div className="flex h-full shrink-0" data-no-sound="true">
      {/* ── Slide-in panel ── */}
      <div
        className={`
          flex flex-col h-full bg-surface-container border-r border-outline-variant/60
          transition-all duration-300 ease-in-out overflow-hidden
          ${isOpen ? 'w-64' : 'w-0'}
        `}
      >
        {isOpen && (
          <div className="flex flex-col h-full w-64">
            {/* Header */}
            <div className="flex items-center justify-between px-3 py-2.5 border-b border-outline-variant/40 shrink-0">
              <div className="flex items-center gap-2">
                <Database size={14} className="text-primary" />
                <span className="font-ui-label text-[12px] font-bold text-on-surface uppercase tracking-wider">
                  Data Sources
                </span>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="p-0.5 rounded hover:bg-surface-variant text-outline hover:text-on-surface transition-colors"
              >
                <ChevronLeft size={14} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-2 py-3 flex flex-col gap-4">

              {/* ── File Upload ─────────────────────────────── */}
              <section>
                <p className="text-[10px] font-bold uppercase tracking-widest text-outline px-1 mb-2">
                  File Upload
                </p>

                {/* Drop zone */}
                <div
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={onDrop}
                  className={`
                    flex flex-col items-center justify-center gap-1.5 border-2 border-dashed rounded-xl
                    py-4 cursor-pointer transition-all duration-200 select-none
                    ${isDragging
                      ? 'border-primary bg-primary/10 scale-[1.01]'
                      : 'border-outline-variant/50 hover:border-primary/50 hover:bg-primary/5'
                    }
                  `}
                >
                  <Upload size={18} className={isDragging ? 'text-primary' : 'text-outline'} />
                  <p className="text-[11px] font-semibold text-outline">
                    {isDragging ? 'Drop files here' : 'Click or drag files'}
                  </p>
                  <p className="text-[9px] text-outline/60">.csv .txt .log .bin any</p>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  className="hidden"
                  onChange={(e) => Array.from(e.target.files ?? []).forEach(readFile)}
                />

                {/* File list */}
                {sources.filter(s => s.type === 'file').map(src => (
                  <SourceCard
                    key={src.id}
                    src={src}
                    onInject={() => inject(src)}
                    onRemove={() => remove(src.id)}
                    injected={injectedId === src.id}
                  />
                ))}
              </section>

              {/* ── Google Sheets ────────────────────────────── */}
              <section>
                <p className="text-[10px] font-bold uppercase tracking-widest text-outline px-1 mb-2">
                  Google Sheets
                </p>
                <div className="flex flex-col gap-1.5">
                  <div className="flex gap-1">
                    <input
                      type="url"
                      value={sheetUrl}
                      onChange={(e) => { setSheetUrl(e.target.value); setSheetError(''); }}
                      onKeyDown={(e) => e.key === 'Enter' && addGSheet()}
                      placeholder="Paste Sheets URL…"
                      className="flex-1 min-w-0 bg-surface-container-highest border border-outline-variant/40 rounded-lg px-2 py-1.5 text-[11px] text-on-surface placeholder:text-outline/50 focus:outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/20 transition-all"
                    />
                    <button
                      onClick={addGSheet}
                      disabled={sheetLoading || !sheetUrl.trim()}
                      className="shrink-0 flex items-center justify-center w-8 h-8 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary disabled:opacity-40 transition-colors"
                      title="Add Sheet"
                    >
                      {sheetLoading
                        ? <Loader2 size={13} className="animate-spin" />
                        : <Link2 size={13} />
                      }
                    </button>
                  </div>
                  {sheetError && (
                    <div className="flex items-start gap-1.5 text-[10px] text-error px-1">
                      <AlertCircle size={11} className="mt-0.5 shrink-0" />
                      <span>{sheetError}</span>
                    </div>
                  )}
                  <p className="text-[9px] text-outline/60 px-1 leading-relaxed">
                    Sheet must be public ("Anyone with the link can view")
                  </p>
                </div>

                {/* Sheet list */}
                {sources.filter(s => s.type === 'gsheet').map(src => (
                  <SourceCard
                    key={src.id}
                    src={src}
                    onInject={() => inject(src)}
                    onRemove={() => remove(src.id)}
                    injected={injectedId === src.id}
                  />
                ))}
              </section>

              {/* Empty state */}
              {sources.length === 0 && (
                <p className="text-[10px] text-outline/50 text-center mt-4 leading-relaxed px-2">
                  Upload a file or add a Google Sheet to inject data into any code cell's stdin
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── Toggle tab (always visible) ── */}
      <button
        onClick={() => setIsOpen(v => !v)}
        title={isOpen ? 'Close Data Sources' : 'Open Data Sources'}
        className={`
          flex flex-col items-center justify-center gap-1.5 w-8 shrink-0 border-r
          border-outline-variant/60 bg-surface-container hover:bg-surface-variant
          transition-colors duration-200 text-outline hover:text-primary
          ${isOpen ? 'border-l-0' : ''}
        `}
      >
        <Database size={15} />
        <span
          className="text-[8px] font-bold uppercase tracking-widest"
          style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}
        >
          Data
        </span>
        {isOpen
          ? <ChevronLeft size={12} />
          : <ChevronRight size={12} />
        }
      </button>
    </div>
  );
}

/* ─────────────────────────── SourceCard subcomponent ── */
function SourceCard({
  src, onInject, onRemove, injected,
}: {
  src: DataSource;
  onInject: () => void;
  onRemove: () => void;
  injected: boolean;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="mt-2 rounded-xl border border-outline-variant/40 bg-surface-container-highest overflow-hidden">
      {/* Card header */}
      <div className="flex items-center gap-1.5 px-2 py-1.5">
        {src.type === 'gsheet'
          ? <FileSpreadsheet size={13} className="text-secondary shrink-0" />
          : fileIcon(src.name)
        }
        <span
          className="flex-1 text-[11px] font-semibold text-on-surface truncate cursor-pointer hover:text-primary transition-colors"
          title={src.name}
          onClick={() => setExpanded(v => !v)}
        >
          {src.name}
        </span>
        <span className="text-[9px] text-outline/60 shrink-0">{src.sizeLabel}</span>
        <button
          onClick={onRemove}
          className="p-0.5 rounded text-outline/60 hover:text-error hover:bg-error/10 transition-colors shrink-0"
          title="Remove"
        >
          <Trash2 size={11} />
        </button>
      </div>

      {/* Preview (expandable) */}
      {expanded && (
        <pre className="text-[9px] font-mono text-outline/80 bg-black/20 px-2 py-1.5 overflow-x-auto max-h-20 leading-relaxed border-t border-outline-variant/30">
          {src.preview}
        </pre>
      )}

      {/* Inject button */}
      <button
        onClick={onInject}
        className={`
          w-full flex items-center justify-center gap-1.5 py-1.5 text-[10px] font-bold uppercase tracking-wider
          transition-all duration-300 border-t border-outline-variant/30
          ${injected
            ? 'bg-secondary/15 text-secondary'
            : 'hover:bg-primary/10 text-primary'
          }
        `}
      >
        {injected
          ? <><CheckCircle2 size={11} /> Injected into stdin!</>
          : <><ArrowRightCircle size={11} /> Inject into active cell</>
        }
      </button>
    </div>
  );
}
