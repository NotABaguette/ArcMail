import { useCallback, useRef, useState } from 'react';
import {
  Star,
  Paperclip,
  Flag,
  Trash2,
  Inbox,
  RefreshCw,
} from 'lucide-react';
import { format, isToday, isYesterday, isThisYear } from 'date-fns';
import { useEmailStore } from '../store/emailStore';
import { useSettingsStore } from '../store/settingsStore';
import { SearchBar } from './SearchBar';
import type { Email, Priority } from '../types';

const PRIORITY_COLORS: Record<Priority, string> = {
  critical: '#d13438',
  high: '#f7630c',
  normal: '',
  low: '#107c10',
  none: '',
};

function formatEmailDate(dateStr: string): string {
  const date = new Date(dateStr);
  if (isToday(date)) return format(date, 'h:mm a');
  if (isYesterday(date)) return 'Yesterday';
  if (isThisYear(date)) return format(date, 'MMM d');
  return format(date, 'M/d/yyyy');
}

function getInitials(name: string): string {
  return name.split(' ').map((n) => n.charAt(0)).slice(0, 2).join('').toUpperCase();
}

function getAvatarColor(name: string): string {
  const colors = [
    '#0078d4', '#8764b8', '#e3008c', '#ca5010', '#107c10',
    '#038387', '#5c2d91', '#c239b3', '#00b7c3', '#4f6bed',
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

function EmailItemCompact({
  email,
  isSelected,
  isDark,
  onSelect,
  onStar,
  onFlag,
  onDelete,
}: {
  email: Email;
  isSelected: boolean;
  isDark: boolean;
  onSelect: () => void;
  onStar: () => void;
  onFlag: () => void;
  onDelete: () => void;
}) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <button
      onClick={onSelect}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={`w-full text-left flex items-center px-3 py-1.5 border-b ${
        isSelected
          ? isDark ? 'bg-old-selected border-old-border' : 'bg-ol-selected border-ol-border'
          : isDark ? 'border-old-border-subtle hover:bg-old-hover' : 'border-ol-border-subtle hover:bg-ol-hover'
      } ${!email.isRead ? 'font-semibold' : ''}`}
    >
      {/* Unread indicator */}
      <div className="w-1 mr-2 flex-shrink-0">
        {!email.isRead && <div className="w-1 h-1 rounded-full bg-accent" />}
      </div>

      {/* Avatar */}
      <div
        className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[10px] font-semibold flex-shrink-0 mr-2.5"
        style={{ backgroundColor: getAvatarColor(email.from.name) }}
      >
        {getInitials(email.from.name)}
      </div>

      {/* Sender */}
      <span className={`w-36 truncate flex-shrink-0 text-[13px] mr-3 ${
        !email.isRead
          ? isDark ? 'text-old-text' : 'text-ol-text'
          : isDark ? 'text-old-text-secondary' : 'text-ol-text-secondary'
      }`}>
        {email.from.name}
      </span>

      {/* Priority dot */}
      {PRIORITY_COLORS[email.priority] && (
        <span
          className="w-2 h-2 rounded-full flex-shrink-0 mr-1.5"
          style={{ backgroundColor: PRIORITY_COLORS[email.priority] }}
        />
      )}

      {/* Subject + Preview */}
      <span className="flex-1 truncate text-[13px] mr-3">
        <span className={!email.isRead ? (isDark ? 'text-old-text' : 'text-ol-text') : (isDark ? 'text-old-text-secondary' : 'text-ol-text-secondary')}>
          {email.subject}
        </span>
        <span className={`font-normal ${isDark ? 'text-old-text-tertiary' : 'text-ol-text-tertiary'}`}>
          {' '} - {email.preview}
        </span>
      </span>

      {/* Hover actions */}
      {isHovered && (
        <div className="flex items-center gap-0.5 mr-2 flex-shrink-0">
          <button onClick={(e) => { e.stopPropagation(); onDelete(); }}
            className={`p-1 rounded ${isDark ? 'hover:bg-old-surface-alt text-old-text-tertiary hover:text-danger' : 'hover:bg-ol-bg text-ol-text-tertiary hover:text-danger'}`}>
            <Trash2 size={13} />
          </button>
          <button onClick={(e) => { e.stopPropagation(); onFlag(); }}
            className={`p-1 rounded ${isDark ? 'hover:bg-old-surface-alt' : 'hover:bg-ol-bg'} ${email.isFlagged ? 'text-danger' : isDark ? 'text-old-text-tertiary' : 'text-ol-text-tertiary'}`}>
            <Flag size={13} fill={email.isFlagged ? 'currentColor' : 'none'} />
          </button>
        </div>
      )}

      {/* Attachment icon */}
      {email.hasAttachments && (
        <Paperclip size={13} className={`flex-shrink-0 mr-2 ${isDark ? 'text-old-text-tertiary' : 'text-ol-text-tertiary'}`} />
      )}

      {/* Star */}
      {!isHovered && (
        <button
          onClick={(e) => { e.stopPropagation(); onStar(); }}
          className={`flex-shrink-0 mr-2 ${
            email.isStarred ? 'text-warning' : 'text-transparent'
          }`}
        >
          <Star size={13} fill={email.isStarred ? 'currentColor' : 'none'} />
        </button>
      )}

      {/* Flag indicator (when not hovered) */}
      {!isHovered && email.isFlagged && (
        <Flag size={12} className="text-danger flex-shrink-0 mr-2" fill="currentColor" />
      )}

      {/* Date */}
      <span className={`flex-shrink-0 text-[12px] w-16 text-right ${isDark ? 'text-old-text-tertiary' : 'text-ol-text-tertiary'}`}>
        {formatEmailDate(email.date)}
      </span>
    </button>
  );
}

