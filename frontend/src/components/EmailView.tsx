import { useMemo } from 'react';
import DOMPurify from 'dompurify';
import {
  Reply,
  ReplyAll,
  Forward,
  Archive,
  Trash2,
  Star,
  FolderInput,
  MoreHorizontal,
  Paperclip,
  FileText,
  Download,
  Sparkles,
  Mail,
} from 'lucide-react';
import { format } from 'date-fns';
import { useEmailStore } from '../store/emailStore';
import type { Email, Attachment } from '../types';

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

function getFileIcon(_mimeType: string) {
  return FileText;
}

function AttachmentItem({ attachment }: { attachment: Attachment }) {
  const Icon = getFileIcon(attachment.mimeType);
  return (
    <div className="flex items-center gap-3 px-3 py-2.5 bg-navy-800/70 rounded-lg border border-navy-700/50 hover:border-navy-600/50 transition-colors group">
      <div className="p-2 bg-navy-700/50 rounded-lg">
        <Icon size={18} className="text-navy-400" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-navy-200 truncate">{attachment.filename}</p>
        <p className="text-xs text-navy-500">{formatFileSize(attachment.size)}</p>
      </div>
      <button className="p-1.5 rounded-lg text-navy-500 hover:text-navy-300 opacity-0 group-hover:opacity-100 transition-opacity">
        <Download size={16} />
      </button>
    </div>
  );
}

function EmailHeader({ email }: { email: Email }) {
  const getInitials = (name: string) =>
    name.split(' ').map((n) => n.charAt(0)).slice(0, 2).join('').toUpperCase();

  const getColor = (name: string) => {
    const colors = ['#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#06b6d4'];
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
    return colors[Math.abs(hash) % colors.length];
  };

  return (
    <div className="flex items-start gap-4">
      <div
        className="w-11 h-11 rounded-full flex items-center justify-center text-white text-sm font-semibold flex-shrink-0"
        style={{ backgroundColor: getColor(email.from.name) }}
      >
        {getInitials(email.from.name)}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-navy-100">{email.from.name}</span>
          <span className="text-xs text-navy-500">&lt;{email.from.email}&gt;</span>
        </div>
        <div className="flex items-center gap-1 mt-0.5 text-xs text-navy-500">
          <span>To: </span>
          {email.to.map((r, i) => (
            <span key={r.email}>
              {r.name || r.email}
              {i < email.to.length - 1 ? ', ' : ''}
            </span>
          ))}
        </div>
        {email.cc.length > 0 && (
          <div className="flex items-center gap-1 text-xs text-navy-500">
            <span>CC: </span>
            {email.cc.map((r, i) => (
              <span key={r.email}>
                {r.name || r.email}
                {i < email.cc.length - 1 ? ', ' : ''}
              </span>
            ))}
          </div>
        )}
        <div className="text-xs text-navy-500 mt-0.5">
          {format(new Date(email.date), 'EEEE, MMMM d, yyyy \'at\' h:mm a')}
        </div>
      </div>
    </div>
  );
}

