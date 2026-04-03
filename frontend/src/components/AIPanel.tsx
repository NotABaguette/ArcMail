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
  critical: { label: 'Critical', color: 'text-red-500 bg-red-50 border-red-200' },
  high: { label: 'High', color: 'text-orange-500 bg-orange-50 border-orange-200' },
  normal: { label: 'Normal', color: 'text-blue-500 bg-blue-50 border-blue-200' },
  low: { label: 'Low', color: 'text-green-600 bg-green-50 border-green-200' },
  none: { label: 'None', color: 'text-gray-500 bg-gray-50 border-gray-200' },
};

function CopyButton({ text, isDark }: { text: string; isDark: boolean }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      onClick={handleCopy}
      className={`p-1 rounded ${isDark ? 'text-old-text-tertiary hover:text-old-text' : 'text-ol-text-tertiary hover:text-ol-text'}`}
      title="Copy"
    >
      {copied ? <Check size={13} className="text-success" /> : <Copy size={13} />}
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

  const { theme, ai: aiSettings } = useSettingsStore();
  const isDark = theme === 'dark';

  const [rewriteText, setRewriteText] = useState('');
  const [composePrompt, setComposePrompt] = useState('');

  if (!ai.isOpen) return null;

  const hasEmail = !!selectedEmailId;

  return (
    <div className={`w-72 min-w-[288px] flex flex-col border-l ${
      isDark ? 'bg-old-surface border-old-border' : 'bg-ol-surface border-ol-border'
    }`}>
      {/* Header */}
      <div className={`flex items-center justify-between px-3 py-2.5 border-b ${isDark ? 'border-old-border' : 'border-ol-border'}`}>
        <div className="flex items-center gap-2">
          <Sparkles size={15} className="text-accent" />
          <h2 className={`text-[13px] font-semibold ${isDark ? 'text-old-text' : 'text-ol-text'}`}>AI Assistant</h2>
        </div>
        <div className="flex items-center gap-0.5">
          <button
            onClick={clearAI}
            className={`text-[11px] px-2 py-0.5 rounded ${isDark ? 'text-old-text-tertiary hover:text-old-text hover:bg-old-hover' : 'text-ol-text-tertiary hover:text-ol-text hover:bg-ol-hover'}`}
          >
            Clear
          </button>
          <button
            onClick={toggleAIPanel}
            className={`p-1 rounded ${isDark ? 'text-old-text-tertiary hover:text-old-text hover:bg-old-hover' : 'text-ol-text-tertiary hover:text-ol-text hover:bg-ol-hover'}`}
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {/* Summarize */}
        <AIAction
          icon={FileText}
          label="Summarize"
          isDark={isDark}
          disabled={!hasEmail || ai.isLoading}
          loading={ai.isLoading && !ai.summary}
          onClick={aiSummarize}
        />
        {ai.summary && (
          <ResultCard isDark={isDark}>
            <div className="flex items-start justify-between gap-2">
              <p className={`text-[12px] leading-relaxed ${isDark ? 'text-old-text-secondary' : 'text-ol-text-secondary'}`}>
                {ai.summary}
              </p>
              <CopyButton text={ai.summary} isDark={isDark} />
            </div>
          </ResultCard>
        )}

        {/* Categorize */}
        <AIAction icon={Tag} label="Categorize" isDark={isDark}
          disabled={!hasEmail || ai.isLoading}
          loading={ai.isLoading && ai.categories.length === 0 && !!ai.summary}
          onClick={aiCategorize}
        />
        {ai.categories.length > 0 && (
          <ResultCard isDark={isDark}>
            <div className="flex flex-wrap gap-1.5">
              {ai.categories.map((cat) => (
                <span key={cat} className={`text-[11px] px-2 py-0.5 rounded border ${
                  isDark ? 'bg-old-surface-alt border-old-border text-old-text-secondary' : 'bg-ol-bg border-ol-border text-ol-text-secondary'
                }`}>
                  {cat}
                </span>
              ))}
            </div>
          </ResultCard>
        )}

        {/* Priority */}
        <AIAction icon={AlertTriangle} label="Detect Priority" isDark={isDark}
          disabled={!hasEmail || ai.isLoading}
          loading={ai.isLoading && ai.priority === 'normal' && ai.categories.length > 0}
          onClick={aiPriority}
        />
        {ai.priority !== 'normal' && (
          <ResultCard isDark={isDark}>
            <span className={`text-[11px] px-2.5 py-1 rounded border ${PRIORITY_LABELS[ai.priority].color}`}>
              {PRIORITY_LABELS[ai.priority].label} Priority
            </span>
          </ResultCard>
        )}

        {/* Divider */}
        <div className={`border-t ${isDark ? 'border-old-border' : 'border-ol-border'}`} />

        {/* Rewrite */}
        <div className="space-y-2">
          <div className="flex items-center gap-1.5">
            <PenLine size={13} className="text-accent" />
            <span className={`text-[12px] font-medium ${isDark ? 'text-old-text' : 'text-ol-text'}`}>Rewrite</span>
          </div>
          <textarea
            value={rewriteText}
            onChange={(e) => setRewriteText(e.target.value)}
            placeholder="Paste text to rewrite..."
            className={`w-full h-16 px-2.5 py-2 text-[12px] rounded border outline-none resize-none no-transition ${
              isDark ? 'bg-old-surface-alt border-old-border text-old-text placeholder:text-old-text-tertiary focus:border-accent' : 'bg-ol-bg border-ol-border text-ol-text placeholder:text-ol-text-tertiary focus:border-accent'
            }`}
          />
          <button
            onClick={() => { if (rewriteText.trim()) aiRewrite(rewriteText); }}
            disabled={!rewriteText.trim() || ai.isLoading}
            className="w-full px-3 py-1.5 rounded text-[12px] font-medium text-accent border border-accent hover:bg-accent/5 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {ai.isLoading && ai.rewriteInput ? 'Rewriting...' : 'Rewrite Text'}
          </button>
          {ai.rewriteOutput && (
            <ResultCard isDark={isDark}>
              <div className="flex items-start justify-between gap-2">
                <p className={`text-[12px] leading-relaxed whitespace-pre-wrap ${isDark ? 'text-old-text-secondary' : 'text-ol-text-secondary'}`}>
                  {ai.rewriteOutput}
                </p>
                <CopyButton text={ai.rewriteOutput} isDark={isDark} />
              </div>
            </ResultCard>
          )}
        </div>

        {/* Quick Compose */}
        <div className="space-y-2">
          <div className="flex items-center gap-1.5">
            <MessageSquarePlus size={13} className="text-accent" />
            <span className={`text-[12px] font-medium ${isDark ? 'text-old-text' : 'text-ol-text'}`}>Quick Compose</span>
          </div>
          <textarea
            value={composePrompt}
            onChange={(e) => setComposePrompt(e.target.value)}
            placeholder="Describe the email you want to write..."
            className={`w-full h-16 px-2.5 py-2 text-[12px] rounded border outline-none resize-none no-transition ${
              isDark ? 'bg-old-surface-alt border-old-border text-old-text placeholder:text-old-text-tertiary focus:border-accent' : 'bg-ol-bg border-ol-border text-ol-text placeholder:text-ol-text-tertiary focus:border-accent'
            }`}
          />
          <button
            onClick={() => { if (composePrompt.trim()) aiCompose(composePrompt); }}
            disabled={!composePrompt.trim() || ai.isLoading}
            className="w-full px-3 py-1.5 rounded text-[12px] font-medium text-accent border border-accent hover:bg-accent/5 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {ai.isLoading && ai.quickComposePrompt ? 'Generating...' : 'Generate Email'}
          </button>
          {ai.quickComposeOutput && (
            <ResultCard isDark={isDark}>
              <div className="flex items-start justify-between gap-2">
                <p className={`text-[12px] leading-relaxed whitespace-pre-wrap ${isDark ? 'text-old-text-secondary' : 'text-ol-text-secondary'}`}>
                  {ai.quickComposeOutput}
                </p>
                <CopyButton text={ai.quickComposeOutput} isDark={isDark} />
              </div>
            </ResultCard>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className={`px-3 py-2 border-t text-[11px] ${isDark ? 'border-old-border text-old-text-tertiary' : 'border-ol-border text-ol-text-tertiary'}`}>
        {aiSettings.provider} / {aiSettings.model}
      </div>
    </div>
  );
}

function AIAction({ icon: Icon, label, isDark, disabled, loading, onClick }: {
  icon: typeof FileText;
  label: string;
  isDark: boolean;
  disabled: boolean;
  loading: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`w-full flex items-center gap-2 px-3 py-2 rounded border text-[12px] ${
        isDark
          ? 'bg-old-surface-alt border-old-border text-old-text-secondary hover:border-old-text-tertiary'
          : 'bg-ol-bg border-ol-border text-ol-text-secondary hover:border-ol-text-tertiary'
      } disabled:opacity-40 disabled:cursor-not-allowed`}
    >
      {loading ? <Loader2 size={14} className="animate-spin text-accent" /> : <Icon size={14} className="text-accent" />}
      <span className="font-medium">{label}</span>
    </button>
  );
}

function ResultCard({ isDark, children }: { isDark: boolean; children: React.ReactNode }) {
  return (
    <div className={`p-2.5 rounded border ${isDark ? 'bg-old-surface-alt border-old-border' : 'bg-ol-bg border-ol-border'}`}>
      {children}
    </div>
  );
}
