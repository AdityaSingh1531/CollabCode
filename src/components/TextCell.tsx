'use client';

import React, { useState } from 'react';
import { marked } from 'marked';
import { Edit, Eye, Trash2, GripVertical } from 'lucide-react';

interface TextCellProps {
  id: string;
  initialContent?: string;
  onDelete?: () => void;
  onContentChange?: (content: string) => void;
  onDragStart?: (e: React.DragEvent) => void;
  onDragEnd?: (e: React.DragEvent) => void;
  onDragOver?: (e: React.DragEvent) => void;
  onDrop?: (e: React.DragEvent) => void;
  isDragOver?: boolean;
}

export default function TextCell({
  id, initialContent = 'Double click to edit text (supports markdown rendering)...',
  onDelete, onContentChange,
  onDragStart, onDragEnd, onDragOver, onDrop, isDragOver
}: TextCellProps) {
  const [content, setContent]   = useState(initialContent);
  const [isEditing, setIsEditing] = useState(false);

  const getParsedMarkdown = () => {
    try {
      return { __html: marked.parse(content) as string };
    } catch (e) {
      return { __html: content };
    }
  };

  return (
    <div
      className={`collabcode-cell flex flex-col rounded-xl border bg-surface-container overflow-hidden shadow-xl ring-1 ring-white/5 transition-all duration-150 ${
        isDragOver
          ? 'border-primary/60 ring-2 ring-primary/30 scale-[1.01]'
          : 'border-outline-variant'
      }`}
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      {/* Cell Header */}
      <div className="flex items-center justify-between px-3 h-10 bg-surface-container-high">
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

          <span className="text-outline font-code-bold text-[11px] select-none">[{id}] Text</span>
          <span className="font-ui-label text-[10px] text-outline-variant bg-surface-variant px-2 py-0.5 rounded">Markdown</span>
        </div>

        <div className="flex items-center gap-1.5">
          {/* Edit / Preview */}
          <button
            onClick={() => setIsEditing(!isEditing)}
            title={isEditing ? 'Preview' : 'Edit'}
            className="group relative flex items-center justify-center h-7 rounded-lg bg-primary/10 text-primary border border-primary/20 transition-all duration-200 overflow-hidden px-2 max-w-[28px] hover:max-w-[100px] hover:px-3 hover:bg-primary hover:text-on-primary shrink-0"
          >
            {isEditing ? <Eye size={14} className="shrink-0" /> : <Edit size={14} className="shrink-0" />}
            <span className="w-0 opacity-0 group-hover:w-auto group-hover:opacity-100 transition-all duration-200 whitespace-nowrap overflow-hidden ml-0 group-hover:ml-1.5 text-[10px] font-bold uppercase tracking-wide">
              {isEditing ? 'Preview' : 'Edit'}
            </span>
          </button>

          {/* Delete */}
          {onDelete && (
            <button
              onClick={onDelete}
              title="Delete cell"
              className="group relative flex items-center justify-center h-7 rounded-lg bg-transparent hover:bg-error/10 hover:text-error text-on-surface-variant transition-all duration-200 overflow-hidden px-2 max-w-[28px] hover:max-w-[100px] hover:px-3 ml-1 border border-transparent hover:border-outline-variant/30 shrink-0"
            >
              <Trash2 size={14} className="shrink-0" />
              <span className="w-0 opacity-0 group-hover:w-auto group-hover:opacity-100 transition-all duration-200 whitespace-nowrap overflow-hidden ml-0 group-hover:ml-1.5 text-[10px] font-bold uppercase tracking-wide">
                Delete
              </span>
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 p-4 bg-surface-container-lowest min-h-[80px]">
        {isEditing ? (
          <textarea
            value={content}
            onChange={(e) => { setContent(e.target.value); onContentChange?.(e.target.value); }}
            className="w-full bg-transparent outline-none resize-none overflow-hidden text-on-surface font-ui-body leading-relaxed border border-outline-variant/30 rounded p-3 focus:border-primary transition-colors bg-surface-container-low"
            rows={Math.max(content.split('\n').length, 4)}
            placeholder="Type your markdown here..."
            autoFocus
          />
        ) : content ? (
          <div
            className="markdown-body font-ui-body text-ui-body text-on-surface-variant leading-relaxed cursor-pointer min-h-[48px]"
            onDoubleClick={() => setIsEditing(true)}
            title="Double click to edit"
            dangerouslySetInnerHTML={getParsedMarkdown()}
          />
        ) : (
          <div
            className="markdown-body font-ui-body text-ui-body text-on-surface-variant leading-relaxed cursor-pointer min-h-[48px]"
            onDoubleClick={() => setIsEditing(true)}
            title="Double click to edit"
          >
            <span className="text-outline italic">Empty text cell. Double click to add content.</span>
          </div>
        )}
      </div>
    </div>
  );
}
