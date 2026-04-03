import { useState } from 'react';
import { Search, X, Paperclip, Mail, Clock, Filter } from 'lucide-react';
import { useEmailStore } from '../store/emailStore';
import { useSettingsStore } from '../store/settingsStore';

export function SearchBar() {
  const { searchQuery, searchFilters, setSearchQuery, setSearchFilters } = useEmailStore();
  const { theme } = useSettingsStore();
  const isDark = theme === 'dark';
  const [showFilters, setShowFilters] = useState(false);

  const activeFilterCount = [
    searchFilters.isUnread,
    searchFilters.isFlagged,
    searchFilters.hasAttachment,
    searchFilters.from,
  ].filter(Boolean).length;

  return (
    <div className="relative">
      {/* Filter pills */}
      <div className="flex items-center gap-1.5 px-3 py-1.5">
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`flex items-center gap-1 px-2 py-1 rounded text-[12px] border ${
            activeFilterCount > 0
              ? 'border-accent text-accent bg-accent/5'
              : isDark
                ? 'border-old-border text-old-text-secondary hover:bg-old-hover'
                : 'border-ol-border text-ol-text-secondary hover:bg-ol-hover'
          }`}
        >
          <Filter size={12} />
          <span>Filter</span>
          {activeFilterCount > 0 && (
            <span className="ml-0.5 w-4 h-4 text-[10px] rounded-full bg-accent text-white flex items-center justify-center">
              {activeFilterCount}
            </span>
          )}
        </button>

        <FilterPill
          label="Unread"
          icon={Mail}
          active={!!searchFilters.isUnread}
          isDark={isDark}
          onClick={() => setSearchFilters({ ...searchFilters, isUnread: searchFilters.isUnread ? undefined : true })}
        />
        <FilterPill
          label="Has attachments"
          icon={Paperclip}
          active={!!searchFilters.hasAttachment}
          isDark={isDark}
          onClick={() => setSearchFilters({ ...searchFilters, hasAttachment: searchFilters.hasAttachment ? undefined : true })}
        />

        {(searchQuery || activeFilterCount > 0) && (
          <button
            onClick={() => {
              setSearchQuery('');
              setSearchFilters({});
            }}
            className={`flex items-center gap-1 px-2 py-1 rounded text-[11px] ${
              isDark ? 'text-old-text-tertiary hover:text-old-text' : 'text-ol-text-tertiary hover:text-ol-text'
            }`}
          >
            <X size={11} />
            Clear all
          </button>
        )}
      </div>

      {/* Expanded filter panel */}
      {showFilters && (
        <div className={`absolute top-full left-0 right-0 z-20 p-3 border-b shadow-lg ${
          isDark ? 'bg-old-surface border-old-border' : 'bg-ol-surface border-ol-border'
        }`}>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={`block text-[11px] font-medium mb-1 ${isDark ? 'text-old-text-secondary' : 'text-ol-text-secondary'}`}>
                <Search size={11} className="inline mr-1" />
                From
              </label>
              <input
                type="text"
                value={searchFilters.from ?? ''}
                onChange={(e) => setSearchFilters({ ...searchFilters, from: e.target.value || undefined })}
                placeholder="Sender name or email"
                className={`w-full px-2 py-1.5 text-[12px] rounded border no-transition ${
                  isDark
                    ? 'bg-old-surface-alt border-old-border text-old-text'
                    : 'bg-ol-bg border-ol-border text-ol-text'
                } outline-none focus:border-accent`}
              />
            </div>
            <div>
              <label className={`block text-[11px] font-medium mb-1 ${isDark ? 'text-old-text-secondary' : 'text-ol-text-secondary'}`}>
                <Clock size={11} className="inline mr-1" />
                Date range
              </label>
              <div className="flex gap-1.5">
                <input
                  type="date"
                  value={searchFilters.dateFrom ?? ''}
                  onChange={(e) => setSearchFilters({ ...searchFilters, dateFrom: e.target.value || undefined })}
                  className={`flex-1 px-2 py-1.5 text-[12px] rounded border no-transition ${
                    isDark
                      ? 'bg-old-surface-alt border-old-border text-old-text'
                      : 'bg-ol-bg border-ol-border text-ol-text'
                  } outline-none focus:border-accent`}
                />
                <input
                  type="date"
                  value={searchFilters.dateTo ?? ''}
                  onChange={(e) => setSearchFilters({ ...searchFilters, dateTo: e.target.value || undefined })}
                  className={`flex-1 px-2 py-1.5 text-[12px] rounded border no-transition ${
                    isDark
                      ? 'bg-old-surface-alt border-old-border text-old-text'
                      : 'bg-ol-bg border-ol-border text-ol-text'
                  } outline-none focus:border-accent`}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function FilterPill({
  label,
  icon: Icon,
  active,
  isDark,
  onClick,
}: {
  label: string;
  icon: typeof Mail;
  active: boolean;
  isDark: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1 px-2 py-1 rounded-full text-[11px] border ${
        active
          ? 'border-accent text-accent bg-accent/5 font-medium'
          : isDark
            ? 'border-old-border-subtle text-old-text-tertiary hover:text-old-text-secondary hover:bg-old-hover'
            : 'border-ol-border-subtle text-ol-text-tertiary hover:text-ol-text-secondary hover:bg-ol-hover'
      }`}
    >
      <Icon size={11} />
      {label}
    </button>
  );
}
