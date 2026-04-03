import { RefreshCw } from 'lucide-react';
import { useEmailStore } from '../store/emailStore';
import { useSettingsStore } from '../store/settingsStore';
import { format } from 'date-fns';

export function StatusBar() {
  const { connectionStatus, lastSyncTime, refreshEmails, getUnreadCount, getTotalCount } = useEmailStore();
  const { theme } = useSettingsStore();
  const isDark = theme === 'dark';

  const total = getTotalCount();
  const unread = getUnreadCount();

  const statusIcon = connectionStatus === 'syncing' ? (
    <RefreshCw size={12} className="animate-spin" />
  ) : connectionStatus === 'connected' ? (
    <span className="inline-block w-2 h-2 rounded-full bg-green-500" />
  ) : (
    <span className="inline-block w-2 h-2 rounded-full bg-red-500" />
  );

  const statusText = connectionStatus === 'syncing' ? 'Syncing...'
    : connectionStatus === 'connected' ? 'Connected'
    : 'Offline';

  return (
    <div
      className={`flex items-center justify-between h-6 px-3 text-[11px] select-none border-t ${
        isDark
          ? 'bg-old-surface border-old-border text-old-text-secondary'
          : 'bg-ol-surface border-ol-border text-ol-text-secondary'
      }`}
    >
      {/* Left: Connection status */}
      <div className="flex items-center gap-1.5">
        {statusIcon}
        <span>{statusText}</span>
      </div>

      {/* Center: Item count */}
      <div>
        {total} item{total !== 1 ? 's' : ''}{unread > 0 && `, ${unread} unread`}
      </div>

      {/* Right: Last sync + refresh */}
      <div className="flex items-center gap-2">
        {lastSyncTime && (
          <span>Last sync: {format(lastSyncTime, 'h:mm a')}</span>
        )}
        <button
          onClick={refreshEmails}
          className={`p-0.5 rounded ${isDark ? 'hover:bg-old-hover' : 'hover:bg-ol-hover'}`}
          title="Sync now"
        >
          <RefreshCw size={11} />
        </button>
      </div>
    </div>
  );
}
