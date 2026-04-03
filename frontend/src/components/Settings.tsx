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
  Keyboard,
} from 'lucide-react';
import { useSettingsStore } from '../store/settingsStore';
import { useEmailStore } from '../store/emailStore';
import { AccountForm } from './AccountForm';
import type { Account, ViewMode } from '../types';

type SettingsTab = 'general' | 'accounts' | 'ai' | 'appearance' | 'security' | 'shortcuts';

export function Settings() {
  const { theme, ai, display, settingsOpen, setSettingsOpen, toggleTheme, setAI, setDisplay, setViewMode } =
    useSettingsStore();
  const { accounts } = useEmailStore();
  const isDark = theme === 'dark';

  const [activeTab, setActiveTab] = useState<SettingsTab>('accounts');
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [showAccountForm, setShowAccountForm] = useState(false);

  if (!settingsOpen) return null;

  const tabs: { id: SettingsTab; label: string; icon: typeof Mail }[] = [
    { id: 'general', label: 'General', icon: Monitor },
    { id: 'accounts', label: 'Accounts', icon: Mail },
    { id: 'ai', label: 'AI & Intelligence', icon: Brain },
    { id: 'appearance', label: 'Appearance', icon: Sun },
    { id: 'security', label: 'Security', icon: Shield },
    { id: 'shortcuts', label: 'Keyboard Shortcuts', icon: Keyboard },
  ];

  const handleSaveAccount = (_account: Account) => {
    setShowAccountForm(false);
    setEditingAccount(null);
  };

  return (
    <>
      <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40">
        <div className={`w-full max-w-2xl max-h-[80vh] rounded-lg shadow-2xl flex flex-col border ${
          isDark ? 'bg-old-surface border-old-border' : 'bg-ol-surface border-ol-border'
        }`}>
          {/* Header */}
          <div className={`flex items-center justify-between px-5 py-3 border-b ${isDark ? 'border-old-border' : 'border-ol-border'}`}>
            <h2 className={`text-[15px] font-semibold ${isDark ? 'text-old-text' : 'text-ol-text'}`}>Settings</h2>
            <button
              onClick={() => setSettingsOpen(false)}
              className={`p-1 rounded ${isDark ? 'text-old-text-tertiary hover:text-old-text hover:bg-old-hover' : 'text-ol-text-tertiary hover:text-ol-text hover:bg-ol-hover'}`}
            >
              <X size={16} />
            </button>
          </div>

          <div className="flex flex-1 min-h-0">
            {/* Tabs sidebar */}
            <div className={`w-44 border-r p-2 space-y-0.5 ${isDark ? 'border-old-border' : 'border-ol-border'}`}>
              {tabs.map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`w-full flex items-center gap-2 px-3 py-2 rounded text-[13px] ${
                      activeTab === tab.id
                        ? isDark ? 'bg-old-selected text-accent font-medium' : 'bg-ol-selected text-accent font-medium'
                        : isDark ? 'text-old-text-secondary hover:bg-old-hover' : 'text-ol-text-secondary hover:bg-ol-hover'
                    }`}
                  >
                    <Icon size={15} />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Content */}
            <div className="flex-1 p-5 overflow-y-auto">
              {/* General Tab */}
              {activeTab === 'general' && (
                <div className="space-y-4">
                  <SectionTitle isDark={isDark}>General</SectionTitle>

                  <SettingRow isDark={isDark} label="View Mode" description="Control email list density">
                    <div className="flex gap-1">
                      {(['compact', 'comfortable', 'spacious'] as ViewMode[]).map((mode) => (
                        <button
                          key={mode}
                          onClick={() => setViewMode(mode)}
                          className={`px-3 py-1.5 text-[12px] rounded border capitalize ${
                            display.viewMode === mode
                              ? 'bg-accent text-white border-accent'
                              : isDark ? 'border-old-border text-old-text-secondary hover:bg-old-hover' : 'border-ol-border text-ol-text-secondary hover:bg-ol-hover'
                          }`}
                        >
                          {mode}
                        </button>
                      ))}
                    </div>
                  </SettingRow>

                  <SettingRow isDark={isDark} label="Show Preview" description="Display email preview in list">
                    <Toggle checked={display.showPreview} isDark={isDark}
                      onChange={() => setDisplay({ showPreview: !display.showPreview })} />
                  </SettingRow>

                  <SettingRow isDark={isDark} label="Show Avatars" description="Display sender initials">
                    <Toggle checked={display.showAvatars} isDark={isDark}
                      onChange={() => setDisplay({ showAvatars: !display.showAvatars })} />
                  </SettingRow>
                </div>
              )}

              {/* Accounts Tab */}
              {activeTab === 'accounts' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <SectionTitle isDark={isDark}>Email Accounts</SectionTitle>
                    <button
                      onClick={() => { setEditingAccount(null); setShowAccountForm(true); }}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded text-[12px] text-accent border border-accent hover:bg-accent/5"
                    >
                      <Plus size={13} />
                      <span>Add Account</span>
                    </button>
                  </div>
                  <div className="space-y-2">
                    {accounts.map((account) => (
                      <div key={account.id} className={`flex items-center gap-3 p-3 rounded border ${
                        isDark ? 'bg-old-surface-alt border-old-border' : 'bg-ol-bg border-ol-border'
                      }`}>
                        <div
                          className="w-8 h-8 rounded-full flex items-center justify-center text-white text-[12px] font-semibold flex-shrink-0"
                          style={{ backgroundColor: account.color }}
                        >
                          {account.name.charAt(0)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`text-[13px] font-medium ${isDark ? 'text-old-text' : 'text-ol-text'}`}>{account.name}</p>
                          <p className={`text-[12px] ${isDark ? 'text-old-text-secondary' : 'text-ol-text-secondary'}`}>{account.email}</p>
                        </div>
                        <div className="flex items-center gap-0.5">
                          <button
                            onClick={() => { setEditingAccount(account); setShowAccountForm(true); }}
                            className={`p-1.5 rounded ${isDark ? 'text-old-text-tertiary hover:text-old-text hover:bg-old-hover' : 'text-ol-text-tertiary hover:text-ol-text hover:bg-ol-hover'}`}
                          >
                            <Pencil size={13} />
                          </button>
                          <button className={`p-1.5 rounded ${isDark ? 'text-old-text-tertiary hover:text-danger hover:bg-old-hover' : 'text-ol-text-tertiary hover:text-danger hover:bg-ol-hover'}`}>
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>
                    ))}
                    {accounts.length === 0 && (
                      <div className={`text-center py-8 ${isDark ? 'text-old-text-tertiary' : 'text-ol-text-tertiary'}`}>
                        <Mail size={28} className="mx-auto mb-2 opacity-40" />
                        <p className="text-[13px]">No accounts configured</p>
                        <p className="text-[12px] mt-1">Add an account to get started</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* AI Tab */}
              {activeTab === 'ai' && (
                <div className="space-y-4">
                  <SectionTitle isDark={isDark}>AI & Intelligence</SectionTitle>

                  <FormField label="Provider" isDark={isDark}>
                    <select
                      value={ai.provider}
                      onChange={(e) => setAI({ provider: e.target.value as typeof ai.provider })}
                      className={`w-full px-3 py-2 text-[13px] rounded border outline-none no-transition ${
                        isDark ? 'bg-old-surface-alt border-old-border text-old-text focus:border-accent' : 'bg-ol-bg border-ol-border text-ol-text focus:border-accent'
                      }`}
                    >
                      <option value="openai">OpenAI</option>
                      <option value="anthropic">Anthropic</option>
                      <option value="ollama">Ollama (Local)</option>
                      <option value="custom">Custom</option>
                    </select>
                  </FormField>

                  <FormField label="API Base URL" isDark={isDark}>
                    <input type="url" value={ai.baseUrl} onChange={(e) => setAI({ baseUrl: e.target.value })}
                      placeholder="https://api.openai.com/v1"
                      className={`w-full px-3 py-2 text-[13px] rounded border outline-none no-transition ${
                        isDark ? 'bg-old-surface-alt border-old-border text-old-text focus:border-accent' : 'bg-ol-bg border-ol-border text-ol-text focus:border-accent'
                      }`}
                    />
                  </FormField>

                  <FormField label="API Key" isDark={isDark}>
                    <input type="password" value={ai.apiKey} onChange={(e) => setAI({ apiKey: e.target.value })}
                      placeholder="sk-..."
                      className={`w-full px-3 py-2 text-[13px] rounded border outline-none no-transition ${
                        isDark ? 'bg-old-surface-alt border-old-border text-old-text focus:border-accent' : 'bg-ol-bg border-ol-border text-ol-text focus:border-accent'
                      }`}
                    />
                  </FormField>

                  <FormField label="Model" isDark={isDark}>
                    <input type="text" value={ai.model} onChange={(e) => setAI({ model: e.target.value })}
                      placeholder="gpt-4"
                      className={`w-full px-3 py-2 text-[13px] rounded border outline-none no-transition ${
                        isDark ? 'bg-old-surface-alt border-old-border text-old-text focus:border-accent' : 'bg-ol-bg border-ol-border text-ol-text focus:border-accent'
                      }`}
                    />
                  </FormField>

                  <FormField label={`Temperature: ${ai.temperature.toFixed(1)}`} isDark={isDark}>
                    <input type="range" min="0" max="2" step="0.1" value={ai.temperature}
                      onChange={(e) => setAI({ temperature: parseFloat(e.target.value) })}
                      className="w-full accent-accent no-transition"
                    />
                    <div className={`flex justify-between text-[10px] mt-1 ${isDark ? 'text-old-text-tertiary' : 'text-ol-text-tertiary'}`}>
                      <span>Precise</span>
                      <span>Balanced</span>
                      <span>Creative</span>
                    </div>
                  </FormField>
                </div>
              )}

              {/* Appearance Tab */}
              {activeTab === 'appearance' && (
                <div className="space-y-4">
                  <SectionTitle isDark={isDark}>Appearance</SectionTitle>

                  <SettingRow isDark={isDark} label="Theme"
                    description={theme === 'dark' ? 'Dark mode' : 'Light mode'}
                    icon={theme === 'dark' ? Moon : Sun}
                  >
                    <Toggle checked={theme === 'dark'} isDark={isDark} onChange={toggleTheme} />
                  </SettingRow>
                </div>
              )}

              {/* Security Tab */}
              {activeTab === 'security' && (
                <div className="space-y-4">
                  <SectionTitle isDark={isDark}>Security</SectionTitle>

                  <div className={`p-4 rounded border space-y-3 ${isDark ? 'bg-old-surface-alt border-old-border' : 'bg-ol-bg border-ol-border'}`}>
                    <div className="flex items-center gap-2">
                      <Shield size={15} className="text-accent" />
                      <p className={`text-[13px] font-medium ${isDark ? 'text-old-text' : 'text-ol-text'}`}>Master Password</p>
                    </div>
                    <p className={`text-[12px] ${isDark ? 'text-old-text-secondary' : 'text-ol-text-secondary'}`}>
                      Set a master password to encrypt your account credentials stored locally.
                    </p>
                    <div className="grid grid-cols-2 gap-3">
                      <input type="password" placeholder="New password"
                        className={`px-3 py-2 text-[13px] rounded border outline-none no-transition ${
                          isDark ? 'bg-old-surface border-old-border text-old-text focus:border-accent' : 'bg-ol-surface border-ol-border text-ol-text focus:border-accent'
                        }`}
                      />
                      <input type="password" placeholder="Confirm password"
                        className={`px-3 py-2 text-[13px] rounded border outline-none no-transition ${
                          isDark ? 'bg-old-surface border-old-border text-old-text focus:border-accent' : 'bg-ol-surface border-ol-border text-ol-text focus:border-accent'
                        }`}
                      />
                    </div>
                    <button className="px-4 py-1.5 text-[12px] rounded text-accent border border-accent hover:bg-accent/5">
                      Set Password
                    </button>
                  </div>
                </div>
              )}

              {/* Shortcuts Tab */}
              {activeTab === 'shortcuts' && (
                <div className="space-y-4">
                  <SectionTitle isDark={isDark}>Keyboard Shortcuts</SectionTitle>

                  <div className="space-y-1">
                    {[
                      { key: 'N', action: 'New email' },
                      { key: 'R', action: 'Reply' },
                      { key: 'Shift+R', action: 'Reply All' },
                      { key: 'F', action: 'Forward' },
                      { key: 'E', action: 'Archive' },
                      { key: 'Delete', action: 'Delete' },
                      { key: 'S', action: 'Star/Flag' },
                      { key: 'Ctrl+F', action: 'Search' },
                      { key: 'Ctrl+,', action: 'Settings' },
                      { key: 'Ctrl+Shift+I', action: 'AI Assistant' },
                    ].map(({ key, action }) => (
                      <div key={key} className={`flex items-center justify-between py-2 px-3 rounded ${
                        isDark ? 'hover:bg-old-hover' : 'hover:bg-ol-hover'
                      }`}>
                        <span className={`text-[13px] ${isDark ? 'text-old-text-secondary' : 'text-ol-text-secondary'}`}>{action}</span>
                        <kbd className={`px-2 py-0.5 text-[11px] rounded border ${
                          isDark ? 'bg-old-surface-alt border-old-border text-old-text' : 'bg-ol-bg border-ol-border text-ol-text'
                        }`}>{key}</kbd>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {showAccountForm && (
        <AccountForm
          account={editingAccount}
          onSave={handleSaveAccount}
          onClose={() => { setShowAccountForm(false); setEditingAccount(null); }}
        />
      )}
    </>
  );
}

function SectionTitle({ isDark, children }: { isDark: boolean; children: React.ReactNode }) {
  return (
    <h3 className={`text-[13px] font-semibold ${isDark ? 'text-old-text' : 'text-ol-text'}`}>{children}</h3>
  );
}

function FormField({ label, isDark, children }: { label: string; isDark: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className={`block text-[12px] font-medium mb-1.5 ${isDark ? 'text-old-text-secondary' : 'text-ol-text-secondary'}`}>{label}</label>
      {children}
    </div>
  );
}

function SettingRow({ isDark, label, description, icon: Icon, children }: {
  isDark: boolean;
  label: string;
  description: string;
  icon?: typeof Sun;
  children: React.ReactNode;
}) {
  return (
    <div className={`flex items-center justify-between p-3 rounded border ${
      isDark ? 'bg-old-surface-alt border-old-border' : 'bg-ol-bg border-ol-border'
    }`}>
      <div className="flex items-center gap-2.5">
        {Icon && <Icon size={15} className="text-accent" />}
        <div>
          <p className={`text-[13px] font-medium ${isDark ? 'text-old-text' : 'text-ol-text'}`}>{label}</p>
          <p className={`text-[11px] ${isDark ? 'text-old-text-secondary' : 'text-ol-text-secondary'}`}>{description}</p>
        </div>
      </div>
      {children}
    </div>
  );
}

function Toggle({ checked, isDark, onChange }: { checked: boolean; isDark: boolean; onChange: () => void }) {
  return (
    <button onClick={onChange}
      className={`w-9 h-5 rounded-full flex-shrink-0 relative ${
        checked ? 'bg-accent' : isDark ? 'bg-old-border' : 'bg-ol-border'
      }`}
    >
      <div className={`w-3.5 h-3.5 rounded-full bg-white shadow-sm absolute top-[3px] transition-all ${
        checked ? 'left-[19px]' : 'left-[3px]'
      }`} />
    </button>
  );
}
