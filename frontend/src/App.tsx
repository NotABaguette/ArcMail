import { useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { CommandBar } from './components/CommandBar';
import { EmailList } from './components/EmailList';
import { EmailView } from './components/EmailView';
import { ComposeModal } from './components/ComposeModal';
import { AIPanel } from './components/AIPanel';
import { Settings } from './components/Settings';
import { StatusBar } from './components/StatusBar';
import { useSettingsStore } from './store/settingsStore';
import { useEmailStore } from './store/emailStore';

function App() {
  const { theme } = useSettingsStore();
  const { loadContacts } = useEmailStore();

  // Apply theme class to document
  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    document.documentElement.style.colorScheme = theme === 'dark' ? 'dark' : 'light';
  }, [theme]);

  // Load contacts on mount
  useEffect(() => {
    loadContacts();
  }, [loadContacts]);

  const isDark = theme === 'dark';

  return (
    <div
      className={`h-screen flex flex-col ${
        isDark ? 'bg-old-bg text-old-text' : 'bg-ol-bg text-ol-text'
      }`}
    >
      {/* Top Command Bar */}
      <CommandBar />

      {/* Main content area */}
      <div className="flex-1 flex min-h-0">
        {/* Left Sidebar - Folder navigation */}
        <Sidebar />

        {/* Email List - Middle column */}
        <EmailList />

        {/* Email View - Reading pane */}
        <EmailView />

        {/* AI Panel - Conditional right panel */}
        <AIPanel />
      </div>

      {/* Bottom Status Bar */}
      <StatusBar />

      {/* Floating overlays */}
      <ComposeModal />
      <Settings />
    </div>
  );
}

export default App;
