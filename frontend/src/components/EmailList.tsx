import { useCallback, useRef } from 'react';
import {
  Search,
  Star,
  Paperclip,
  ArrowUpDown,
  RefreshCw,
  X,
  Inbox,
} from 'lucide-react';
import { formatDistanceToNow, format, isToday, isYesterday, isThisYear } from 'date-fns';
import { useEmailStore } from '../store/emailStore';
import type { Email, Priority } from '../types';

const PRIORITY_COLORS: Record<Priority, string> = {
  critical: 'bg-red-500',
  high: 'bg-orange-400',
  normal: 'bg-transparent',
  low: 'bg-emerald-400',
  none: 'bg-transparent',
};

function formatEmailDate(dateStr: string): string {
  const date = new Date(dateStr);
  if (isToday(date)) {
    return format(date, 'h:mm a');
  }
  if (isYesterday(date)) {
    return 'Yesterday';
  }
  if (isThisYear(date)) {
    return format(date, 'MMM d');
  }
  return format(date, 'MMM d, yyyy');
}

function formatRelativeDate(dateStr: string): string {
  return formatDistanceToNow(new Date(dateStr), { addSuffix: true });
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n.charAt(0))
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

function getAvatarColor(name: string): string {
  const colors = [
    '#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981',
    '#06b6d4', '#6366f1', '#f43f5e', '#14b8a6', '#a855f7',
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

function EmailItem({
  email,
  isSelected,
  onSelect,
  onStar,
}: {
  email: Email;
  isSelected: boolean;
  onSelect: () => void;
  onStar: () => void;
}) {
  return (
    <button
      onClick={onSelect}
      className={`w-full text-left px-4 py-3 border-b transition-colors ${
        isSelected
          ? 'bg-accent/10 border-accent/20 dark:bg-accent/10'
          : 'border-navy-700/30 hover:bg-navy-800/50 dark:border-navy-700/30 dark:hover:bg-navy-800/50'
      } ${!email.isRead ? 'bg-navy-800/30' : ''}`}
    >
      <div className="flex items-start gap-3">
        {/* Priority indicator + Avatar */}
        <div className="relative flex-shrink-0">
          <div
            className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-semibold"
            style={{ backgroundColor: getAvatarColor(email.from.name) }}
          >
            {getInitials(email.from.name)}
          </div>
          {email.priority !== 'normal' && email.priority !== 'none' && (
            <span
              className={`absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-navy-900 ${PRIORITY_COLORS[email.priority]}`}
            />
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span
              className={`text-sm truncate ${
                !email.isRead
                  ? 'font-semibold text-navy-100'
                  : 'font-medium text-navy-400'
              }`}
            >
              {email.from.name}
            </span>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              {email.hasAttachments && (
                <Paperclip size={13} className="text-navy-500" />
              )}
              <span className="text-xs text-navy-500" title={formatRelativeDate(email.date)}>
                {formatEmailDate(email.date)}
              </span>
            </div>
          </div>
          <div
            className={`text-sm truncate mt-0.5 ${
              !email.isRead ? 'text-navy-200 font-medium' : 'text-navy-400'
            }`}
          >
            {email.subject}
          </div>
          <div className="flex items-center gap-2 mt-1">
            <p className="text-xs text-navy-500 truncate flex-1">
              {email.preview}
            </p>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onStar();
              }}
              className={`flex-shrink-0 p-0.5 rounded transition-colors ${
                email.isStarred
                  ? 'text-yellow-400'
                  : 'text-transparent hover:text-navy-500'
              }`}
            >
              <Star size={14} fill={email.isStarred ? 'currentColor' : 'none'} />
            </button>
          </div>
          {/* Labels */}
          {email.labels.length > 0 && (
            <div className="flex gap-1 mt-1.5">
              {email.labels.slice(0, 3).map((label) => (
                <span
                  key={label}
                  className="text-[10px] px-1.5 py-0.5 rounded bg-navy-700/50 text-navy-400"
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
    searchQuery,
    sortBy,
    isLoading,
    activeFolderId,
    folders,
    selectEmail,
    starEmail,
    setSearchQuery,
    setSortBy,
    refreshEmails,
    getFilteredEmails,
  } = useEmailStore();

  const listRef = useRef<HTMLDivElement>(null);
  const emails = getFilteredEmails();
  const activeFolder = folders.find((f) => f.id === activeFolderId);

  const handleRefresh = useCallback(() => {
    refreshEmails();
  }, [refreshEmails]);

  return (
    <div className="flex flex-col w-80 min-w-[320px] bg-navy-900/50 dark:bg-navy-900/50 border-r border-navy-700/50">
      {/* Header */}
      <div className="px-4 py-3 border-b border-navy-700/50">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-semibold text-navy-100">
            {activeFolder?.name ?? 'Inbox'}
          </h2>
          <div className="flex items-center gap-1">
            <button
              onClick={handleRefresh}
              className={`p-1.5 rounded-lg text-navy-500 hover:text-navy-300 hover:bg-navy-800 ${
                isLoading ? 'animate-spin' : ''
              }`}
              title="Refresh"
            >
              <RefreshCw size={16} />
            </button>
            <button
              onClick={() => {
                const options: Array<'date' | 'priority' | 'unread' | 'sender'> = [
                  'date', 'priority', 'unread', 'sender',
                ];
                const idx = options.indexOf(sortBy as 'date' | 'priority' | 'unread' | 'sender');
                setSortBy(options[(idx + 1) % options.length]);
              }}
              className="p-1.5 rounded-lg text-navy-500 hover:text-navy-300 hover:bg-navy-800"
              title={`Sort by: ${sortBy}`}
            >
              <ArrowUpDown size={16} />
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-navy-500"
          />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search emails..."
            className="w-full pl-9 pr-8 py-2 bg-navy-800 text-navy-200 text-sm rounded-lg border border-navy-700/50 focus:border-accent/50 focus:outline-none focus:ring-1 focus:ring-accent/30 placeholder-navy-500"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-navy-500 hover:text-navy-300"
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Sort indicator */}
        {sortBy !== 'date' && (
          <div className="mt-2 flex items-center gap-1.5">
            <span className="text-xs text-navy-500">Sorted by:</span>
            <span className="text-xs text-accent font-medium">{sortBy}</span>
          </div>
        )}
      </div>

      {/* Email List */}
      <div ref={listRef} className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="space-y-1 p-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="animate-pulse flex items-start gap-3 py-3">
                <div className="w-9 h-9 bg-navy-800 rounded-full" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 bg-navy-800 rounded w-2/3" />
                  <div className="h-3 bg-navy-800 rounded w-full" />
                  <div className="h-2 bg-navy-800 rounded w-4/5" />
                </div>
              </div>
            ))}
          </div>
        ) : emails.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-navy-500 py-20">
            <Inbox size={40} className="mb-3 opacity-40" />
            <p className="text-sm font-medium">No emails found</p>
            <p className="text-xs mt-1">
              {searchQuery ? 'Try a different search term' : 'This folder is empty'}
            </p>
          </div>
        ) : (
          emails.map((email) => (
            <EmailItem
              key={email.id}
              email={email}
              isSelected={email.id === selectedEmailId}
              onSelect={() => selectEmail(email.id)}
              onStar={() => starEmail(email.id)}
            />
          ))
        )}
      </div>

      {/* Footer count */}
      <div className="px-4 py-2 border-t border-navy-700/50 text-xs text-navy-500">
        {emails.length} email{emails.length !== 1 ? 's' : ''}
        {searchQuery && ` matching "${searchQuery}"`}
      </div>
    </div>
  );
}
