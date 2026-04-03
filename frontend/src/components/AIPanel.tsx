import { useState } from 'react';
import {
  Sparkles,
  FileText,
  Tag,
  AlertTriangle,
  PenLine,
  MessageSquarePlus,
  X,
  Loader2,
  Copy,
  Check,
} from 'lucide-react';
import { useEmailStore } from '../store/emailStore';
import { useSettingsStore } from '../store/settingsStore';
import type { Priority } from '../types';

const PRIORITY_LABELS: Record<Priority, { label: string; color: string }> = {
  critical: { label: 'Critical', color: 'text-red-400 bg-red-500/10 border-red-500/20' },
  high: { label: 'High', color: 'text-orange-400 bg-orange-500/10 border-orange-500/20' },
  normal: { label: 'Normal', color: 'text-blue-400 bg-blue-500/10 border-blue-500/20' },
  low: { label: 'Low', color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' },
  none: { label: 'None', color: 'text-navy-400 bg-navy-700/30 border-navy-600/20' },
};

function SkeletonLoader() {
  return (
    <div className="space-y-2 animate-pulse">
      <div className="h-3 bg-navy-700/50 rounded w-full" />
      <div className="h-3 bg-navy-700/50 rounded w-5/6" />
      <div className="h-3 bg-navy-700/50 rounded w-4/6" />
    </div>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      onClick={handleCopy}
      className="p-1 rounded text-navy-500 hover:text-navy-300 hover:bg-navy-700"
      title="Copy"
    >
      {copied ? <Check size={14} className="text-success" /> : <Copy size={14} />}
    </button>
  );
}

export function AIPanel() {
  const {
    ai,
    selectedEmailId,
    toggleAIPanel,
    aiSummarize,
    aiCategorize,
    aiPriority,
    aiRewrite,
    aiCompose,
    clearAI,
  } = useEmailStore();

  const { ai: aiSettings } = useSettingsStore();

  const [rewriteText, setRewriteText] = useState('');
  const [composePrompt, setComposePrompt] = useState('');

  if (!ai.isOpen) return null;

  const hasEmail = !!selectedEmailId;

  return (
    <div className="w-80 min-w-[320px] flex flex-col bg-navy-900 border-l border-navy-700/50">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-navy-700/50">
        <div className="flex items-center gap-2">
          <Sparkles size={18} className="text-accent-light" />
          <h2 className="text-sm font-semibold text-navy-100">AI Assistant</h2>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={clearAI}
            className="text-xs text-navy-500 hover:text-navy-300 px-2 py-1 rounded hover:bg-navy-800"
          >
            Clear
          </button>
          <button
            onClick={toggleAIPanel}
            className="p-1 rounded text-navy-500 hover:text-navy-300 hover:bg-navy-800"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Summarize */}
        <div className="space-y-2">
          <button
            onClick={aiSummarize}
            disabled={!hasEmail || ai.isLoading}
            className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg bg-navy-800/70 border border-navy-700/50 text-sm text-navy-300 hover:text-navy-100 hover:border-navy-600/50 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
          >
            {ai.isLoading && !ai.summary ? (
              <Loader2 size={16} className="animate-spin text-accent" />
            ) : (
              <FileText size={16} className="text-accent" />
            )}
            <span className="font-medium">Summarize</span>
          </button>
          {ai.isLoading && !ai.summary && <SkeletonLoader />}
          {ai.summary && (
            <div className="p-3 bg-navy-800/50 rounded-lg border border-navy-700/30">
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm text-navy-300 leading-relaxed">{ai.summary}</p>
                <CopyButton text={ai.summary} />
              </div>
            </div>
          )}
        </div>

        {/* Categorize */}
        <div className="space-y-2">
          <button
            onClick={aiCategorize}
            disabled={!hasEmail || ai.isLoading}
            className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg bg-navy-800/70 border border-navy-700/50 text-sm text-navy-300 hover:text-navy-100 hover:border-navy-600/50 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
          >
            {ai.isLoading && ai.categories.length === 0 && ai.summary ? (
              <Loader2 size={16} className="animate-spin text-violet-400" />
            ) : (
              <Tag size={16} className="text-violet-400" />
            )}
            <span className="font-medium">Categorize</span>
          </button>
          {ai.categories.length > 0 && (
            <div className="flex flex-wrap gap-1.5 p-3 bg-navy-800/50 rounded-lg border border-navy-700/30">
              {ai.categories.map((cat) => (
                <span
                  key={cat}
                  className="text-xs px-2.5 py-1 rounded-full bg-violet-500/10 text-violet-300 border border-violet-500/20"
                >
                  {cat}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Priority */}
        <div className="space-y-2">
          <button
            onClick={aiPriority}
            disabled={!hasEmail || ai.isLoading}
            className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg bg-navy-800/70 border border-navy-700/50 text-sm text-navy-300 hover:text-navy-100 hover:border-navy-600/50 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
          >
            {ai.isLoading && ai.priority === 'normal' && ai.categories.length > 0 ? (
              <Loader2 size={16} className="animate-spin text-warning" />
            ) : (
              <AlertTriangle size={16} className="text-warning" />
            )}
            <span className="font-medium">Detect Priority</span>
          </button>
          {ai.priority !== 'normal' && (
            <div className="p-3 bg-navy-800/50 rounded-lg border border-navy-700/30">
              <span
                className={`text-xs px-2.5 py-1 rounded-full border ${PRIORITY_LABELS[ai.priority].color}`}
              >
                {PRIORITY_LABELS[ai.priority].label} Priority
              </span>
            </div>
          )}
        </div>

        {/* Divider */}
        <div className="border-t border-navy-700/50 pt-2" />

        {/* Rewrite */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm text-navy-300">
            <PenLine size={16} className="text-emerald-400" />
            <span className="font-medium">Rewrite</span>
          </div>
          <textarea
            value={rewriteText}
            onChange={(e) => setRewriteText(e.target.value)}
            placeholder="Paste text to rewrite..."
            className="w-full h-20 px-3 py-2 bg-navy-800/70 border border-navy-700/50 rounded-lg text-sm text-navy-200 placeholder-navy-600 outline-none focus:border-accent/40 resize-none"
          />
          <button
            onClick={() => {
              if (rewriteText.trim()) aiRewrite(rewriteText);
            }}
            disabled={!rewriteText.trim() || ai.isLoading}
            className="w-full px-3 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-sm text-emerald-400 font-medium hover:bg-emerald-500/20 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
          >
            {ai.isLoading && ai.rewriteInput ? 'Rewriting...' : 'Rewrite Text'}
          </button>
          {ai.rewriteOutput && (
            <div className="p-3 bg-navy-800/50 rounded-lg border border-navy-700/30">
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm text-navy-300 leading-relaxed whitespace-pre-wrap">
                  {ai.rewriteOutput}
                </p>
                <CopyButton text={ai.rewriteOutput} />
              </div>
            </div>
          )}
        </div>

        {/* Quick Compose */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm text-navy-300">
            <MessageSquarePlus size={16} className="text-cyan-400" />
            <span className="font-medium">Quick Compose</span>
          </div>
          <textarea
            value={composePrompt}
            onChange={(e) => setComposePrompt(e.target.value)}
            placeholder="Describe the email you want to write..."
            className="w-full h-20 px-3 py-2 bg-navy-800/70 border border-navy-700/50 rounded-lg text-sm text-navy-200 placeholder-navy-600 outline-none focus:border-accent/40 resize-none"
          />
          <button
            onClick={() => {
              if (composePrompt.trim()) aiCompose(composePrompt);
            }}
            disabled={!composePrompt.trim() || ai.isLoading}
            className="w-full px-3 py-2 rounded-lg bg-cyan-500/10 border border-cyan-500/20 text-sm text-cyan-400 font-medium hover:bg-cyan-500/20 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
          >
            {ai.isLoading && ai.quickComposePrompt ? 'Generating...' : 'Generate Email'}
          </button>
          {ai.quickComposeOutput && (
            <div className="p-3 bg-navy-800/50 rounded-lg border border-navy-700/30">
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm text-navy-300 leading-relaxed whitespace-pre-wrap">
                  {ai.quickComposeOutput}
                </p>
                <CopyButton text={ai.quickComposeOutput} />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="px-4 py-2.5 border-t border-navy-700/50 text-xs text-navy-600">
        {aiSettings.provider} / {aiSettings.model}
      </div>
    </div>
  );
}
