import { useState } from 'react';
import {
  X,
  Moon,
  Sun,
  Plus,
  Pencil,
  Trash2,
  Brain,
  Monitor,
  Shield,
  Mail,
} from 'lucide-react';
import { useSettingsStore } from '../store/settingsStore';
import { useEmailStore } from '../store/emailStore';
import { AccountForm } from './AccountForm';
import type { Account } from '../types';

type SettingsTab = 'accounts' | 'ai' | 'appearance' | 'security';

export function Settings() {
  const { theme, ai, display, settingsOpen, setSettingsOpen, toggleTheme, setAI, setDisplay } =
    useSettingsStore();
  const { accounts } = useEmailStore();

  const [activeTab, setActiveTab] = useState<SettingsTab>('accounts');
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [showAccountForm, setShowAccountForm] = useState(false);

  if (!settingsOpen) return null;

  const tabs: { id: SettingsTab; label: string; icon: typeof Mail }[] = [
    { id: 'accounts', label: 'Accounts', icon: Mail },
    { id: 'ai', label: 'AI Configuration', icon: Brain },
    { id: 'appearance', label: 'Appearance', icon: Monitor },
    { id: 'security', label: 'Security', icon: Shield },
  ];

  const handleSaveAccount = (_account: Account) => {
    // In a real app, this would save to the store/backend
    setShowAccountForm(false);
    setEditingAccount(null);
  };

  return (
    <>
      <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 backdrop-blur-sm">
        <div className="w-full max-w-2xl max-h-[80vh] bg-navy-900 border border-navy-700/70 rounded-xl shadow-2xl flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-navy-700/50">
            <h2 className="text-lg font-semibold text-navy-100">Settings</h2>
            <button
              onClick={() => setSettingsOpen(false)}
              className="p-1 rounded text-navy-500 hover:text-navy-300 hover:bg-navy-800"
            >
              <X size={18} />
            </button>
          </div>

          <div className="flex flex-1 min-h-0">
            {/* Tabs sidebar */}
            <div className="w-48 border-r border-navy-700/50 p-3 space-y-1">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      activeTab === tab.id
                        ? 'bg-accent/15 text-accent'
                        : 'text-navy-400 hover:text-navy-200 hover:bg-navy-800'
                    }`}
                  >
                    <Icon size={16} />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Content */}
            <div className="flex-1 p-6 overflow-y-auto">
              {/* Accounts Tab */}
              {activeTab === 'accounts' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-navy-200">Email Accounts</h3>
                    <button
                      onClick={() => {
                        setEditingAccount(null);
                        setShowAccountForm(true);
                      }}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent/10 text-accent text-sm hover:bg-accent/20 transition-colors"
                    >
                      <Plus size={14} />
                      <span>Add Account</span>
                    </button>
                  </div>
                  <div className="space-y-2">
                    {accounts.map((account) => (
                      <div
                        key={account.id}
                        className="flex items-center gap-3 p-3 bg-navy-800/50 rounded-lg border border-navy-700/30"
                      >
                        <div
                          className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-semibold flex-shrink-0"
                          style={{ backgroundColor: account.color }}
                        >
                          {account.name.charAt(0)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-navy-200">{account.name}</p>
                          <p className="text-xs text-navy-500">{account.email}</p>
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => {
                              setEditingAccount(account);
                              setShowAccountForm(true);
                            }}
                            className="p-1.5 rounded text-navy-500 hover:text-navy-300 hover:bg-navy-700"
                          >
                            <Pencil size={14} />
                          </button>
                          <button className="p-1.5 rounded text-navy-500 hover:text-danger hover:bg-navy-700">
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    ))}
                    {accounts.length === 0 && (
                      <div className="text-center py-8 text-navy-500">
                        <Mail size={32} className="mx-auto mb-2 opacity-40" />
                        <p className="text-sm">No accounts configured</p>
                        <p className="text-xs mt-1">Add an account to get started</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* AI Configuration Tab */}
              {activeTab === 'ai' && (
                <div className="space-y-5">
                  <h3 className="text-sm font-semibold text-navy-200">AI Configuration</h3>

                  <div>
                    <label className="block text-xs font-medium text-navy-400 mb-1.5">Provider</label>
                    <select
                      value={ai.provider}
                      onChange={(e) =>
                        setAI({ provider: e.target.value as typeof ai.provider })
                      }
                      className="w-full px-3 py-2 bg-navy-800 border border-navy-700/50 rounded-lg text-sm text-navy-200 outline-none focus:border-accent/50"
                    >
                      <option value="openai">OpenAI</option>
                      <option value="anthropic">Anthropic</option>
                      <option value="ollama">Ollama (Local)</option>
                      <option value="custom">Custom</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-navy-400 mb-1.5">API Base URL</label>
                    <input
                      type="url"
                      value={ai.baseUrl}
                      onChange={(e) => setAI({ baseUrl: e.target.value })}
                      placeholder="https://api.openai.com/v1"
                      className="w-full px-3 py-2 bg-navy-800 border border-navy-700/50 rounded-lg text-sm text-navy-200 outline-none focus:border-accent/50"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-navy-400 mb-1.5">API Key</label>
                    <input
                      type="password"
                      value={ai.apiKey}
                      onChange={(e) => setAI({ apiKey: e.target.value })}
                      placeholder="sk-..."
                      className="w-full px-3 py-2 bg-navy-800 border border-navy-700/50 rounded-lg text-sm text-navy-200 outline-none focus:border-accent/50"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-navy-400 mb-1.5">Model</label>
                    <input
                      type="text"
                      value={ai.model}
                      onChange={(e) => setAI({ model: e.target.value })}
                      placeholder="gpt-4"
                      className="w-full px-3 py-2 bg-navy-800 border border-navy-700/50 rounded-lg text-sm text-navy-200 outline-none focus:border-accent/50"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-navy-400 mb-1.5">
                      Temperature: {ai.temperature.toFixed(1)}
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="2"
                      step="0.1"
                      value={ai.temperature}
                      onChange={(e) => setAI({ temperature: parseFloat(e.target.value) })}
                      className="w-full accent-accent"
                    />
                    <div className="flex justify-between text-[10px] text-navy-600 mt-1">
                      <span>Precise</span>
                      <span>Balanced</span>
                      <span>Creative</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Appearance Tab */}
              {activeTab === 'appearance' && (
                <div className="space-y-5">
                  <h3 className="text-sm font-semibold text-navy-200">Appearance</h3>

                  {/* Theme */}
                  <div className="flex items-center justify-between p-3 bg-navy-800/50 rounded-lg border border-navy-700/30">
                    <div className="flex items-center gap-3">
                      {theme === 'dark' ? (
                        <Moon size={18} className="text-accent" />
                      ) : (
                        <Sun size={18} className="text-warning" />
                      )}
                      <div>
                        <p className="text-sm font-medium text-navy-200">Theme</p>
                        <p className="text-xs text-navy-500">
                          {theme === 'dark' ? 'Dark mode' : 'Light mode'}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={toggleTheme}
                      className={`w-10 h-5 rounded-full transition-colors ${
                        theme === 'dark' ? 'bg-accent' : 'bg-navy-600'
                      }`}
                    >
                      <div
                        className={`w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${
                          theme === 'dark' ? 'translate-x-5.5' : 'translate-x-0.5'
                        }`}
                      />
                    </button>
                  </div>

                  {/* Compact mode */}
                  <div className="flex items-center justify-between p-3 bg-navy-800/50 rounded-lg border border-navy-700/30">
                    <div>
                      <p className="text-sm font-medium text-navy-200">Compact Mode</p>
                      <p className="text-xs text-navy-500">Show more emails in the list</p>
                    </div>
                    <button
                      onClick={() => setDisplay({ compactMode: !display.compactMode })}
                      className={`w-10 h-5 rounded-full transition-colors ${
                        display.compactMode ? 'bg-accent' : 'bg-navy-700'
                      }`}
                    >
                      <div
                        className={`w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${
                          display.compactMode ? 'translate-x-5.5' : 'translate-x-0.5'
                        }`}
                      />
                    </button>
                  </div>

                  {/* Show preview */}
                  <div className="flex items-center justify-between p-3 bg-navy-800/50 rounded-lg border border-navy-700/30">
                    <div>
                      <p className="text-sm font-medium text-navy-200">Show Preview</p>
                      <p className="text-xs text-navy-500">Show email preview text in list</p>
                    </div>
                    <button
                      onClick={() => setDisplay({ showPreview: !display.showPreview })}
                      className={`w-10 h-5 rounded-full transition-colors ${
                        display.showPreview ? 'bg-accent' : 'bg-navy-700'
                      }`}
                    >
                      <div
                        className={`w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${
                          display.showPreview ? 'translate-x-5.5' : 'translate-x-0.5'
                        }`}
                      />
                    </button>
                  </div>

                  {/* Show avatars */}
                  <div className="flex items-center justify-between p-3 bg-navy-800/50 rounded-lg border border-navy-700/30">
                    <div>
                      <p className="text-sm font-medium text-navy-200">Show Avatars</p>
                      <p className="text-xs text-navy-500">Display sender initials in list</p>
                    </div>
                    <button
                      onClick={() => setDisplay({ showAvatars: !display.showAvatars })}
                      className={`w-10 h-5 rounded-full transition-colors ${
                        display.showAvatars ? 'bg-accent' : 'bg-navy-700'
                      }`}
                    >
                      <div
                        className={`w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${
                          display.showAvatars ? 'translate-x-5.5' : 'translate-x-0.5'
                        }`}
                      />
                    </button>
                  </div>
                </div>
              )}

              {/* Security Tab */}
              {activeTab === 'security' && (
                <div className="space-y-5">
                  <h3 className="text-sm font-semibold text-navy-200">Security</h3>

                  <div className="p-4 bg-navy-800/50 rounded-lg border border-navy-700/30 space-y-3">
                    <div className="flex items-center gap-2">
                      <Shield size={18} className="text-accent" />
                      <p className="text-sm font-medium text-navy-200">Master Password</p>
                    </div>
                    <p className="text-xs text-navy-500">
                      Set a master password to encrypt your account credentials stored locally.
                    </p>
                    <div className="grid grid-cols-2 gap-3">
                      <input
                        type="password"
                        placeholder="New password"
                        className="px-3 py-2 bg-navy-800 border border-navy-700/50 rounded-lg text-sm text-navy-200 outline-none focus:border-accent/50"
                      />
                      <input
                        type="password"
                        placeholder="Confirm password"
                        className="px-3 py-2 bg-navy-800 border border-navy-700/50 rounded-lg text-sm text-navy-200 outline-none focus:border-accent/50"
                      />
                    </div>
                    <button className="px-4 py-2 bg-accent/10 text-accent text-sm rounded-lg hover:bg-accent/20 transition-colors">
                      Set Password
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Account Form overlay */}
      {showAccountForm && (
        <AccountForm
          account={editingAccount}
          onSave={handleSaveAccount}
          onClose={() => {
            setShowAccountForm(false);
            setEditingAccount(null);
          }}
        />
      )}
    </>
  );
}