function EmailItemComfortable({
  email,
  isSelected,
  isDark,
  onSelect,
  onStar,
  onFlag,
  onDelete,
}: {
  email: Email;
  isSelected: boolean;
  isDark: boolean;
  onSelect: () => void;
  onStar: () => void;
  onFlag: () => void;
  onDelete: () => void;
}) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <button
      onClick={onSelect}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={`w-full text-left px-3 py-2 border-b ${
        !email.isRead ? `border-l-2 border-l-accent` : 'border-l-2 border-l-transparent'
      } ${
        isSelected
          ? isDark ? 'bg-old-selected border-b-old-border' : 'bg-ol-selected border-b-ol-border'
          : isDark ? 'border-b-old-border-subtle hover:bg-old-hover' : 'border-b-ol-border-subtle hover:bg-ol-hover'
      }`}
    >
      <div className="flex items-start gap-2.5">
        {/* Avatar */}
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center text-white text-[10px] font-semibold flex-shrink-0 mt-0.5"
          style={{ backgroundColor: getAvatarColor(email.from.name) }}
        >
          {getInitials(email.from.name)}
        </div>

        <div className="flex-1 min-w-0">
          {/* Line 1: Sender + Date */}
          <div className="flex items-center justify-between gap-2">
            <span className={`text-[13px] truncate ${
              !email.isRead
                ? isDark ? 'font-semibold text-old-text' : 'font-semibold text-ol-text'
                : isDark ? 'text-old-text-secondary' : 'text-ol-text-secondary'
            }`}>
              {email.from.name}
            </span>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              {/* Hover actions */}
              {isHovered && (
                <div className="flex items-center gap-0.5">
                  <button onClick={(e) => { e.stopPropagation(); onDelete(); }}
                    className={`p-0.5 rounded ${isDark ? 'text-old-text-tertiary hover:text-danger' : 'text-ol-text-tertiary hover:text-danger'}`}>
                    <Trash2 size={13} />
                  </button>
                  <button onClick={(e) => { e.stopPropagation(); onFlag(); }}
                    className={`p-0.5 rounded ${email.isFlagged ? 'text-danger' : isDark ? 'text-old-text-tertiary' : 'text-ol-text-tertiary'}`}>
                    <Flag size={13} fill={email.isFlagged ? 'currentColor' : 'none'} />
                  </button>
                  <button onClick={(e) => { e.stopPropagation(); onStar(); }}
                    className={`p-0.5 rounded ${email.isStarred ? 'text-warning' : isDark ? 'text-old-text-tertiary' : 'text-ol-text-tertiary'}`}>
                    <Star size={13} fill={email.isStarred ? 'currentColor' : 'none'} />
                  </button>
                </div>
              )}
              {!isHovered && email.hasAttachments && (
                <Paperclip size={12} className={isDark ? 'text-old-text-tertiary' : 'text-ol-text-tertiary'} />
              )}
              {!isHovered && email.isFlagged && (
                <Flag size={12} className="text-danger" fill="currentColor" />
              )}
              <span className={`text-[11px] ${isDark ? 'text-old-text-tertiary' : 'text-ol-text-tertiary'}`}>
                {formatEmailDate(email.date)}
              </span>
            </div>
          </div>

          {/* Line 2: Subject */}
          <div className={`text-[13px] truncate ${
            !email.isRead
              ? isDark ? 'font-semibold text-old-text' : 'font-semibold text-ol-text'
              : isDark ? 'text-old-text-secondary' : 'text-ol-text-secondary'
          }`}>
            {PRIORITY_COLORS[email.priority] && (
              <span
                className="inline-block w-1.5 h-1.5 rounded-full mr-1.5 relative top-[-1px]"
                style={{ backgroundColor: PRIORITY_COLORS[email.priority] }}
              />
            )}
            {email.subject}
          </div>

          {/* Line 3: Preview */}
          <div className={`text-[12px] truncate mt-0.5 ${isDark ? 'text-old-text-tertiary' : 'text-ol-text-tertiary'}`}>
            {email.preview}
          </div>

          {/* Category dots / labels */}
          {email.labels.length > 0 && (
            <div className="flex gap-1 mt-1">
              {email.labels.slice(0, 3).map((label) => (
                <span
                  key={label}
                  className={`text-[10px] px-1.5 py-0.5 rounded ${
                    isDark ? 'bg-old-surface-alt text-old-text-tertiary' : 'bg-ol-bg text-ol-text-tertiary'
                  }`}
                >
                  {label}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </button>
  );
}

export function EmailList() {
  const {
    selectedEmailId,
    isLoading,
    activeFolderId,
    folders,
    activeInboxTab,
    selectEmail,
    starEmail,
    flagEmail,
    deleteEmail,
    refreshEmails,
    setActiveInboxTab,
    getFilteredEmails,
  } = useEmailStore();

  const { theme, display } = useSettingsStore();
  const isDark = theme === 'dark';

  const listRef = useRef<HTMLDivElement>(null);
  const emails = getFilteredEmails();
  const activeFolder = folders.find((f) => f.id === activeFolderId);
  const isInbox = activeFolder?.type === 'inbox';

  const handleRefresh = useCallback(() => {
    refreshEmails();
  }, [refreshEmails]);

  const EmailItemComponent = display.viewMode === 'compact' ? EmailItemCompact : EmailItemComfortable;

  return (
    <div className={`flex flex-col w-80 min-w-[320px] border-r ${
      isDark ? 'bg-old-surface border-old-border' : 'bg-ol-surface border-ol-border'
    }`}>
      {/* Header */}
      <div className={`px-3 pt-3 pb-0 border-b ${isDark ? 'border-old-border' : 'border-ol-border'}`}>
        <div className="flex items-center justify-between mb-2">
          <h2 className={`text-[15px] font-semibold ${isDark ? 'text-old-text' : 'text-ol-text'}`}>
            {activeFolder?.name ?? 'Inbox'}
          </h2>
          <button
            onClick={handleRefresh}
            className={`p-1 rounded ${
              isDark ? 'text-old-text-tertiary hover:text-old-text hover:bg-old-hover' : 'text-ol-text-tertiary hover:text-ol-text hover:bg-ol-hover'
            } ${isLoading ? 'animate-spin' : ''}`}
            title="Refresh"
          >
            <RefreshCw size={14} />
          </button>
        </div>

        {/* Focused / Other tabs (only for Inbox) */}
        {isInbox && (
          <div className="flex gap-0">
            <button
              onClick={() => setActiveInboxTab('focused')}
              className={`px-3 py-1.5 text-[13px] font-medium border-b-2 ${
                activeInboxTab === 'focused'
                  ? 'text-accent border-accent'
                  : `border-transparent ${isDark ? 'text-old-text-secondary hover:text-old-text' : 'text-ol-text-secondary hover:text-ol-text'}`
              }`}
            >
              Focused
            </button>
            <button
              onClick={() => setActiveInboxTab('other')}
              className={`px-3 py-1.5 text-[13px] font-medium border-b-2 ${
                activeInboxTab === 'other'
                  ? 'text-accent border-accent'
                  : `border-transparent ${isDark ? 'text-old-text-secondary hover:text-old-text' : 'text-ol-text-secondary hover:text-ol-text'}`
              }`}
            >
              Other
            </button>
          </div>
        )}
      </div>

      {/* Filter pills */}
      <SearchBar />

      {/* Email List */}
      <div ref={listRef} className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="space-y-0 p-0">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className={`animate-pulse flex items-center gap-3 px-3 py-2.5 border-b ${
                isDark ? 'border-old-border-subtle' : 'border-ol-border-subtle'
              }`}>
                <div className={`w-8 h-8 rounded-full ${isDark ? 'bg-old-surface-alt' : 'bg-ol-bg'}`} />
                <div className="flex-1 space-y-1.5">
                  <div className={`h-3 rounded w-1/3 ${isDark ? 'bg-old-surface-alt' : 'bg-ol-bg'}`} />
                  <div className={`h-3 rounded w-2/3 ${isDark ? 'bg-old-surface-alt' : 'bg-ol-bg'}`} />
                  <div className={`h-2 rounded w-full ${isDark ? 'bg-old-surface-alt' : 'bg-ol-bg'}`} />
                </div>
              </div>
            ))}
          </div>
        ) : emails.length === 0 ? (
          <div className={`flex flex-col items-center justify-center h-full py-20 ${isDark ? 'text-old-text-tertiary' : 'text-ol-text-tertiary'}`}>
            <Inbox size={36} className="mb-3 opacity-40" />
            <p className="text-[13px] font-medium">No emails found</p>
            <p className="text-[12px] mt-1">This folder is empty</p>
          </div>
        ) : (
          emails.map((email) => (
            <EmailItemComponent
              key={email.id}
              email={email}
              isSelected={email.id === selectedEmailId}
              isDark={isDark}
              onSelect={() => selectEmail(email.id)}
              onStar={() => starEmail(email.id)}
              onFlag={() => flagEmail(email.id)}
              onDelete={() => deleteEmail(email.id)}
            />
          ))
        )}
      </div>
    </div>
  );
}
