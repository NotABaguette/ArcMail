import { useState, useEffect } from 'react';
import {
  X,
  Server,
  Lock,
  Mail,
  User,
  CheckCircle2,
  XCircle,
  Loader2,
} from 'lucide-react';
import type { Account } from '../types';
import { api } from '../lib/tauri';

interface AccountFormProps {
  account?: Account | null;
  onSave: (account: Account) => void;
  onClose: () => void;
}

const PRESETS: Record<string, Partial<Account>> = {
  gmail: {
    imapHost: 'imap.gmail.com',
    imapPort: 993,
    smtpHost: 'smtp.gmail.com',
    smtpPort: 587,
    useTls: true,
    protocol: 'imap',
  },
  outlook: {
    imapHost: 'outlook.office365.com',
    imapPort: 993,
    smtpHost: 'smtp.office365.com',
    smtpPort: 587,
    useTls: true,
    protocol: 'imap',
  },
  yahoo: {
    imapHost: 'imap.mail.yahoo.com',
    imapPort: 993,
    smtpHost: 'smtp.mail.yahoo.com',
    smtpPort: 587,
    useTls: true,
    protocol: 'imap',
  },
};

const COLORS = ['#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#06b6d4', '#ef4444', '#6366f1'];

export function AccountForm({ account, onSave, onClose }: AccountFormProps) {
  const [form, setForm] = useState<Account>({
    id: account?.id ?? `acc-${Date.now()}`,
    name: account?.name ?? '',
    email: account?.email ?? '',
    protocol: account?.protocol ?? 'imap',
    imapHost: account?.imapHost ?? '',
    imapPort: account?.imapPort ?? 993,
    smtpHost: account?.smtpHost ?? '',
    smtpPort: account?.smtpPort ?? 587,
    username: account?.username ?? '',
    password: account?.password ?? '',
    useTls: account?.useTls ?? true,
    color: account?.color ?? COLORS[0],
  });

  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [testMessage, setTestMessage] = useState('');

  // Auto-detect provider
  useEffect(() => {
    const email = form.email.toLowerCase();
    if (email.includes('@gmail.com') && !account) {
      setForm((f) => ({ ...f, ...PRESETS.gmail, username: form.email }));
    } else if ((email.includes('@outlook.com') || email.includes('@hotmail.com')) && !account) {
      setForm((f) => ({ ...f, ...PRESETS.outlook, username: form.email }));
    } else if (email.includes('@yahoo.com') && !account) {
      setForm((f) => ({ ...f, ...PRESETS.yahoo, username: form.email }));
    }
  }, [form.email, account]);

  const update = (fields: Partial<Account>) => setForm((f) => ({ ...f, ...fields }));

  const handleTest = async () => {
    setTestStatus('testing');
    try {
      const result = await api.testConnection(form);
      setTestStatus(result.success ? 'success' : 'error');
      setTestMessage(result.message);
    } catch {
      setTestStatus('error');
      setTestMessage('Connection failed');
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(form);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-lg bg-navy-900 border border-navy-700/70 rounded-xl shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-navy-700/50">
          <h2 className="text-lg font-semibold text-navy-100">
            {account ? 'Edit Account' : 'Add Account'}
          </h2>
          <button
            onClick={onClose}
            className="p-1 rounded text-navy-500 hover:text-navy-300 hover:bg-navy-800"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
          {/* Name & Color */}
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-xs font-medium text-navy-400 mb-1">Account Name</label>
              <div className="relative">
                <User size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-navy-500" />
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => update({ name: e.target.value })}
                  placeholder="Personal"
                  className="w-full pl-9 pr-3 py-2 bg-navy-800 border border-navy-700/50 rounded-lg text-sm text-navy-200 outline-none focus:border-accent/50"
                  required
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-navy-400 mb-1">Color</label>
              <div className="flex gap-1 py-2">
                {COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => update({ color: c })}
                    className={`w-6 h-6 rounded-full border-2 ${
                      form.color === c ? 'border-white' : 'border-transparent'
                    }`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Email */}
          <div>
            <label className="block text-xs font-medium text-navy-400 mb-1">Email Address</label>
            <div className="relative">
              <Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-navy-500" />
              <input
                type="email"
                value={form.email}
                onChange={(e) => update({ email: e.target.value })}
                placeholder="you@example.com"
                className="w-full pl-9 pr-3 py-2 bg-navy-800 border border-navy-700/50 rounded-lg text-sm text-navy-200 outline-none focus:border-accent/50"
                required
              />
            </div>
          </div>

          {/* Quick presets */}
          <div className="flex gap-2">
            <span className="text-xs text-navy-500 py-1">Quick setup:</span>
            {Object.keys(PRESETS).map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => setForm((f) => ({ ...f, ...PRESETS[key] }))}
                className="text-xs px-2 py-1 rounded bg-navy-800 text-navy-400 hover:text-navy-200 hover:bg-navy-700 border border-navy-700/50 capitalize"
              >
                {key}
              </button>
            ))}
          </div>

          {/* Protocol */}
          <div>
            <label className="block text-xs font-medium text-navy-400 mb-1">Protocol</label>
            <div className="flex gap-2">
              {(['imap', 'pop3'] as const).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => update({ protocol: p })}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${
                    form.protocol === p
                      ? 'bg-accent/10 border-accent/30 text-accent'
                      : 'bg-navy-800 border-navy-700/50 text-navy-400 hover:text-navy-200'
                  }`}
                >
                  {p.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          {/* Server Config */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-navy-400 mb-1">
                {form.protocol === 'imap' ? 'IMAP' : 'POP3'} Host
              </label>
              <div className="relative">
                <Server size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-navy-500" />
                <input
                  type="text"
                  value={form.imapHost}
                  onChange={(e) => update({ imapHost: e.target.value })}
                  placeholder="imap.example.com"
                  className="w-full pl-9 pr-3 py-2 bg-navy-800 border border-navy-700/50 rounded-lg text-sm text-navy-200 outline-none focus:border-accent/50"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-navy-400 mb-1">Port</label>
              <input
                type="number"
                value={form.imapPort}
                onChange={(e) => update({ imapPort: parseInt(e.target.value) || 993 })}
                className="w-full px-3 py-2 bg-navy-800 border border-navy-700/50 rounded-lg text-sm text-navy-200 outline-none focus:border-accent/50"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-navy-400 mb-1">SMTP Host</label>
              <div className="relative">
                <Server size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-navy-500" />
                <input
                  type="text"
                  value={form.smtpHost}
                  onChange={(e) => update({ smtpHost: e.target.value })}
                  placeholder="smtp.example.com"
                  className="w-full pl-9 pr-3 py-2 bg-navy-800 border border-navy-700/50 rounded-lg text-sm text-navy-200 outline-none focus:border-accent/50"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-navy-400 mb-1">Port</label>
              <input
                type="number"
                value={form.smtpPort}
                onChange={(e) => update({ smtpPort: parseInt(e.target.value) || 587 })}
                className="w-full px-3 py-2 bg-navy-800 border border-navy-700/50 rounded-lg text-sm text-navy-200 outline-none focus:border-accent/50"
              />
            </div>
          </div>

          {/* Credentials */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-navy-400 mb-1">Username</label>
              <input
                type="text"
                value={form.username}
                onChange={(e) => update({ username: e.target.value })}
                placeholder="username"
                className="w-full px-3 py-2 bg-navy-800 border border-navy-700/50 rounded-lg text-sm text-navy-200 outline-none focus:border-accent/50"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-navy-400 mb-1">Password</label>
              <div className="relative">
                <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-navy-500" />
                <input
                  type="password"
                  value={form.password}
                  onChange={(e) => update({ password: e.target.value })}
                  placeholder="********"
                  className="w-full pl-9 pr-3 py-2 bg-navy-800 border border-navy-700/50 rounded-lg text-sm text-navy-200 outline-none focus:border-accent/50"
                />
              </div>
            </div>
          </div>

          {/* TLS Toggle */}
          <div className="flex items-center justify-between py-2">
            <div className="flex items-center gap-2">
              <Lock size={15} className="text-navy-400" />
              <span className="text-sm text-navy-300">Use TLS/SSL</span>
            </div>
            <button
              type="button"
              onClick={() => update({ useTls: !form.useTls })}
              className={`w-10 h-5 rounded-full transition-colors ${
                form.useTls ? 'bg-accent' : 'bg-navy-700'
              }`}
            >
              <div
                className={`w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${
                  form.useTls ? 'translate-x-5.5' : 'translate-x-0.5'
                }`}
              />
            </button>
          </div>

          {/* Test Connection */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleTest}
              disabled={testStatus === 'testing'}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-navy-800 border border-navy-700/50 text-sm text-navy-300 hover:text-navy-100 hover:border-navy-600/50 disabled:opacity-50 transition-all"
            >
              {testStatus === 'testing' ? (
                <Loader2 size={15} className="animate-spin" />
              ) : testStatus === 'success' ? (
                <CheckCircle2 size={15} className="text-success" />
              ) : testStatus === 'error' ? (
                <XCircle size={15} className="text-danger" />
              ) : (
                <Server size={15} />
              )}
              <span>Test Connection</span>
            </button>
            {testMessage && (
              <span
                className={`text-xs ${
                  testStatus === 'success' ? 'text-success' : 'text-danger'
                }`}
              >
                {testMessage}
              </span>
            )}
          </div>
        </form>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-navy-700/50">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-navy-400 hover:text-navy-200 rounded-lg hover:bg-navy-800 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => onSave(form)}
            className="px-5 py-2 bg-accent hover:bg-accent-hover text-white text-sm font-medium rounded-lg transition-colors"
          >
            {account ? 'Save Changes' : 'Add Account'}
          </button>
        </div>
      </div>
    </div>
  );
}
