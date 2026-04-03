import { useRef, useState } from 'react';
import {
  X,
  Minimize2,
  Maximize2,
  Send,
  Paperclip,
  Bold,
  Italic,
  Underline,
  List,
  ListOrdered,
  Link,
  Sparkles,
  Save,
  ChevronDown,
  ChevronUp,
  Trash2,
  ArrowUp,
  ArrowDown,
  Minus,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Type,
} from 'lucide-react';
import { useEmailStore } from '../store/emailStore';
import { useSettingsStore } from '../store/settingsStore';

export function ComposeModal() {
  const {
    compose,
    accounts,
    closeCompose,
    updateCompose,
    sendEmail,
    saveDraft,
    contacts,
  } = useEmailStore();

  const { theme } = useSettingsStore();
  const isDark = theme === 'dark';

  const [showCc, setShowCc] = useState(!!compose.cc);
  const [showBcc, setShowBcc] = useState(!!compose.bcc);
  const [isSending, setIsSending] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [activeField, setActiveField] = useState<string | null>(null);
  const [showAIMenu, setShowAIMenu] = useState(false);
  const editorRef = useRef<HTMLDivElement>(null);

  if (!compose.isOpen) return null;

  const handleSend = async () => {
    setIsSending(true);
    try {
      if (editorRef.current) {
        updateCompose({ body: editorRef.current.innerHTML });
      }
      await sendEmail();
    } finally {
      setIsSending(false);
    }
  };

  const handleSaveDraft = async () => {
    if (editorRef.current) {
      updateCompose({ body: editorRef.current.innerHTML });
    }
    await saveDraft();
  };

  const execCommand = (command: string, value?: string) => {
    document.execCommand(command, false, value);
    editorRef.current?.focus();
  };

  const getFieldValue = (field: string) => {
    if (field === 'to') return compose.to;
    if (field === 'cc') return compose.cc;
    return compose.bcc;
  };

  const filteredContacts = activeField
    ? contacts.filter((c) => {
        const val = getFieldValue(activeField).split(',').pop()?.trim().toLowerCase() ?? '';
        return val.length > 0 && (
          c.name.toLowerCase().includes(val) || c.email.toLowerCase().includes(val)
        );
      })
    : [];

  const selectContact = (field: string, email: string) => {
    const currentValue = getFieldValue(field);
    const parts = currentValue.split(',').map((s) => s.trim());
    parts[parts.length - 1] = email;
    const newValue = parts.join(', ') + ', ';
    updateCompose({ [field]: newValue });
    setShowSuggestions(false);
  };

  const modeLabel =
    compose.mode === 'reply' ? 'Reply'
    : compose.mode === 'replyAll' ? 'Reply All'
    : compose.mode === 'forward' ? 'Forward'
    : 'New Message';

  const importanceIcon = compose.importance === 'high' ? ArrowUp
    : compose.importance === 'low' ? ArrowDown : Minus;

  return (
    <div
      className={`fixed z-50 ${
        compose.isFullScreen
          ? 'inset-4'
          : 'bottom-0 right-6 w-[600px] max-h-[85vh]'
      } flex flex-col rounded-t-lg shadow-2xl border ${
        isDark
          ? 'bg-old-surface border-old-border shadow-black/60'
          : 'bg-ol-surface border-ol-border shadow-black/20'
      }`}
    >
      {/* Title bar */}
      <div className={`flex items-center justify-between px-4 py-2 rounded-t-lg border-b cursor-move ${
        isDark ? 'bg-old-surface-alt border-old-border' : 'bg-ol-bg border-ol-border'
      }`}>
        <span className={`text-[13px] font-semibold ${isDark ? 'text-old-text' : 'text-ol-text'}`}>
          {modeLabel}
        </span>
        <div className="flex items-center gap-0.5">
          <button
            onClick={() => updateCompose({ isFullScreen: !compose.isFullScreen })}
            className={`p-1 rounded ${isDark ? 'text-old-text-tertiary hover:text-old-text hover:bg-old-hover' : 'text-ol-text-tertiary hover:text-ol-text hover:bg-ol-hover'}`}
          >
            {compose.isFullScreen ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
          </button>
          <button
            onClick={closeCompose}
            className={`p-1 rounded ${isDark ? 'text-old-text-tertiary hover:text-old-text hover:bg-old-hover' : 'text-ol-text-tertiary hover:text-ol-text hover:bg-ol-hover'}`}
          >
            <X size={13} />
          </button>
        </div>
      </div>

      {/* Fields */}
      <div className={`px-4 py-1 border-b ${isDark ? 'border-old-border' : 'border-ol-border'}`}>
        {/* From (if multiple accounts) */}
        {accounts.length > 1 && (
          <div className={`flex items-center gap-2 py-1.5 border-b ${isDark ? 'border-old-border-subtle' : 'border-ol-border-subtle'}`}>
            <label className={`text-[12px] w-12 flex-shrink-0 ${isDark ? 'text-old-text-secondary' : 'text-ol-text-secondary'}`}>From</label>
            <select
              value={compose.fromAccountId ?? ''}
              onChange={(e) => updateCompose({ fromAccountId: e.target.value })}
              className={`flex-1 text-[13px] bg-transparent outline-none no-transition ${isDark ? 'text-old-text' : 'text-ol-text'}`}
            >
              {accounts.map(a => (
                <option key={a.id} value={a.id}>{a.name} &lt;{a.email}&gt;</option>
              ))}
            </select>
          </div>
        )}

        {/* To */}
        <div className={`flex items-center gap-2 py-1.5 border-b relative ${isDark ? 'border-old-border-subtle' : 'border-ol-border-subtle'}`}>
          <label className={`text-[12px] w-12 flex-shrink-0 ${isDark ? 'text-old-text-secondary' : 'text-ol-text-secondary'}`}>To</label>
          <input
            type="text"
            value={compose.to}
            onChange={(e) => updateCompose({ to: e.target.value })}
            onFocus={() => { setActiveField('to'); setShowSuggestions(true); }}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
            className={`flex-1 text-[13px] bg-transparent outline-none no-transition ${isDark ? 'text-old-text placeholder:text-old-text-tertiary' : 'text-ol-text placeholder:text-ol-text-tertiary'}`}
            placeholder="Recipients"
          />
          <div className="flex items-center gap-1">
            {!showCc && (
              <button onClick={() => setShowCc(true)}
                className={`text-[11px] px-1.5 py-0.5 rounded ${isDark ? 'text-old-text-tertiary hover:text-old-text' : 'text-ol-text-tertiary hover:text-ol-text'}`}>
                Cc
              </button>
            )}
            {!showBcc && (
              <button onClick={() => setShowBcc(true)}
                className={`text-[11px] px-1.5 py-0.5 rounded ${isDark ? 'text-old-text-tertiary hover:text-old-text' : 'text-ol-text-tertiary hover:text-ol-text'}`}>
                Bcc
              </button>
            )}
          </div>
          {showSuggestions && activeField === 'to' && filteredContacts.length > 0 && (
            <div className={`absolute top-full left-12 right-0 z-10 mt-1 rounded border shadow-lg max-h-40 overflow-y-auto ${
              isDark ? 'bg-old-surface border-old-border' : 'bg-ol-surface border-ol-border'
            }`}>
              {filteredContacts.slice(0, 5).map((contact) => (
                <button
                  key={contact.id}
                  onMouseDown={() => selectContact('to', contact.email)}
                  className={`w-full flex items-center gap-2 px-3 py-2 text-left text-[13px] ${
                    isDark ? 'hover:bg-old-hover text-old-text' : 'hover:bg-ol-hover text-ol-text'
                  }`}
                >
                  <span>{contact.name}</span>
                  <span className={`text-[11px] ${isDark ? 'text-old-text-tertiary' : 'text-ol-text-tertiary'}`}>{contact.email}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* CC */}
        {showCc && (
          <div className={`flex items-center gap-2 py-1.5 border-b ${isDark ? 'border-old-border-subtle' : 'border-ol-border-subtle'}`}>
            <label className={`text-[12px] w-12 flex-shrink-0 ${isDark ? 'text-old-text-secondary' : 'text-ol-text-secondary'}`}>Cc</label>
            <input
              type="text"
              value={compose.cc}
              onChange={(e) => updateCompose({ cc: e.target.value })}
              onFocus={() => { setActiveField('cc'); setShowSuggestions(true); }}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
              className={`flex-1 text-[13px] bg-transparent outline-none no-transition ${isDark ? 'text-old-text' : 'text-ol-text'}`}
            />
            <button onClick={() => { setShowCc(false); updateCompose({ cc: '' }); }}
              className={isDark ? 'text-old-text-tertiary' : 'text-ol-text-tertiary'}>
              <ChevronUp size={13} />
            </button>
          </div>
        )}

        {/* BCC */}
        {showBcc && (
          <div className={`flex items-center gap-2 py-1.5 border-b ${isDark ? 'border-old-border-subtle' : 'border-ol-border-subtle'}`}>
            <label className={`text-[12px] w-12 flex-shrink-0 ${isDark ? 'text-old-text-secondary' : 'text-ol-text-secondary'}`}>Bcc</label>
            <input
              type="text"
              value={compose.bcc}
              onChange={(e) => updateCompose({ bcc: e.target.value })}
              onFocus={() => { setActiveField('bcc'); setShowSuggestions(true); }}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
              className={`flex-1 text-[13px] bg-transparent outline-none no-transition ${isDark ? 'text-old-text' : 'text-ol-text'}`}
            />
            <button onClick={() => { setShowBcc(false); updateCompose({ bcc: '' }); }}
              className={isDark ? 'text-old-text-tertiary' : 'text-ol-text-tertiary'}>
              <ChevronUp size={13} />
            </button>
          </div>
        )}

        {/* Subject */}
        <div className="flex items-center gap-2 py-1.5">
          <label className={`text-[12px] w-12 flex-shrink-0 ${isDark ? 'text-old-text-secondary' : 'text-ol-text-secondary'}`}>Subject</label>
          <input
            type="text"
            value={compose.subject}
            onChange={(e) => updateCompose({ subject: e.target.value })}
            className={`flex-1 text-[13px] bg-transparent outline-none no-transition ${isDark ? 'text-old-text placeholder:text-old-text-tertiary' : 'text-ol-text placeholder:text-ol-text-tertiary'}`}
            placeholder="Subject"
          />
        </div>
      </div>

      {/* Formatting Toolbar */}
      <div className={`flex items-center gap-0.5 px-3 py-1 border-b ${isDark ? 'border-old-border-subtle' : 'border-ol-border-subtle'}`}>
        <FmtButton icon={Bold} title="Bold" isDark={isDark} onClick={() => execCommand('bold')} />
        <FmtButton icon={Italic} title="Italic" isDark={isDark} onClick={() => execCommand('italic')} />
        <FmtButton icon={Underline} title="Underline" isDark={isDark} onClick={() => execCommand('underline')} />
        <FmtSep isDark={isDark} />
        <FmtButton icon={Type} title="Font size" isDark={isDark} onClick={() => {}} />
        <FmtSep isDark={isDark} />
        <FmtButton icon={AlignLeft} title="Align left" isDark={isDark} onClick={() => execCommand('justifyLeft')} />
        <FmtButton icon={AlignCenter} title="Align center" isDark={isDark} onClick={() => execCommand('justifyCenter')} />
        <FmtButton icon={AlignRight} title="Align right" isDark={isDark} onClick={() => execCommand('justifyRight')} />
        <FmtSep isDark={isDark} />
        <FmtButton icon={List} title="Bullet list" isDark={isDark} onClick={() => execCommand('insertUnorderedList')} />
        <FmtButton icon={ListOrdered} title="Numbered list" isDark={isDark} onClick={() => execCommand('insertOrderedList')} />
        <FmtSep isDark={isDark} />
        <FmtButton icon={Link} title="Insert link" isDark={isDark} onClick={() => {
          const url = prompt('Enter URL:');
          if (url) execCommand('createLink', url);
        }} />
        <FmtButton icon={Paperclip} title="Attach file" isDark={isDark} onClick={() => {}} />

        <div className="flex-1" />

        {/* Importance */}
        <button
          onClick={() => {
            const cycle = { high: 'normal', normal: 'low', low: 'high' } as const;
            updateCompose({ importance: cycle[compose.importance] });
          }}
          title={`Importance: ${compose.importance}`}
          className={`flex items-center gap-0.5 px-1.5 py-1 rounded text-[11px] ${
            compose.importance === 'high'
              ? 'text-danger'
              : compose.importance === 'low'
                ? 'text-accent'
                : isDark ? 'text-old-text-tertiary' : 'text-ol-text-tertiary'
          } ${isDark ? 'hover:bg-old-hover' : 'hover:bg-ol-hover'}`}
        >
          {React.createElement(importanceIcon, { size: 13 })}
        </button>

        {/* AI Assist */}
        <div className="relative">
          <button
            onClick={() => setShowAIMenu(!showAIMenu)}
            className={`flex items-center gap-1 px-2 py-1 rounded text-[11px] border ${
              isDark ? 'border-old-border text-accent hover:bg-old-hover' : 'border-ol-border text-accent hover:bg-ol-hover'
            }`}
          >
            <Sparkles size={12} />
            <span>AI Assist</span>
            <ChevronDown size={11} />
          </button>
          {showAIMenu && (
            <div className={`absolute right-0 top-full mt-1 w-48 rounded border shadow-lg z-10 ${
              isDark ? 'bg-old-surface border-old-border' : 'bg-ol-surface border-ol-border'
            }`}>
              {['Professional tone', 'Casual tone', 'Friendly tone', 'Rewrite', 'Summarize thread', 'Generate reply'].map((item) => (
                <button
                  key={item}
                  onClick={() => setShowAIMenu(false)}
                  className={`w-full text-left px-3 py-2 text-[12px] ${
                    isDark ? 'text-old-text hover:bg-old-hover' : 'text-ol-text hover:bg-ol-hover'
                  }`}
                >
                  {item}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Editor */}
      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        data-placeholder="Write your message..."
        className={`flex-1 min-h-[200px] px-4 py-3 text-[13px] outline-none overflow-y-auto leading-relaxed ${
          isDark ? 'text-old-text' : 'text-ol-text'
        }`}
        dangerouslySetInnerHTML={{ __html: compose.body }}
      />

      {/* Attachments */}
      {compose.attachments.length > 0 && (
        <div className={`px-4 py-2 border-t ${isDark ? 'border-old-border-subtle' : 'border-ol-border-subtle'}`}>
          <div className="flex flex-wrap gap-2">
            {compose.attachments.map((file, i) => (
              <div key={i} className={`flex items-center gap-2 px-2 py-1 rounded text-[12px] border ${
                isDark ? 'bg-old-surface-alt border-old-border text-old-text-secondary' : 'bg-ol-bg border-ol-border text-ol-text-secondary'
              }`}>
                <Paperclip size={11} />
                <span>{file.name}</span>
                <button className={isDark ? 'hover:text-old-text' : 'hover:text-ol-text'}>
                  <X size={11} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Footer */}
      <div className={`flex items-center justify-between px-4 py-2.5 border-t ${isDark ? 'border-old-border' : 'border-ol-border'}`}>
        <div className="flex items-center gap-2">
          <button
            onClick={handleSend}
            disabled={isSending || !compose.to}
            className="flex items-center gap-1.5 px-4 py-1.5 bg-accent hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed text-white text-[13px] font-semibold rounded"
          >
            <Send size={14} />
            <span>{isSending ? 'Sending...' : 'Send'}</span>
          </button>
          <button
            onClick={handleSaveDraft}
            className={`flex items-center gap-1 px-3 py-1.5 text-[12px] rounded ${
              isDark ? 'text-old-text-secondary hover:bg-old-hover' : 'text-ol-text-secondary hover:bg-ol-hover'
            }`}
          >
            <Save size={13} />
            <span>Save Draft</span>
          </button>
        </div>

        <div className="flex items-center gap-3">
          <span className={`text-[11px] ${isDark ? 'text-old-text-tertiary' : 'text-ol-text-tertiary'}`}>
            {compose.importance !== 'normal' && `${compose.importance.charAt(0).toUpperCase() + compose.importance.slice(1)} importance`}
          </span>
          <button
            onClick={closeCompose}
            className={`p-1.5 rounded ${isDark ? 'text-old-text-tertiary hover:text-danger hover:bg-old-hover' : 'text-ol-text-tertiary hover:text-danger hover:bg-ol-hover'}`}
            title="Discard"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}

function FmtButton({ icon: Icon, title, isDark, onClick }: {
  icon: typeof Bold;
  title: string;
  isDark: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={`p-1.5 rounded ${
        isDark ? 'text-old-text-secondary hover:text-old-text hover:bg-old-hover' : 'text-ol-text-secondary hover:text-ol-text hover:bg-ol-hover'
      }`}
    >
      <Icon size={14} />
    </button>
  );
}

function FmtSep({ isDark }: { isDark: boolean }) {
  return <div className={`w-px h-4 mx-0.5 ${isDark ? 'bg-old-border' : 'bg-ol-border'}`} />;
}

// Need React in scope for createElement
import React from 'react';
