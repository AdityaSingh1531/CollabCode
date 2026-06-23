'use client';

import React, { useState } from 'react';
import { Code2, FileText } from 'lucide-react';

interface InsertBarProps {
  onAddCode: () => void;
  onAddText: () => void;
}

/**
 * Thin horizontal bar shown between cells.
 * Hidden by default; a dotted line + "+" buttons appear on hover.
 */
export default function InsertBar({ onAddCode, onAddText }: InsertBarProps) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      className="relative flex items-center justify-center h-6 group cursor-default my-0.5"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Dashed line */}
      <div
        className={`absolute left-4 right-4 h-px border-t border-dashed transition-all duration-200 ${
          hovered ? 'border-primary/40' : 'border-transparent'
        }`}
      />

      {/* Buttons appear on hover */}
      <div
        className={`flex items-center gap-1 transition-all duration-150 ${
          hovered ? 'opacity-100 scale-100' : 'opacity-0 scale-95 pointer-events-none'
        }`}
      >
        <button
          onClick={onAddCode}
          title="Insert Code Cell here"
          className="flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-surface-container border border-primary/30 text-primary hover:bg-primary hover:text-on-primary transition-all duration-150 shadow-sm"
        >
          <Code2 size={11} />
          Code
        </button>
        <button
          onClick={onAddText}
          title="Insert Text Cell here"
          className="flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-surface-container border border-outline-variant/40 text-on-surface-variant hover:bg-surface-variant hover:text-on-surface transition-all duration-150 shadow-sm"
        >
          <FileText size={11} />
          Text
        </button>
      </div>
    </div>
  );
}