export function EmailView() {
  const {
    selectedEmailId,
    emails,
    openCompose,
    starEmail,
    deleteEmail,
    moveEmail,
    folders,
    toggleAIPanel,
  } = useEmailStore();

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
      <div className="flex-1 flex flex-col items-center justify-center bg-navy-900/30 dark:bg-navy-900/30 text-navy-500">
        <Mail size={56} className="mb-4 opacity-30" />
        <p className="text-lg font-medium">Select an email to read</p>
        <p className="text-sm mt-1 text-navy-600">
          Choose an email from the list to view its contents
        </p>
      </div>
    );
  }

  const archiveFolder = folders.find((f) => f.type === 'archive');

  return (
    <div className="flex-1 flex flex-col bg-navy-900/30 dark:bg-navy-900/30 min-w-0">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-navy-700/50">
        <div className="flex items-center gap-1">
          <button
            onClick={() => openCompose('reply', email.id)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-navy-300 hover:text-white hover:bg-navy-800 transition-colors"
            title="Reply"
          >
            <Reply size={16} />
            <span className="hidden lg:inline">Reply</span>
          </button>
          <button
            onClick={() => openCompose('replyAll', email.id)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-navy-300 hover:text-white hover:bg-navy-800 transition-colors"
            title="Reply All"
          >
            <ReplyAll size={16} />
            <span className="hidden lg:inline">Reply All</span>
          </button>
          <button
            onClick={() => openCompose('forward', email.id)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-navy-300 hover:text-white hover:bg-navy-800 transition-colors"
            title="Forward"
          >
            <Forward size={16} />
            <span className="hidden lg:inline">Forward</span>
          </button>

          <div className="w-px h-5 bg-navy-700/50 mx-1" />

          {archiveFolder && (
            <button
              onClick={() => moveEmail(email.id, archiveFolder.id)}
              className="p-1.5 rounded-lg text-navy-400 hover:text-navy-200 hover:bg-navy-800"
              title="Archive"
            >
              <Archive size={16} />
            </button>
          )}
          <button
            onClick={() => deleteEmail(email.id)}
            className="p-1.5 rounded-lg text-navy-400 hover:text-danger hover:bg-navy-800"
            title="Delete"
          >
            <Trash2 size={16} />
          </button>
          <button
            onClick={() => starEmail(email.id)}
            className={`p-1.5 rounded-lg hover:bg-navy-800 ${
              email.isStarred ? 'text-yellow-400' : 'text-navy-400 hover:text-yellow-400'
            }`}
            title="Star"
          >
            <Star size={16} fill={email.isStarred ? 'currentColor' : 'none'} />
          </button>
          <button
            className="p-1.5 rounded-lg text-navy-400 hover:text-navy-200 hover:bg-navy-800"
            title="Move to..."
          >
            <FolderInput size={16} />
          </button>
          <button
            className="p-1.5 rounded-lg text-navy-400 hover:text-navy-200 hover:bg-navy-800"
            title="More"
          >
            <MoreHorizontal size={16} />
          </button>
        </div>

        <button
          onClick={toggleAIPanel}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm bg-gradient-to-r from-violet-500/20 to-blue-500/20 text-accent-light hover:from-violet-500/30 hover:to-blue-500/30 border border-accent/20 transition-all"
        >
          <Sparkles size={16} />
          <span>AI Assist</span>
        </button>
      </div>

      {/* Email Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto px-6 py-6">
          {/* Subject */}
          <h1 className="text-xl font-semibold text-navy-100 mb-4">{email.subject}</h1>

          {/* Labels */}
          {email.labels.length > 0 && (
            <div className="flex gap-1.5 mb-4">
              {email.labels.map((label) => (
                <span
                  key={label}
                  className="text-xs px-2 py-0.5 rounded-full bg-navy-800 text-navy-400 border border-navy-700/50"
                >
                  {label}
                </span>
              ))}
            </div>
          )}

          {/* From header */}
          <EmailHeader email={email} />

          {/* Body */}
          <div
            className="mt-6 text-navy-300 leading-relaxed prose prose-invert prose-sm max-w-none
              [&_a]:text-accent [&_a]:no-underline [&_a:hover]:underline
              [&_h1]:text-navy-100 [&_h2]:text-navy-100 [&_h3]:text-navy-200
              [&_strong]:text-navy-200
              [&_table]:border-collapse [&_td]:p-2 [&_th]:p-2
              [&_blockquote]:border-l-2 [&_blockquote]:border-accent/30 [&_blockquote]:pl-4 [&_blockquote]:text-navy-400
              [&_code]:bg-navy-800 [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-xs
              [&_img]:max-w-full [&_img]:rounded-lg"
            dangerouslySetInnerHTML={{ __html: sanitizedBody }}
          />

          {/* Attachments */}
          {email.hasAttachments && email.attachments.length > 0 && (
            <div className="mt-8 pt-6 border-t border-navy-700/50">
              <div className="flex items-center gap-2 mb-3">
                <Paperclip size={16} className="text-navy-400" />
                <h3 className="text-sm font-medium text-navy-300">
                  {email.attachments.length} Attachment{email.attachments.length > 1 ? 's' : ''}
                </h3>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {email.attachments.map((att) => (
                  <AttachmentItem key={att.id} attachment={att} />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
