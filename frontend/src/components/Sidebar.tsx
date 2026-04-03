import { useEffect } from 'react';
import {
  Inbox,
  Send,
  FileEdit,
  Archive,
  ShieldAlert,
  Trash2,
  Plus,
  Settings,
  ChevronDown,
  Folder,
  PanelLeftClose,
  PanelLeft,
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
    openCompose,
    toggleSidebar,
  } = useEmailStore();

  const { setSettingsOpen } = useSettingsStore();

  useEffect(() => {
    loadAccounts().then(() => {
      loadFolders();
    });
  }, [loadAccounts, loadFolders]);

  const activeAccount = accounts.find((a) => a.id === activeAccountId);

  if (sidebarCollapsed) {
    return (
      <div className="flex flex-col items-center w-16 bg-navy-900 dark:bg-navy-900 border-r border-navy-700/50 py-4 gap-3">
        <button
          onClick={toggleSidebar}
          className="p-2 rounded-lg text-navy-400 hover:text-white hover:bg-navy-800"
        >
          <PanelLeft size={20} />
        </button>
        <button
          onClick={() => openCompose()}
          className="p-2.5 rounded-xl bg-accent hover:bg-accent-hover text-white"
        >
          <Plus size={20} />
        </button>
        <div className="flex-1 flex flex-col gap-1 mt-2">
          {folders.map((folder) => {
            const Icon = FOLDER_ICONS[folder.icon] ?? Folder;
            const isActive = folder.id === activeFolderId;
            return (
              <button
                key={folder.id}
                onClick={() => setActiveFolder(folder.id)}
                className={`relative p-2.5 rounded-lg ${
                  isActive
                    ? 'bg-accent/15 text-accent'
                    : 'text-navy-400 hover:text-navy-200 hover:bg-navy-800'
                }`}
                title={folder.name}
              >
                <Icon size={20} />
                {folder.unreadCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-accent text-[10px] font-bold text-white rounded-full flex items-center justify-center">
                    {folder.unreadCount > 9 ? '9+' : folder.unreadCount}
                  </span>
                )}
              </button>
            );
          })}
        </div>
        <button
          onClick={() => setSettingsOpen(true)}
          className="p-2 rounded-lg text-navy-500 hover:text-navy-300 hover:bg-navy-800"
          title="Settings"
        >
          <Settings size={20} />
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col w-64 min-w-[256px] bg-navy-900 dark:bg-navy-900 border-r border-navy-700/50">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-navy-700/50">
        <h1 className="text-lg font-semibold text-white tracking-tight">Mail</h1>
        <button
          onClick={toggleSidebar}
          className="p-1.5 rounded-lg text-navy-400 hover:text-white hover:bg-navy-800"
        >
          <PanelLeftClose size={18} />
        </button>
      </div>

      {/* Account Switcher */}
      <div className="px-3 py-2">
        <button className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-navy-800 group">
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-semibold"
            style={{ backgroundColor: activeAccount?.color ?? '#3b82f6' }}
          >
            {activeAccount?.name?.charAt(0) ?? 'M'}
          </div>
          <div className="flex-1 text-left min-w-0">
            <div className="text-sm font-medium text-navy-100 truncate">
              {activeAccount?.name ?? 'Select Account'}
            </div>
            <div className="text-xs text-navy-500 truncate">
              {activeAccount?.email ?? ''}
            </div>
          </div>
          <ChevronDown size={16} className="text-navy-500 group-hover:text-navy-300" />
        </button>

        {/* Account list dropdown - simplified inline */}
        {accounts.length > 1 && (
          <div className="mt-1 space-y-0.5">
            {accounts
              .filter((a) => a.id !== activeAccountId)
              .map((account) => (
                <button
                  key={account.id}
                  onClick={() => setActiveAccount(account.id)}
                  className="w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-navy-400 hover:text-navy-200 hover:bg-navy-800"
                >
                  <div
                    className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-semibold"
                    style={{ backgroundColor: account.color }}
                  >
                    {account.name.charAt(0)}
                  </div>
                  <span className="text-sm truncate">{account.name}</span>
                </button>
              ))}
          </div>
        )}
      </div>

      {/* Compose Button */}
      <div className="px-3 py-2">
        <button
          onClick={() => openCompose()}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-accent hover:bg-accent-hover text-white font-medium rounded-xl transition-colors shadow-lg shadow-accent/20"
        >
          <Plus size={18} />
          <span>Compose</span>
        </button>
      </div>

      {/* Folders */}
      <nav className="flex-1 px-3 py-1 overflow-y-auto">
        <div className="space-y-0.5">
          {folders.map((folder) => {
            const Icon = FOLDER_ICONS[folder.icon] ?? Folder;
            const isActive = folder.id === activeFolderId;
            return (
              <button
                key={folder.id}
                onClick={() => setActiveFolder(folder.id)}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-accent/15 text-accent'
                    : 'text-navy-400 hover:text-navy-200 hover:bg-navy-800'
                }`}
              >
                <Icon size={18} />
                <span className="flex-1 text-left">{folder.name}</span>
                {folder.unreadCount > 0 && (
                  <span
                    className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                      isActive
                        ? 'bg-accent/20 text-accent'
                        : 'bg-navy-800 text-navy-400'
                    }`}
                  >
                    {folder.unreadCount}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </nav>

      {/* Settings */}
      <div className="px-3 py-3 border-t border-navy-700/50">
        <button
          onClick={() => setSettingsOpen(true)}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-navy-500 hover:text-navy-300 hover:bg-navy-800 transition-colors"
        >
          <Settings size={18} />
          <span>Settings</span>
        </button>
      </div>
    </div>
  );
}
