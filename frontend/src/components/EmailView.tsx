import { useMemo, useState } from 'react';
import DOMPurify from 'dompurify';
import {
  Reply,
  ReplyAll,
  Forward,
  Trash2,
  Star,
  MoreHorizontal,
  Paperclip,
  FileText,
  Download,
  Sparkles,
  Mail,
  ChevronDown,
  Loader2,
  FileSpreadsheet,
  Image,
  File,
  Flag,
} from 'lucide-react';
import { format } from 'date-fns';
import { useEmailStore } from '../store/emailStore';
import { useSettingsStore } from '../store/settingsStore';
import type { Email, Attachment } from '../types';

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

function getFileIcon(mimeType: string) {
  if (mimeType.includes('pdf')) return FileText;
  if (mimeType.includes('spreadsheet') || mimeType.includes('excel')) return FileSpreadsheet;
  if (mimeType.includes('image')) return Image;
  return File;
}

function AttachmentItem({ attachment, isDark }: { attachment: Attachment; isDark: boolean }) {
  const Icon = getFileIcon(attachment.mimeType);
  const ext = attachment.filename.split('.').pop()?.toUpperCase() ?? '';

  return (
    <div className={`flex items-center gap-2.5 px-3 py-2 rounded border group cursor-pointer ${
      isDark
        ? 'bg-old-surface-alt border-old-border hover:border-old-text-tertiary'
        : 'bg-ol-bg border-ol-border hover:border-ol-text-tertiary'
    }`}>
      <div className={`p-1.5 rounded ${isDark ? 'bg-old-surface' : 'bg-ol-surface'}`}>
        <Icon size={16} className="text-accent" />
      </div>
      <div className="flex-1 min-w-0">
        <p className={`text-[12px] truncate ${isDark ? 'text-old-text' : 'text-ol-text'}`}>
          {attachment.filename}
        </p>
        <p className={`text-[11px] ${isDark ? 'text-old-text-tertiary' : 'text-ol-text-tertiary'}`}>
          {ext} {formatFileSize(attachment.size)}
        </p>
      </div>
      <button className={`p-1 rounded opacity-0 group-hover:opacity-100 ${
        isDark ? 'hover:bg-old-hover text-old-text-secondary' : 'hover:bg-ol-hover text-ol-text-secondary'
      }`}>
        <Download size={14} />
      </button>
    </div>
  );
}

function EmailHeader({ email, isDark }: { email: Email; isDark: boolean }) {
  const getInitials = (name: string) =>
    name.split(' ').map((n) => n.charAt(0)).slice(0, 2).join('').toUpperCase();

  const getColor = (name: string) => {
    const colors = ['#0078d4', '#8764b8', '#e3008c', '#ca5010', '#107c10', '#038387'];
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
    return colors[Math.abs(hash) % colors.length];
  };

  return (
    <div className="flex items-start gap-3">
      <div
        className="w-10 h-10 rounded-full flex items-center justify-center text-white text-[12px] font-semibold flex-shrink-0"
        style={{ backgroundColor: getColor(email.from.name) }}
      >
        {getInitials(email.from.name)}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className={`text-[14px] font-semibold ${isDark ? 'text-old-text' : 'text-ol-text'}`}>
            {email.from.name}
          </span>
          <span className={`text-[12px] ${isDark ? 'text-old-text-tertiary' : 'text-ol-text-tertiary'}`}>
            &lt;{email.from.email}&gt;
          </span>
        </div>
        <div className={`text-[12px] mt-0.5 ${isDark ? 'text-old-text-secondary' : 'text-ol-text-secondary'}`}>
          To: {email.to.map((r) => r.name || r.email).join(', ')}
        </div>
        {email.cc.length > 0 && (
          <div className={`text-[12px] ${isDark ? 'text-old-text-secondary' : 'text-ol-text-secondary'}`}>
            Cc: {email.cc.map((r) => r.name || r.email).join(', ')}
          </div>
        )}
        <div className={`text-[12px] mt-0.5 ${isDark ? 'text-old-text-tertiary' : 'text-ol-text-tertiary'}`}>
          {format(new Date(email.date), 'EEEE, MMMM d, yyyy h:mm a')}
        </div>
      </div>
    </div>
  );
}

