import { useEffect, useState } from 'react';
import {
  Inbox,
  Send,
  FileEdit,
  Archive,
  ShieldAlert,
  Trash2,
  ChevronDown,
  ChevronRight,
  Folder,
  Star,
  Settings,
} from 'lucide-react';
import { useEmailStore } from '../store/emailStore';
import { useSettingsStore } from '../store/settingsStore';

const FOLDER_ICONS: Record<string, typeof Inbox> = {
  inbox: Inbox,
  send: Send,
  'file-edit': FileEdit,
  archive: Archive,
  'shield-alert': ShieldAlert,
  'trash-2': Trash2,
};

export function Sidebar() {
  const {
    accounts,
    activeAccountId,
    folders,
    activeFolderId,
    sidebarCollapsed,
    loadAccounts,
    loadFolders,
    setActiveAccount,
    setActiveFolder,
  } = useEmailStore();

  const { theme, setSettingsOpen } = useSettingsStore();
  const isDark = theme === 'dark';

  const [expandedAccounts, setExpandedAccounts] = useState<Record<string, boolean>>({});
  const [favoritesExpanded, setFavoritesExpanded] = useState(true);

  useEffect(() => {
    loadAccounts().then(() => {
      loadFolders();
    });
  }, [loadAccounts, loadFolders]);

  // Auto-expand active account
  useEffect(() => {
    if (activeAccountId) {
      setExpandedAccounts(prev => ({ ...prev, [activeAccountId]: true }));
    }
  }, [activeAccountId]);

  const toggleAccountExpand = (id: string) => {
    setExpandedAccounts(prev => ({ ...prev, [id]: !prev[id] }));
  };

  // Favorite folders: inbox, sent, drafts
  const favoriteFolders = folders.filter(f => ['inbox', 'sent', 'drafts'].includes(f.type));

  if (sidebarCollapsed) {
    return null;
  }

  return (
    <div
      className={`flex flex-col w-56 min-w-[224px] border-r select-none ${
        isDark
          ? 'bg-old-surface border-old-border'
          : 'bg-ol-bg border-ol-border'
      }`}
    >
      {/* Favorites Section */}
      <div className="pt-2">
        <button
          onClick={() => setFavoritesExpanded(!favoritesExpanded)}
          className={`w-full flex items-center gap-1 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider ${
            isDark ? 'text-old-text-secondary hover:text-old-text' : 'text-ol-text-secondary hover:text-ol-text'
          }`}
        >
          {favoritesExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          Favorites
        </button>
        {favoritesExpanded && (
          <div className="mt-0.5">
            {favoriteFolders.map((folder) => (
              <FolderItem
                key={`fav-${folder.id}`}
                folder={folder}
                isActive={folder.id === activeFolderId}
                isDark={isDark}
                onClick={() => setActiveFolder(folder.id)}
                isFavorite
              />
            ))}
          </div>
        )}
      </div>

      {/* Account Sections */}
      <div className="flex-1 overflow-y-auto mt-2">
        {accounts.map((account) => {
          const isExpanded = expandedAccounts[account.id] ?? false;
          const accountFolders = folders.filter(f => f.accountId === account.id);
          const isActive = account.id === activeAccountId;

          return (
            <div key={account.id} className="mb-1">
              {/* Account header */}
              <button
                onClick={() => {
                  toggleAccountExpand(account.id);
                  if (!isActive) setActiveAccount(account.id);
                }}
                className={`w-full flex items-center gap-2 px-3 py-1.5 text-[12px] font-semibold ${
                  isDark
                    ? 'text-old-text hover:bg-old-hover'
                    : 'text-ol-text hover:bg-ol-hover'
                }`}
              >
                {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                <span
                  className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{ backgroundColor: account.color }}
                />
                <span className="truncate">{account.name}</span>
              </button>

              {/* Account folders */}
              {isExpanded && (
                <div>
                  {accountFolders.map((folder) => (
                    <FolderItem
                      key={folder.id}
                      folder={folder}
                      isActive={folder.id === activeFolderId}
                      isDark={isDark}
                      onClick={() => setActiveFolder(folder.id)}
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Settings at bottom */}
      <div className={`border-t py-1 ${isDark ? 'border-old-border' : 'border-ol-border'}`}>
        <button
          onClick={() => setSettingsOpen(true)}
          className={`w-full flex items-center gap-2 px-4 py-1.5 text-[12px] ${
            isDark
              ? 'text-old-text-secondary hover:text-old-text hover:bg-old-hover'
              : 'text-ol-text-secondary hover:text-ol-text hover:bg-ol-hover'
          }`}
        >
          <Settings size={14} />
          <span>Settings</span>
        </button>
      </div>
    </div>
  );
}

function FolderItem({
  folder,
  isActive,
  isDark,
  onClick,
  isFavorite,
}: {
  folder: { id: string; name: string; icon: string; unreadCount: number; type: string };
  isActive: boolean;
  isDark: boolean;
  onClick: () => void;
  isFavorite?: boolean;
}) {
  const Icon = isFavorite && folder.type === 'inbox' ? Star : (FOLDER_ICONS[folder.icon] ?? Folder);

  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-2 px-4 py-[5px] text-[13px] ${
        isFavorite ? 'pl-6' : 'pl-8'
      } ${
        isActive
          ? isDark
            ? 'bg-old-selected text-accent font-medium border-l-2 border-accent'
            : 'bg-ol-selected text-accent font-medium border-l-2 border-accent'
          : isDark
            ? 'text-old-text-secondary hover:bg-old-hover'
            : 'text-ol-text-secondary hover:bg-ol-hover'
      }`}
    >
      <Icon size={15} className={isActive ? 'text-accent' : ''} />
      <span className="flex-1 text-left truncate">{folder.name}</span>
      {folder.unreadCount > 0 && (
        <span className={`text-[11px] font-semibold ${
          isActive ? 'text-accent' : isDark ? 'text-old-text-secondary' : 'text-ol-text-secondary'
        }`}>
          {folder.unreadCount}
        </span>
      )}
    </button>
  );
}
