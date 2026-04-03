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
  Globe,
} from 'lucide-react';
import type { Account } from '../types';
import { api } from '../lib/tauri';
import { useSettingsStore } from '../store/settingsStore';

interface AccountFormProps {
  account?: Account | null;
  onSave: (account: Account) => void;
  onClose: () => void;
}

const PRESETS: Record<string, Partial<Account>> = {
  gmail: {
    imapHost: 'imap.gmail.com', imapPort: 993,
    smtpHost: 'smtp.gmail.com', smtpPort: 587,
    useTls: true, protocol: 'imap',
  },
  outlook: {
    imapHost: 'outlook.office365.com', imapPort: 993,
    smtpHost: 'smtp.office365.com', smtpPort: 587,
    useTls: true, protocol: 'imap',
  },
  yahoo: {
    imapHost: 'imap.mail.yahoo.com', imapPort: 993,
    smtpHost: 'smtp.mail.yahoo.com', smtpPort: 587,
    useTls: true, protocol: 'imap',
  },
  icloud: {
    imapHost: 'imap.mail.me.com', imapPort: 993,
    smtpHost: 'smtp.mail.me.com', smtpPort: 587,
    useTls: true, protocol: 'imap',
  },
};

const COLORS = ['#0078d4', '#8764b8', '#e3008c', '#ca5010', '#107c10', '#038387', '#d13438', '#4f6bed'];

type SetupStep = 'email' | 'config';