function AISummaryCard({ isDark }: { isDark: boolean }) {
  const { ai, aiSummarize, aiCategorize, selectedEmailId } = useEmailStore();
  const [isExpanded, setIsExpanded] = useState(false);

  if (!selectedEmailId) return null;

  return (
    <div className={`rounded border ${isDark ? 'bg-old-surface-alt border-old-border' : 'bg-blue-50/50 border-blue-100'}`}>
      <button
        onClick={() => {
          setIsExpanded(!isExpanded);
          if (!isExpanded && !ai.summary) {
            aiSummarize();
          }
        }}
        className={`w-full flex items-center gap-2 px-3 py-2 text-[12px] ${
          isDark ? 'text-old-text-secondary hover:bg-old-hover' : 'text-ol-text-secondary hover:bg-blue-50'
        }`}
      >
        <Sparkles size={13} className="text-accent" />
        <span className="font-medium">AI Insights</span>
        <ChevronDown size={12} className={`ml-auto transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
      </button>

      {isExpanded && (
        <div className={`px-3 pb-3 space-y-2 border-t ${isDark ? 'border-old-border' : 'border-blue-100'}`}>
          {ai.isLoading ? (
            <div className="flex items-center gap-2 py-2">
              <Loader2 size={13} className="animate-spin text-accent" />
              <span className={`text-[12px] ${isDark ? 'text-old-text-tertiary' : 'text-ol-text-tertiary'}`}>
                Analyzing...
              </span>
            </div>
          ) : ai.summary ? (
            <div className="pt-2">
              <p className={`text-[12px] leading-relaxed ${isDark ? 'text-old-text-secondary' : 'text-ol-text-secondary'}`}>
                {ai.summary}
              </p>
              {ai.categories.length > 0 && (
                <div className="flex gap-1 mt-2">
                  {ai.categories.map((cat) => (
                    <span key={cat} className={`text-[10px] px-2 py-0.5 rounded-full ${
                      isDark ? 'bg-old-surface text-old-text-secondary' : 'bg-ol-bg text-ol-text-secondary'
                    }`}>
                      {cat}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="flex gap-2 pt-2">
              <button
                onClick={aiSummarize}
                className="px-2.5 py-1 text-[11px] rounded border border-accent text-accent hover:bg-accent/5"
              >
                Summarize
              </button>
              <button
                onClick={aiCategorize}
                className="px-2.5 py-1 text-[11px] rounded border border-accent text-accent hover:bg-accent/5"
              >
                Categorize
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function EmailView() {
  const {
    selectedEmailId,
    emails,
    openCompose,
    starEmail,
    flagEmail,
    deleteEmail,
  } = useEmailStore();

  const { theme } = useSettingsStore();
  const isDark = theme === 'dark';

  const email = emails.find((e) => e.id === selectedEmailId);

  const sanitizedBody = useMemo(() => {
    if (!email?.body) return '';
    return DOMPurify.sanitize(email.body, {
      ADD_ATTR: ['target', 'style'],
      ADD_TAGS: ['style'],
    });
  }, [email?.body]);

  if (!email) {
    return (
      <div className={`flex-1 flex flex-col items-center justify-center ${
        isDark ? 'bg-old-bg text-old-text-tertiary' : 'bg-ol-bg text-ol-text-tertiary'
      }`}>
        <Mail size={48} className="mb-4 opacity-20" />
        <p className="text-[15px] font-medium">Select an email to read</p>
        <p className="text-[12px] mt-1 opacity-60">
          Choose a message from the list to view its contents
        </p>
      </div>
    );
  }

  return (
    <div className={`flex-1 flex flex-col min-w-0 ${isDark ? 'bg-old-bg' : 'bg-ol-surface'}`}>
      {/* Action bar */}
      <div className={`flex items-center gap-1 px-4 py-2 border-b ${
        isDark ? 'border-old-border' : 'border-ol-border'
      }`}>
        <ActionButton icon={Reply} label="Reply" isDark={isDark}
          onClick={() => openCompose('reply', email.id)} />
        <ActionButton icon={ReplyAll} label="Reply All" isDark={isDark}
          onClick={() => openCompose('replyAll', email.id)} />
        <ActionButton icon={Forward} label="Forward" isDark={isDark}
          onClick={() => openCompose('forward', email.id)} />

        <div className={`w-px h-4 mx-1 ${isDark ? 'bg-old-border' : 'bg-ol-border'}`} />

        <button
          onClick={() => starEmail(email.id)}
          className={`p-1.5 rounded ${
            email.isStarred ? 'text-warning' : isDark ? 'text-old-text-tertiary hover:text-warning' : 'text-ol-text-tertiary hover:text-warning'
          } ${isDark ? 'hover:bg-old-hover' : 'hover:bg-ol-hover'}`}
          title="Star"
        >
          <Star size={15} fill={email.isStarred ? 'currentColor' : 'none'} />
        </button>
        <button
          onClick={() => flagEmail(email.id)}
          className={`p-1.5 rounded ${
            email.isFlagged ? 'text-danger' : isDark ? 'text-old-text-tertiary hover:text-danger' : 'text-ol-text-tertiary hover:text-danger'
          } ${isDark ? 'hover:bg-old-hover' : 'hover:bg-ol-hover'}`}
          title="Flag"
        >
          <Flag size={15} fill={email.isFlagged ? 'currentColor' : 'none'} />
        </button>
        <button
          onClick={() => deleteEmail(email.id)}
          className={`p-1.5 rounded ${isDark ? 'text-old-text-tertiary hover:text-danger hover:bg-old-hover' : 'text-ol-text-tertiary hover:text-danger hover:bg-ol-hover'}`}
          title="Delete"
        >
          <Trash2 size={15} />
        </button>
        <button
          className={`p-1.5 rounded ${isDark ? 'text-old-text-tertiary hover:bg-old-hover' : 'text-ol-text-tertiary hover:bg-ol-hover'}`}
          title="More actions"
        >
          <MoreHorizontal size={15} />
        </button>
      </div>

      {/* Email Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-4xl px-6 py-5">
          {/* Subject */}
          <h1 className={`text-[20px] font-semibold mb-4 ${isDark ? 'text-old-text' : 'text-ol-text'}`}>
            {email.subject}
          </h1>

          {/* AI Summary card */}
          <div className="mb-4">
            <AISummaryCard isDark={isDark} />
          </div>

          {/* From header */}
          <EmailHeader email={email} isDark={isDark} />

          {/* Attachments */}
          {email.hasAttachments && email.attachments.length > 0 && (
            <div className={`mt-4 pt-3 border-t ${isDark ? 'border-old-border' : 'border-ol-border'}`}>
              <div className="flex items-center gap-2 mb-2">
                <Paperclip size={13} className={isDark ? 'text-old-text-secondary' : 'text-ol-text-secondary'} />
                <span className={`text-[12px] font-medium ${isDark ? 'text-old-text-secondary' : 'text-ol-text-secondary'}`}>
                  {email.attachments.length} attachment{email.attachments.length > 1 ? 's' : ''}
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                {email.attachments.map((att) => (
                  <AttachmentItem key={att.id} attachment={att} isDark={isDark} />
                ))}
              </div>
            </div>
          )}

          {/* Body */}
          <div
            className={`mt-5 text-[13px] leading-relaxed ${
              isDark
                ? 'text-old-text [&_a]:text-accent-light [&_h1]:text-old-text [&_h2]:text-old-text [&_h3]:text-old-text [&_strong]:text-old-text'
                : 'text-ol-text [&_a]:text-accent [&_h1]:text-ol-text [&_h2]:text-ol-text [&_h3]:text-ol-text'
            }
            [&_a]:no-underline [&_a:hover]:underline
            [&_table]:border-collapse [&_td]:p-2 [&_th]:p-2
            [&_blockquote]:border-l-2 [&_blockquote]:border-accent/30 [&_blockquote]:pl-4
            [&_code]:bg-gray-100 [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-[12px]
            [&_img]:max-w-full [&_img]:rounded
            [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5
            [&_p]:mb-2`}
            dangerouslySetInnerHTML={{ __html: sanitizedBody }}
          />
        </div>
      </div>
    </div>
  );
}

function ActionButton({
  icon: Icon,
  label,
  isDark,
  onClick,
}: {
  icon: typeof Reply;
  label: string;
  isDark: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1 px-2.5 py-1.5 rounded text-[12px] ${
        isDark
          ? 'text-old-text-secondary hover:text-old-text hover:bg-old-hover'
          : 'text-ol-text-secondary hover:text-ol-text hover:bg-ol-hover'
      }`}
    >
      <Icon size={15} />
      <span>{label}</span>
    </button>
  );
}
