import { useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { EmailList } from './components/EmailList';
import { EmailView } from './components/EmailView';
import { ComposeModal } from './components/ComposeModal';
import { AIPanel } from './components/AIPanel';
import { Settings } from './components/Settings';
import { useSettingsStore } from './store/settingsStore';
import { useEmailStore } from './store/emailStore';

function App() {
  const { theme } = useSettingsStore();
  const { loadContacts } = useEmailStore();

  // Apply theme class to document
  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    if (theme === 'dark') {
      document.documentElement.style.colorScheme = 'dark';
    } else {
      document.documentElement.style.colorScheme = 'light';
    }
  }, [theme]);

  // Load contacts on mount
  useEffect(() => {
    loadContacts();
  }, [loadContacts]);

  return (
    <div
      className={`h-screen flex ${
        theme === 'dark'
          ? 'bg-navy-900 text-navy-300'
          : 'bg-white text-gray-700'
      }`}
    >
      {/* Sidebar - Folder navigation */}
      <Sidebar />

      {/* Email List - Middle column */}
      <EmailList />

      {/* Email View - Reading pane */}
      <EmailView />

      {/* AI Panel - Conditional right panel */}
      <AIPanel />

      {/* Compose Modal - Floating */}
      <ComposeModal />

      {/* Settings Modal */}
      <Settings />
    </div>
  );
}

export default App;