export function AccountForm({ account, onSave, onClose }: AccountFormProps) {
  const { theme } = useSettingsStore();
  const isDark = theme === 'dark';

  const [step, setStep] = useState<SetupStep>(account ? 'config' : 'email');
  const [detectedProvider, setDetectedProvider] = useState<string | null>(null);

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

  // Auto-detect provider from email
  useEffect(() => {
    const email = form.email.toLowerCase();
    let provider: string | null = null;

    if (email.includes('@gmail.com')) provider = 'gmail';
    else if (email.includes('@outlook.com') || email.includes('@hotmail.com') || email.includes('@live.com')) provider = 'outlook';
    else if (email.includes('@yahoo.com') || email.includes('@yahoo.co')) provider = 'yahoo';
    else if (email.includes('@icloud.com') || email.includes('@me.com')) provider = 'icloud';

    setDetectedProvider(provider);

    if (provider && !account) {
      const preset = PRESETS[provider];
      setForm((f) => ({ ...f, ...preset, username: form.email }));
    }
  }, [form.email, account]);

  const update = (fields: Partial<Account>) => setForm((f) => ({ ...f, ...fields }));

  const handleEmailNext = () => {
    if (!form.email) return;

    // Auto-set name from email
    if (!form.name) {
      const namePart = form.email.split('@')[0];
      const formatted = namePart.replace(/[._-]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
      update({ name: formatted });
    }

    setStep('config');
  };

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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className={`w-full max-w-lg rounded-lg shadow-2xl border ${
        isDark ? 'bg-old-surface border-old-border' : 'bg-ol-surface border-ol-border'
      }`}>
        {/* Header */}
        <div className={`flex items-center justify-between px-5 py-3 border-b ${isDark ? 'border-old-border' : 'border-ol-border'}`}>
          <h2 className={`text-[15px] font-semibold ${isDark ? 'text-old-text' : 'text-ol-text'}`}>
            {account ? 'Edit Account' : 'Add Account'}
          </h2>
          <button onClick={onClose}
            className={`p-1 rounded ${isDark ? 'text-old-text-tertiary hover:text-old-text hover:bg-old-hover' : 'text-ol-text-tertiary hover:text-ol-text hover:bg-ol-hover'}`}>
            <X size={16} />
          </button>
        </div>

        {/* Step 1: Email entry */}
        {step === 'email' && (
          <div className="p-5 space-y-4">
            <div className="text-center py-4">
              <Mail size={36} className="mx-auto mb-3 text-accent" />
              <p className={`text-[14px] font-medium ${isDark ? 'text-old-text' : 'text-ol-text'}`}>
                Add your email account
              </p>
              <p className={`text-[12px] mt-1 ${isDark ? 'text-old-text-secondary' : 'text-ol-text-secondary'}`}>
                Enter your email address and we will try to detect your provider
              </p>
            </div>

            <div>
              <div className="relative">
                <Mail size={15} className={`absolute left-3 top-1/2 -translate-y-1/2 ${isDark ? 'text-old-text-tertiary' : 'text-ol-text-tertiary'}`} />
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => update({ email: e.target.value })}
                  placeholder="you@example.com"
                  autoFocus
                  className={`w-full pl-9 pr-3 py-2.5 text-[13px] rounded border outline-none no-transition ${
                    isDark ? 'bg-old-surface-alt border-old-border text-old-text focus:border-accent' : 'bg-ol-bg border-ol-border text-ol-text focus:border-accent'
                  }`}
                />
              </div>
              {detectedProvider && (
                <div className="flex items-center gap-1.5 mt-2 text-success">
                  <Globe size={13} />
                  <span className="text-[12px]">Detected: {detectedProvider.charAt(0).toUpperCase() + detectedProvider.slice(1)}</span>
                </div>
              )}
            </div>

            <button
              onClick={handleEmailNext}
              disabled={!form.email}
              className="w-full py-2.5 bg-accent hover:bg-accent-hover disabled:opacity-50 text-white text-[13px] font-semibold rounded"
            >
              Continue
            </button>
          </div>
        )}

        {/* Step 2: Full config */}
        {step === 'config' && (
          <form onSubmit={handleSubmit} className="p-5 space-y-3 max-h-[70vh] overflow-y-auto">
            {/* Name & Color */}
            <div className="flex gap-3">
              <div className="flex-1">
                <FieldLabel isDark={isDark}>Account Name</FieldLabel>
                <div className="relative">
                  <User size={14} className={`absolute left-3 top-1/2 -translate-y-1/2 ${isDark ? 'text-old-text-tertiary' : 'text-ol-text-tertiary'}`} />
                  <input type="text" value={form.name} onChange={(e) => update({ name: e.target.value })}
                    placeholder="Personal" required
                    className={`w-full pl-9 pr-3 py-2 text-[13px] rounded border outline-none no-transition ${
                      isDark ? 'bg-old-surface-alt border-old-border text-old-text focus:border-accent' : 'bg-ol-bg border-ol-border text-ol-text focus:border-accent'
                    }`}
                  />
                </div>
              </div>
              <div>
                <FieldLabel isDark={isDark}>Color</FieldLabel>
                <div className="flex gap-1 py-2">
                  {COLORS.map((c) => (
                    <button key={c} type="button" onClick={() => update({ color: c })}
                      className={`w-5 h-5 rounded-full border-2 ${form.color === c ? 'border-white shadow-sm' : 'border-transparent'}`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>
            </div>

            {/* Email */}
            <div>
              <FieldLabel isDark={isDark}>Email Address</FieldLabel>
              <div className="relative">
                <Mail size={14} className={`absolute left-3 top-1/2 -translate-y-1/2 ${isDark ? 'text-old-text-tertiary' : 'text-ol-text-tertiary'}`} />
                <input type="email" value={form.email} onChange={(e) => update({ email: e.target.value })}
                  placeholder="you@example.com" required
                  className={`w-full pl-9 pr-3 py-2 text-[13px] rounded border outline-none no-transition ${
                    isDark ? 'bg-old-surface-alt border-old-border text-old-text focus:border-accent' : 'bg-ol-bg border-ol-border text-ol-text focus:border-accent'
                  }`}
                />
              </div>
            </div>

            {/* Quick presets */}
            <div className="flex gap-2 items-center">
              <span className={`text-[11px] ${isDark ? 'text-old-text-tertiary' : 'text-ol-text-tertiary'}`}>Provider:</span>
              {Object.keys(PRESETS).map((key) => (
                <button key={key} type="button"
                  onClick={() => setForm((f) => ({ ...f, ...PRESETS[key] }))}
                  className={`text-[11px] px-2 py-1 rounded border capitalize ${
                    detectedProvider === key
                      ? 'border-accent text-accent bg-accent/5'
                      : isDark ? 'border-old-border text-old-text-secondary hover:bg-old-hover' : 'border-ol-border text-ol-text-secondary hover:bg-ol-hover'
                  }`}
                >
                  {key}
                </button>
              ))}
            </div>

            {/* Server Config */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <FieldLabel isDark={isDark}>IMAP Host</FieldLabel>
                <div className="relative">
                  <Server size={14} className={`absolute left-3 top-1/2 -translate-y-1/2 ${isDark ? 'text-old-text-tertiary' : 'text-ol-text-tertiary'}`} />
                  <input type="text" value={form.imapHost} onChange={(e) => update({ imapHost: e.target.value })}
                    placeholder="imap.example.com"
                    className={`w-full pl-9 pr-3 py-2 text-[13px] rounded border outline-none no-transition ${
                      isDark ? 'bg-old-surface-alt border-old-border text-old-text focus:border-accent' : 'bg-ol-bg border-ol-border text-ol-text focus:border-accent'
                    }`}
                  />
                </div>
              </div>
              <div>
                <FieldLabel isDark={isDark}>Port</FieldLabel>
                <input type="number" value={form.imapPort} onChange={(e) => update({ imapPort: parseInt(e.target.value) || 993 })}
                  className={`w-full px-3 py-2 text-[13px] rounded border outline-none no-transition ${
                    isDark ? 'bg-old-surface-alt border-old-border text-old-text focus:border-accent' : 'bg-ol-bg border-ol-border text-ol-text focus:border-accent'
                  }`}
                />
              </div>
              <div>
                <FieldLabel isDark={isDark}>SMTP Host</FieldLabel>
                <div className="relative">
                  <Server size={14} className={`absolute left-3 top-1/2 -translate-y-1/2 ${isDark ? 'text-old-text-tertiary' : 'text-ol-text-tertiary'}`} />
                  <input type="text" value={form.smtpHost} onChange={(e) => update({ smtpHost: e.target.value })}
                    placeholder="smtp.example.com"
                    className={`w-full pl-9 pr-3 py-2 text-[13px] rounded border outline-none no-transition ${
                      isDark ? 'bg-old-surface-alt border-old-border text-old-text focus:border-accent' : 'bg-ol-bg border-ol-border text-ol-text focus:border-accent'
                    }`}
                  />
                </div>
              </div>
              <div>
                <FieldLabel isDark={isDark}>Port</FieldLabel>
                <input type="number" value={form.smtpPort} onChange={(e) => update({ smtpPort: parseInt(e.target.value) || 587 })}
                  className={`w-full px-3 py-2 text-[13px] rounded border outline-none no-transition ${
                    isDark ? 'bg-old-surface-alt border-old-border text-old-text focus:border-accent' : 'bg-ol-bg border-ol-border text-ol-text focus:border-accent'
                  }`}
                />
              </div>
            </div>

            {/* Credentials */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <FieldLabel isDark={isDark}>Username</FieldLabel>
                <input type="text" value={form.username} onChange={(e) => update({ username: e.target.value })}
                  placeholder="username"
                  className={`w-full px-3 py-2 text-[13px] rounded border outline-none no-transition ${
                    isDark ? 'bg-old-surface-alt border-old-border text-old-text focus:border-accent' : 'bg-ol-bg border-ol-border text-ol-text focus:border-accent'
                  }`}
                />
              </div>
              <div>
                <FieldLabel isDark={isDark}>Password</FieldLabel>
                <div className="relative">
                  <Lock size={14} className={`absolute left-3 top-1/2 -translate-y-1/2 ${isDark ? 'text-old-text-tertiary' : 'text-ol-text-tertiary'}`} />
                  <input type="password" value={form.password} onChange={(e) => update({ password: e.target.value })}
                    placeholder="********"
                    className={`w-full pl-9 pr-3 py-2 text-[13px] rounded border outline-none no-transition ${
                      isDark ? 'bg-old-surface-alt border-old-border text-old-text focus:border-accent' : 'bg-ol-bg border-ol-border text-ol-text focus:border-accent'
                    }`}
                  />
                </div>
              </div>
            </div>

            {/* TLS Toggle */}
            <div className={`flex items-center justify-between p-2.5 rounded border ${
              isDark ? 'border-old-border' : 'border-ol-border'
            }`}>
              <div className="flex items-center gap-2">
                <Lock size={14} className={isDark ? 'text-old-text-secondary' : 'text-ol-text-secondary'} />
                <span className={`text-[13px] ${isDark ? 'text-old-text' : 'text-ol-text'}`}>Use TLS/SSL</span>
              </div>
              <button type="button" onClick={() => update({ useTls: !form.useTls })}
                className={`w-9 h-5 rounded-full flex-shrink-0 relative ${form.useTls ? 'bg-accent' : isDark ? 'bg-old-border' : 'bg-ol-border'}`}>
                <div className={`w-3.5 h-3.5 rounded-full bg-white shadow-sm absolute top-[3px] transition-all ${
                  form.useTls ? 'left-[19px]' : 'left-[3px]'
                }`} />
              </button>
            </div>

            {/* Test Connection */}
            <div className="flex items-center gap-3">
              <button type="button" onClick={handleTest} disabled={testStatus === 'testing'}
                className={`flex items-center gap-2 px-4 py-2 text-[13px] rounded border ${
                  isDark ? 'border-old-border text-old-text hover:bg-old-hover' : 'border-ol-border text-ol-text hover:bg-ol-hover'
                } disabled:opacity-50`}
              >
                {testStatus === 'testing' ? <Loader2 size={14} className="animate-spin" />
                  : testStatus === 'success' ? <CheckCircle2 size={14} className="text-success" />
                  : testStatus === 'error' ? <XCircle size={14} className="text-danger" />
                  : <Server size={14} />}
                <span>Test Connection</span>
              </button>
              {testMessage && (
                <span className={`text-[12px] ${testStatus === 'success' ? 'text-success' : 'text-danger'}`}>
                  {testMessage}
                </span>
              )}
            </div>
          </form>
        )}

        {/* Footer */}
        {step === 'config' && (
          <div className={`flex items-center justify-between px-5 py-3 border-t ${isDark ? 'border-old-border' : 'border-ol-border'}`}>
            {!account && (
              <button onClick={() => setStep('email')}
                className={`text-[13px] ${isDark ? 'text-old-text-secondary hover:text-old-text' : 'text-ol-text-secondary hover:text-ol-text'}`}>
                Back
              </button>
            )}
            <div className="flex items-center gap-2 ml-auto">
              <button onClick={onClose}
                className={`px-4 py-1.5 text-[13px] rounded ${isDark ? 'text-old-text-secondary hover:bg-old-hover' : 'text-ol-text-secondary hover:bg-ol-hover'}`}>
                Cancel
              </button>
              <button onClick={() => onSave(form)}
                className="px-4 py-1.5 bg-accent hover:bg-accent-hover text-white text-[13px] font-semibold rounded">
                {account ? 'Save Changes' : 'Add Account'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function FieldLabel({ isDark, children }: { isDark: boolean; children: React.ReactNode }) {
  return (
    <label className={`block text-[11px] font-medium mb-1 ${isDark ? 'text-old-text-secondary' : 'text-ol-text-secondary'}`}>
      {children}
    </label>
  );
}
