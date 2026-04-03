import {
  Reply,
  ReplyAll,
  Forward,
  Trash2,
  Archive,
  FolderInput,
  Flag,
  Search,
  X,
  Sun,
  Moon,
  LayoutList,
  LayoutGrid,
  AlignJustify,
  Mail,
  Clock,
} from 'lucide-react';
import { useEmailStore } from '../store/emailStore';
import { useSettingsStore } from '../store/settingsStore';

export function CommandBar() {
  const {
    selectedEmailId,
    searchQuery,
    openCompose,
    deleteEmail,
    moveEmail,
    flagEmail,
    folders,
    setSearchQuery,
  } = useEmailStore();

  const { theme, toggleTheme, display, setViewMode } = useSettingsStore();
  const isDark = theme === 'dark';

  const archiveFolder = folders.find((f) => f.type === 'archive');
  const hasSelection = !!selectedEmailId;

  return (
    <div
      className={`flex items-center gap-1 h-11 px-3 border-b select-none ${
        isDark
          ? 'bg-old-surface border-old-border'
          : 'bg-ol-surface border-ol-border'
      }`}
    >
      {/* New Email - Prominent */}
      <button
        onClick={() => openCompose()}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded text-white text-[13px] font-semibold bg-accent hover:bg-accent-hover"
      >
        <Mail size={15} />
        <span>New Email</span>
      </button>

      <Separator isDark={isDark} />

      {/* Reply group */}
      <ToolbarButton icon={Reply} label="Reply" disabled={!hasSelection} isDark={isDark}
        onClick={() => selectedEmailId && openCompose('reply', selectedEmailId)} />
      <ToolbarButton icon={ReplyAll} label="Reply All" disabled={!hasSelection} isDark={isDark}
        onClick={() => selectedEmailId && openCompose('replyAll', selectedEmailId)} />
      <ToolbarButton icon={Forward} label="Forward" disabled={!hasSelection} isDark={isDark}
        onClick={() => selectedEmailId && openCompose('forward', selectedEmailId)} />

      <Separator isDark={isDark} />

      {/* Delete / Archive / Junk */}
      <ToolbarButton icon={Trash2} label="Delete" disabled={!hasSelection} isDark={isDark} danger
        onClick={() => selectedEmailId && deleteEmail(selectedEmailId)} />
      {archiveFolder && (
        <ToolbarButton icon={Archive} label="Archive" disabled={!hasSelection} isDark={isDark}
          onClick={() => selectedEmailId && moveEmail(selectedEmailId, archiveFolder.id)} />
      )}

      <Separator isDark={isDark} />

      {/* Move / Flag / Snooze */}
      <ToolbarButton icon={FolderInput} label="Move" disabled={!hasSelection} isDark={isDark} onClick={() => {}} />
      <ToolbarButton icon={Flag} label="Flag" disabled={!hasSelection} isDark={isDark}
        onClick={() => selectedEmailId && flagEmail(selectedEmailId)} />
      <ToolbarButton icon={Clock} label="Snooze" disabled={!hasSelection} isDark={isDark} onClick={() => {}} />

      {/* Spacer */}
      <div className="flex-1" />

      {/* Search */}
      <div className="relative w-64">
        <Search size={14} className={`absolute left-2.5 top-1/2 -translate-y-1/2 ${isDark ? 'text-old-text-tertiary' : 'text-ol-text-tertiary'}`} />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search mail"
          className={`w-full pl-8 pr-7 py-1.5 text-[13px] rounded border no-transition ${
            isDark
              ? 'bg-old-surface-alt border-old-border text-old-text placeholder:text-old-text-tertiary focus:border-accent'
              : 'bg-ol-bg border-ol-border text-ol-text placeholder:text-ol-text-tertiary focus:border-accent'
          } outline-none`}
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            className={`absolute right-2 top-1/2 -translate-y-1/2 ${isDark ? 'text-old-text-tertiary hover:text-old-text' : 'text-ol-text-tertiary hover:text-ol-text'}`}
          >
            <X size={13} />
          </button>
        )}
      </div>

      <Separator isDark={isDark} />

      {/* View mode */}
      <ToolbarButton
        icon={LayoutList}
        label="Compact"
        isDark={isDark}
        active={display.viewMode === 'compact'}
        onClick={() => setViewMode('compact')}
      />
      <ToolbarButton
        icon={LayoutGrid}
        label="Comfortable"
        isDark={isDark}
        active={display.viewMode === 'comfortable'}
        onClick={() => setViewMode('comfortable')}
      />
      <ToolbarButton
        icon={AlignJustify}
        label="Spacious"
        isDark={isDark}
        active={display.viewMode === 'spacious'}
        onClick={() => setViewMode('spacious')}
      />

      <Separator isDark={isDark} />

      {/* Theme toggle */}
      <ToolbarButton
        icon={isDark ? Sun : Moon}
        label={isDark ? 'Light mode' : 'Dark mode'}
        isDark={isDark}
        onClick={toggleTheme}
      />
    </div>
  );
}

function Separator({ isDark }: { isDark: boolean }) {
  return <div className={`w-px h-5 mx-0.5 ${isDark ? 'bg-old-border' : 'bg-ol-border'}`} />;
}

function ToolbarButton({
  icon: Icon,
  label,
  disabled,
  isDark,
  active,
  danger,
  onClick,
}: {
  icon: typeof Reply;
  label: string;
  disabled?: boolean;
  isDark: boolean;
  active?: boolean;
  danger?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={label}
      className={`flex items-center gap-1 px-2 py-1.5 rounded text-[12px] ${
        disabled ? 'opacity-35 cursor-default' : ''
      } ${
        active
          ? isDark ? 'bg-old-selected text-accent' : 'bg-ol-selected text-accent'
          : ''
      } ${
        !disabled && !active
          ? isDark
            ? `text-old-text-secondary hover:bg-old-hover ${danger ? 'hover:text-danger' : 'hover:text-old-text'}`
            : `text-ol-text-secondary hover:bg-ol-hover ${danger ? 'hover:text-danger' : 'hover:text-ol-text'}`
          : ''
      }`}
    >
      <Icon size={15} />
      <span className="hidden xl:inline">{label}</span>
    </button>
  );
}
