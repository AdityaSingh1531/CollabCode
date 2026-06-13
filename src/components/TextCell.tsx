'use client';

import React, { useState } from 'react';
import { marked } from 'marked';
import { Edit, Eye, Trash2 } from 'lucide-react';

interface TextCellProps {
  id: string;
  initialContent?: string;
  onDelete?: () => void;
  onContentChange?: (content: string) => void;
}

export default function TextCell({ id, initialContent = 'Double click to edit text (supports markdown rendering)...', onDelete, onContentChange }: TextCellProps) {
  const [content, setContent] = useState(initialContent);
  const [isEditing, setIsEditing] = useState(false);

  // Helper to parse markdown synchronously
  const getParsedMarkdown = () => {
    try {
      return { __html: marked.parse(content) as string };
    } catch (e) {
      console.error(e);
      return { __html: content };
    }
  };

  return (
    <div className="flex flex-col rounded-xl border border-outline-variant bg-surface-container overflow-hidden shadow-xl ring-1 ring-white/5 mb-0 card-hover transition-all">
      {/* Cell Header */}
      <div className="flex items-center justify-between px-4 h-10 bg-surface-container-high">
        <div className="flex items-center gap-3">
          <span className="text-outline font-code-bold text-[11px]">[{id}] Text</span>
          <span className="font-ui-label text-[10px] text-outline-variant bg-surface-variant px-2 py-0.5 rounded">Markdown</span>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={() => setIsEditing(!isEditing)}
            className="flex items-center gap-1.5 bg-primary/10 text-primary border border-primary/20 px-3 py-1.5 rounded-lg font-ui-label text-[12px] font-semibold transition-all duration-200 hover:bg-primary hover:text-on-primary hover:shadow-lg hover:shadow-primary/15"
          >
            {isEditing ? <Eye size={14} /> : <Edit size={14} />}
            {isEditing ? 'Preview' : 'Edit'}
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

      {/* Content Area */}
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
