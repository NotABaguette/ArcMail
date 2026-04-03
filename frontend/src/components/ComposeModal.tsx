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
} from 'lucide-react';
import { useEmailStore } from '../store/emailStore';

export function ComposeModal() {
  const {
    compose,
    closeCompose,
    updateCompose,
    sendEmail,
    saveDraft,
    contacts,
  } = useEmailStore();

  const [showCc, setShowCc] = useState(!!compose.cc);
  const [showBcc, setShowBcc] = useState(!!compose.bcc);
  const [isSending, setIsSending] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [activeField, setActiveField] = useState<string | null>(null);
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

  const filteredContacts = activeField
    ? contacts.filter(
        (c) =>
          c.name.toLowerCase().includes(
            (activeField === 'to' ? compose.to : activeField === 'cc' ? compose.cc : compose.bcc)
              .split(',')
              .pop()
              ?.trim()
              .toLowerCase() ?? ''
          ) ||
          c.email.toLowerCase().includes(
            (activeField === 'to' ? compose.to : activeField === 'cc' ? compose.cc : compose.bcc)
              .split(',')
              .pop()
              ?.trim()
              .toLowerCase() ?? ''
          )
      )
    : [];

  const selectContact = (field: string, email: string) => {
    const currentValue = field === 'to' ? compose.to : field === 'cc' ? compose.cc : compose.bcc;
    const parts = currentValue.split(',').map((s) => s.trim());
    parts[parts.length - 1] = email;
    const newValue = parts.join(', ') + ', ';
    updateCompose({ [field]: newValue });
    setShowSuggestions(false);
  };

  const modeLabel =
    compose.mode === 'reply'
      ? 'Reply'
      : compose.mode === 'replyAll'
      ? 'Reply All'
      : compose.mode === 'forward'
      ? 'Forward'
      : 'New Message';

  return (
    <div
      className={`fixed z-50 ${
        compose.isFullScreen
          ? 'inset-0'
          : 'bottom-0 right-6 w-[580px] max-h-[85vh]'
      } flex flex-col bg-navy-900 border border-navy-700/70 rounded-t-xl shadow-2xl shadow-black/50`}
    >
      {/* Title bar */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-navy-800 rounded-t-xl border-b border-navy-700/50 cursor-move">
        <span className="text-sm font-medium text-navy-200">{modeLabel}</span>
        <div className="flex items-center gap-1">
          <button
            onClick={() => updateCompose({ isFullScreen: !compose.isFullScreen })}
            className="p-1 rounded text-navy-500 hover:text-navy-300 hover:bg-navy-700"
          >
            {compose.isFullScreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
          </button>
          <button
            onClick={closeCompose}
            className="p-1 rounded text-navy-500 hover:text-navy-300 hover:bg-navy-700"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {/* Fields */}
      <div className="px-4 py-2 space-y-0 border-b border-navy-700/50">
        {/* To */}
        <div className="flex items-center gap-2 py-1.5 border-b border-navy-700/30 relative">
          <label className="text-sm text-navy-500 w-10 flex-shrink-0">To</label>
          <input
            type="text"
            value={compose.to}
            onChange={(e) => updateCompose({ to: e.target.value })}
            onFocus={() => {
              setActiveField('to');
              setShowSuggestions(true);
            }}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
            className="flex-1 bg-transparent text-sm text-navy-200 outline-none placeholder-navy-600"
            placeholder="recipient@example.com"
          />
          <div className="flex items-center gap-1">
            {!showCc && (
              <button
                onClick={() => setShowCc(true)}
                className="text-xs text-navy-500 hover:text-navy-300 px-1"
              >
                Cc
              </button>
            )}
            {!showBcc && (
              <button
                onClick={() => setShowBcc(true)}
                className="text-xs text-navy-500 hover:text-navy-300 px-1"
              >
                Bcc
              </button>
            )}
          </div>
          {/* Contact suggestions */}
          {showSuggestions && activeField === 'to' && filteredContacts.length > 0 && (
            <div className="absolute top-full left-10 right-0 z-10 mt-1 bg-navy-800 border border-navy-700 rounded-lg shadow-xl max-h-40 overflow-y-auto">
              {filteredContacts.slice(0, 5).map((contact) => (
                <button
                  key={contact.id}
                  onMouseDown={() => selectContact('to', contact.email)}
                  className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-navy-700 text-sm"
                >
                  <span className="text-navy-200">{contact.name}</span>
                  <span className="text-navy-500 text-xs">{contact.email}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* CC */}
        {showCc && (
          <div className="flex items-center gap-2 py-1.5 border-b border-navy-700/30">
            <label className="text-sm text-navy-500 w-10 flex-shrink-0">Cc</label>
            <input
              type="text"
              value={compose.cc}
              onChange={(e) => updateCompose({ cc: e.target.value })}
              onFocus={() => {
                setActiveField('cc');
                setShowSuggestions(true);
              }}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
              className="flex-1 bg-transparent text-sm text-navy-200 outline-none placeholder-navy-600"
              placeholder="cc@example.com"
            />
            <button
              onClick={() => {
                setShowCc(false);
                updateCompose({ cc: '' });
              }}
              className="text-navy-600 hover:text-navy-400"
            >
              <ChevronUp size={14} />
            </button>
          </div>
        )}

        {/* BCC */}
        {showBcc && (
          <div className="flex items-center gap-2 py-1.5 border-b border-navy-700/30">
            <label className="text-sm text-navy-500 w-10 flex-shrink-0">Bcc</label>
            <input
              type="text"
              value={compose.bcc}
              onChange={(e) => updateCompose({ bcc: e.target.value })}
              onFocus={() => {
                setActiveField('bcc');
                setShowSuggestions(true);
              }}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
              className="flex-1 bg-transparent text-sm text-navy-200 outline-none placeholder-navy-600"
              placeholder="bcc@example.com"
            />
            <button
              onClick={() => {
                setShowBcc(false);
                updateCompose({ bcc: '' });
              }}
              className="text-navy-600 hover:text-navy-400"
            >
              <ChevronUp size={14} />
            </button>
          </div>
        )}

        {/* Subject */}
        <div className="flex items-center gap-2 py-1.5">
          <label className="text-sm text-navy-500 w-10 flex-shrink-0">Subj</label>
          <input
            type="text"
            value={compose.subject}
            onChange={(e) => updateCompose({ subject: e.target.value })}
            className="flex-1 bg-transparent text-sm text-navy-200 outline-none placeholder-navy-600"
            placeholder="Subject"
          />
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-0.5 px-4 py-1.5 border-b border-navy-700/30">
        <button
          onClick={() => execCommand('bold')}
          className="p-1.5 rounded text-navy-500 hover:text-navy-300 hover:bg-navy-800"
          title="Bold"
        >
          <Bold size={15} />
        </button>
        <button
          onClick={() => execCommand('italic')}
          className="p-1.5 rounded text-navy-500 hover:text-navy-300 hover:bg-navy-800"
          title="Italic"
        >
          <Italic size={15} />
        </button>
        <button
          onClick={() => execCommand('underline')}
          className="p-1.5 rounded text-navy-500 hover:text-navy-300 hover:bg-navy-800"
          title="Underline"
        >
          <Underline size={15} />
        </button>
        <div className="w-px h-4 bg-navy-700/50 mx-1" />
        <button
          onClick={() => execCommand('insertUnorderedList')}
          className="p-1.5 rounded text-navy-500 hover:text-navy-300 hover:bg-navy-800"
          title="Bullet list"
        >
          <List size={15} />
        </button>
        <button
          onClick={() => execCommand('insertOrderedList')}
          className="p-1.5 rounded text-navy-500 hover:text-navy-300 hover:bg-navy-800"
          title="Numbered list"
        >
          <ListOrdered size={15} />
        </button>
        <button
          onClick={() => {
            const url = prompt('Enter URL:');
            if (url) execCommand('createLink', url);
          }}
          className="p-1.5 rounded text-navy-500 hover:text-navy-300 hover:bg-navy-800"
          title="Insert link"
        >
          <Link size={15} />
        </button>
        <div className="w-px h-4 bg-navy-700/50 mx-1" />
        <button className="p-1.5 rounded text-navy-500 hover:text-navy-300 hover:bg-navy-800" title="Attach file">
          <Paperclip size={15} />
        </button>
        <div className="flex-1" />
        <button className="flex items-center gap-1 px-2 py-1 rounded text-xs bg-gradient-to-r from-violet-500/20 to-blue-500/20 text-accent-light border border-accent/20 hover:from-violet-500/30 hover:to-blue-500/30">
          <Sparkles size={13} />
          <span>AI Assist</span>
          <ChevronDown size={12} />
        </button>
      </div>

      {/* Editor */}
      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        data-placeholder="Write your message..."
        className="flex-1 min-h-[200px] px-4 py-3 text-sm text-navy-200 outline-none overflow-y-auto leading-relaxed"
        dangerouslySetInnerHTML={{ __html: compose.body }}
      />

      {/* Attachments drop zone */}
      {compose.attachments.length > 0 && (
        <div className="px-4 py-2 border-t border-navy-700/30">
          <div className="flex flex-wrap gap-2">
            {compose.attachments.map((file, i) => (
              <div
                key={i}
                className="flex items-center gap-2 px-2 py-1 bg-navy-800 rounded text-xs text-navy-400"
              >
                <Paperclip size={12} />
                <span>{file.name}</span>
                <button className="hover:text-navy-200">
                  <X size={12} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Footer actions */}
      <div className="flex items-center justify-between px-4 py-3 border-t border-navy-700/50">
        <div className="flex items-center gap-2">
          <button
            onClick={handleSend}
            disabled={isSending || !compose.to}
            className="flex items-center gap-2 px-5 py-2 bg-accent hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors shadow-lg shadow-accent/20"
          >
            <Send size={15} />
            <span>{isSending ? 'Sending...' : 'Send'}</span>
          </button>
          <button
            onClick={handleSaveDraft}
            className="flex items-center gap-1.5 px-3 py-2 text-sm text-navy-400 hover:text-navy-200 hover:bg-navy-800 rounded-lg transition-colors"
          >
            <Save size={15} />
            <span>Save Draft</span>
          </button>
        </div>
        <button
          onClick={closeCompose}
          className="p-2 text-navy-500 hover:text-danger hover:bg-navy-800 rounded-lg"
          title="Discard"
        >
          <Trash2 size={16} />
        </button>
      </div>
    </div>
  );
}
