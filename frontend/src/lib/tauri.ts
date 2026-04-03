import type { Account, Email, Folder, Contact } from '../types';

// Check if running inside Tauri
const isTauri = (): boolean => {
  return '__TAURI_INTERNALS__' in window;
};

// Dynamic import of Tauri invoke
const getTauriInvoke = async () => {
  if (!isTauri()) return null;
  const { invoke } = await import('@tauri-apps/api/core');
  return invoke;
};

// Wrapper that provides mock data in dev and real IPC in Tauri
async function tauriInvoke<T>(command: string, args?: Record<string, unknown>): Promise<T> {
  const invoke = await getTauriInvoke();
  if (invoke) {
    try {
      return await invoke<T>(command, args);
    } catch (err) {
      console.error(`Tauri invoke error [${command}]:`, err);
      throw err;
    }
  }
  // Fall back to mock
  return mockInvoke<T>(command, args);
}

// ─── Mock data for development without Tauri ───

const MOCK_ACCOUNTS: Account[] = [
  {
    id: 'acc-1',
    name: 'Personal',
    email: 'alex@example.com',
    protocol: 'imap',
    imapHost: 'imap.example.com',
    imapPort: 993,
    smtpHost: 'smtp.example.com',
    smtpPort: 587,
    username: 'alex@example.com',
    password: '',
    useTls: true,
    color: '#3b82f6',
  },
  {
    id: 'acc-2',
    name: 'Work',
    email: 'alex@company.io',
    protocol: 'imap',
    imapHost: 'imap.company.io',
    imapPort: 993,
    smtpHost: 'smtp.company.io',
    smtpPort: 587,
    username: 'alex@company.io',
    password: '',
    useTls: true,
    color: '#8b5cf6',
  },
];

const MOCK_FOLDERS: Folder[] = [
  { id: 'f-inbox', name: 'Inbox', icon: 'inbox', unreadCount: 12, type: 'inbox', accountId: 'acc-1' },
  { id: 'f-sent', name: 'Sent', icon: 'send', unreadCount: 0, type: 'sent', accountId: 'acc-1' },
  { id: 'f-drafts', name: 'Drafts', icon: 'file-edit', unreadCount: 2, type: 'drafts', accountId: 'acc-1' },
  { id: 'f-archive', name: 'Archive', icon: 'archive', unreadCount: 0, type: 'archive', accountId: 'acc-1' },
  { id: 'f-spam', name: 'Spam', icon: 'shield-alert', unreadCount: 5, type: 'spam', accountId: 'acc-1' },
  { id: 'f-trash', name: 'Trash', icon: 'trash-2', unreadCount: 0, type: 'trash', accountId: 'acc-1' },
];

const MOCK_EMAILS: Email[] = [
  {
    id: 'e-1',
    accountId: 'acc-1',
    folderId: 'f-inbox',
    from: { name: 'Sarah Chen', email: 'sarah@startup.io' },
    to: [{ name: 'Alex', email: 'alex@example.com' }],
    cc: [],
    bcc: [],
    subject: 'Q2 Product Roadmap Review',
    preview: 'Hey Alex, I wanted to share the updated Q2 roadmap with you. We have some exciting features planned including the new AI integration...',
    body: `<div style="font-family: -apple-system, sans-serif; line-height: 1.6; color: #e2e8f0;">
      <p>Hey Alex,</p>
      <p>I wanted to share the updated Q2 roadmap with you. We have some exciting features planned including the new AI integration that we discussed last week.</p>
      <h3 style="color: #60a5fa;">Key Milestones:</h3>
      <ul>
        <li><strong>April 15:</strong> AI Email Summarization beta launch</li>
        <li><strong>May 1:</strong> Smart Reply feature</li>
        <li><strong>May 20:</strong> Priority Inbox with ML sorting</li>
        <li><strong>June 10:</strong> Full release candidate</li>
      </ul>
      <p>I've attached the detailed timeline document. Let me know if you have any questions or suggestions.</p>
      <p>Best,<br/>Sarah</p>
    </div>`,
    date: '2026-04-03T09:15:00Z',
    isRead: false,
    isStarred: true,
    hasAttachments: true,
    attachments: [
      { id: 'a-1', filename: 'Q2_Roadmap.pdf', mimeType: 'application/pdf', size: 2450000 },
      { id: 'a-2', filename: 'timeline.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', size: 890000 },
    ],
    priority: 'high',
    labels: ['product', 'roadmap'],
  },
  {
    id: 'e-2',
    accountId: 'acc-1',
    folderId: 'f-inbox',
    from: { name: 'GitHub', email: 'notifications@github.com' },
    to: [{ name: 'Alex', email: 'alex@example.com' }],
    cc: [],
    bcc: [],
    subject: '[mail-client] PR #142: Add email threading support',
    preview: 'marcus-dev requested your review on this pull request. This PR adds conversation threading...',
    body: `<div style="font-family: -apple-system, sans-serif; line-height: 1.6; color: #e2e8f0;">
      <p><strong>marcus-dev</strong> requested your review on <a href="#" style="color: #60a5fa;">pull request #142</a></p>
      <div style="background: #1e293b; border-radius: 8px; padding: 16px; margin: 12px 0; border-left: 3px solid #3b82f6;">
        <p style="margin: 0; font-weight: 600;">Add email threading support</p>
        <p style="margin: 8px 0 0; color: #94a3b8;">This PR adds conversation threading with collapsible message groups, reply indicators, and proper sorting by thread date.</p>
      </div>
      <p style="color: #94a3b8;">+342 lines added, -28 lines removed across 8 files</p>
    </div>`,
    date: '2026-04-03T08:42:00Z',
    isRead: false,
    isStarred: false,
    hasAttachments: false,
    attachments: [],
    priority: 'normal',
    labels: ['github'],
  },
  {
    id: 'e-3',
    accountId: 'acc-1',
    folderId: 'f-inbox',
    from: { name: 'David Park', email: 'david@design.co' },
    to: [{ name: 'Alex', email: 'alex@example.com' }],
    cc: [{ name: 'Sarah Chen', email: 'sarah@startup.io' }],
    bcc: [],
    subject: 'Updated mockups for the compose view',
    preview: 'Hi team, I just finished the new mockups for the compose view. The design focuses on minimalism...',
    body: `<div style="font-family: -apple-system, sans-serif; line-height: 1.6; color: #e2e8f0;">
      <p>Hi team,</p>
      <p>I just finished the new mockups for the compose view. The design focuses on minimalism and distraction-free writing while keeping all essential tools accessible.</p>
      <p>Key design decisions:</p>
      <ol>
        <li>Floating toolbar that appears on text selection</li>
        <li>Drag-and-drop attachment zone at the bottom</li>
        <li>AI assist button integrated into the toolbar</li>
        <li>Keyboard shortcuts for power users</li>
      </ol>
      <p>Please review and let me know your thoughts by EOD Thursday.</p>
      <p>Thanks,<br/>David</p>
    </div>`,
    date: '2026-04-02T16:30:00Z',
    isRead: true,
    isStarred: false,
    hasAttachments: true,
    attachments: [
      { id: 'a-3', filename: 'compose-mockups-v2.fig', mimeType: 'application/octet-stream', size: 4200000 },
    ],
    priority: 'normal',
    labels: ['design'],
  },
  {
    id: 'e-4',
    accountId: 'acc-1',
    folderId: 'f-inbox',
    from: { name: 'AWS Billing', email: 'no-reply@aws.amazon.com' },
    to: [{ name: 'Alex', email: 'alex@example.com' }],
    cc: [],
    bcc: [],
    subject: 'Your AWS bill for March 2026 is available',
    preview: 'Your AWS bill for the billing period March 1 - March 31, 2026 is now available. Total: $127.43',
    body: `<div style="font-family: -apple-system, sans-serif; line-height: 1.6; color: #e2e8f0;">
      <h2 style="color: #f59e0b;">AWS Billing Summary</h2>
      <p>Your AWS bill for the billing period <strong>March 1 - March 31, 2026</strong> is now available.</p>
      <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
        <tr style="border-bottom: 1px solid #334155;"><td style="padding: 8px;">EC2</td><td style="text-align: right; padding: 8px;">$84.20</td></tr>
        <tr style="border-bottom: 1px solid #334155;"><td style="padding: 8px;">S3</td><td style="text-align: right; padding: 8px;">$12.50</td></tr>
        <tr style="border-bottom: 1px solid #334155;"><td style="padding: 8px;">RDS</td><td style="text-align: right; padding: 8px;">$28.10</td></tr>
        <tr style="border-bottom: 1px solid #334155;"><td style="padding: 8px;">Other</td><td style="text-align: right; padding: 8px;">$2.63</td></tr>
        <tr><td style="padding: 8px; font-weight: 700;">Total</td><td style="text-align: right; padding: 8px; font-weight: 700; color: #f59e0b;">$127.43</td></tr>
      </table>
      <p><a href="#" style="color: #60a5fa;">View detailed billing dashboard</a></p>
    </div>`,
    date: '2026-04-01T12:00:00Z',
    isRead: true,
    isStarred: false,
    hasAttachments: false,
    attachments: [],
    priority: 'low',
    labels: ['billing'],
  },
  {
    id: 'e-5',
    accountId: 'acc-1',
    folderId: 'f-inbox',
    from: { name: 'Emma Williams', email: 'emma@legal.firm' },
    to: [{ name: 'Alex', email: 'alex@example.com' }],
    cc: [],
    bcc: [],
    subject: 'URGENT: Contract review needed by tomorrow',
    preview: 'Alex, we need your sign-off on the vendor contract before the deadline tomorrow at 5pm EST...',
    body: `<div style="font-family: -apple-system, sans-serif; line-height: 1.6; color: #e2e8f0;">
      <p>Alex,</p>
      <p>We need your sign-off on the vendor contract before the deadline <strong style="color: #ef4444;">tomorrow at 5pm EST</strong>. The legal team has completed their review and all changes have been incorporated.</p>
      <p>Please review the attached document and reply with your approval or any remaining concerns.</p>
      <p>Key changes from last version:</p>
      <ul>
        <li>Updated indemnification clause (Section 4.2)</li>
        <li>Revised payment terms to Net-30</li>
        <li>Added data protection addendum</li>
      </ul>
      <p>Thanks,<br/>Emma Williams<br/>Senior Legal Counsel</p>
    </div>`,
    date: '2026-04-02T22:15:00Z',
    isRead: false,
    isStarred: true,
    hasAttachments: true,
    attachments: [
      { id: 'a-4', filename: 'Vendor_Contract_v3_FINAL.pdf', mimeType: 'application/pdf', size: 1800000 },
    ],
    priority: 'critical',
    labels: ['legal', 'urgent'],
  },
  {
    id: 'e-6',
    accountId: 'acc-1',
    folderId: 'f-inbox',
    from: { name: 'Newsletter', email: 'digest@technews.dev' },
    to: [{ name: 'Alex', email: 'alex@example.com' }],
    cc: [],
    bcc: [],
    subject: 'This Week in Tech: AI assistants reshape email',
    preview: 'Top stories this week: How AI-powered email clients are changing the way we work, plus React 20 beta...',
    body: `<div style="font-family: -apple-system, sans-serif; line-height: 1.6; color: #e2e8f0;">
      <h2 style="color: #60a5fa;">This Week in Tech</h2>
      <h3>AI Assistants Reshape Email</h3>
      <p>A deep dive into how modern email clients are leveraging local LLMs and cloud AI to summarize, categorize, and even draft responses.</p>
      <h3>React 20 Beta Released</h3>
      <p>The React team announced the beta for version 20, featuring improved server components and a new compiler.</p>
      <h3>Rust Gains in Systems Programming</h3>
      <p>More companies are adopting Rust for critical infrastructure, with new frameworks making it easier than ever.</p>
    </div>`,
    date: '2026-04-01T07:00:00Z',
    isRead: true,
    isStarred: false,
    hasAttachments: false,
    attachments: [],
    priority: 'none',
    labels: ['newsletter'],
  },
  {
    id: 'e-7',
    accountId: 'acc-1',
    folderId: 'f-inbox',
    from: { name: 'James Liu', email: 'james@example.com' },
    to: [{ name: 'Alex', email: 'alex@example.com' }],
    cc: [],
    bcc: [],
    subject: 'Lunch next week?',
    preview: 'Hey! It has been a while since we caught up. Want to grab lunch next Tuesday or Wednesday?',
    body: `<div style="font-family: -apple-system, sans-serif; line-height: 1.6; color: #e2e8f0;">
      <p>Hey!</p>
      <p>It has been a while since we caught up. Want to grab lunch next Tuesday or Wednesday? I'm thinking that new ramen place downtown.</p>
      <p>Let me know what works for you!</p>
      <p>- James</p>
    </div>`,
    date: '2026-03-31T14:20:00Z',
    isRead: true,
    isStarred: false,
    hasAttachments: false,
    attachments: [],
    priority: 'low',
    labels: ['personal'],
  },
];

const MOCK_CONTACTS: Contact[] = [
  { id: 'c-1', name: 'Sarah Chen', email: 'sarah@startup.io' },
  { id: 'c-2', name: 'David Park', email: 'david@design.co' },
  { id: 'c-3', name: 'Emma Williams', email: 'emma@legal.firm' },
  { id: 'c-4', name: 'James Liu', email: 'james@example.com' },
  { id: 'c-5', name: 'Marcus Dev', email: 'marcus@github.dev' },
];

// Mock implementation
function mockInvoke<T>(command: string, args?: Record<string, unknown>): Promise<T> {
  return new Promise((resolve) => {
    // Simulate network delay
    setTimeout(() => {
      switch (command) {
        case 'get_accounts':
          resolve(MOCK_ACCOUNTS as T);
          break;
        case 'get_folders':
          resolve(MOCK_FOLDERS.filter(f => !args?.accountId || f.accountId === args.accountId) as T);
          break;
        case 'get_emails':
          resolve(MOCK_EMAILS.filter(e => !args?.folderId || e.folderId === args.folderId) as T);
          break;
        case 'get_email':
          resolve(MOCK_EMAILS.find(e => e.id === args?.id) as T);
          break;
        case 'get_contacts':
          resolve(MOCK_CONTACTS as T);
          break;
        case 'send_email':
          resolve({ success: true } as T);
          break;
        case 'save_draft':
          resolve({ success: true } as T);
          break;
        case 'delete_email':
          resolve({ success: true } as T);
          break;
        case 'move_email':
          resolve({ success: true } as T);
          break;
        case 'star_email':
          resolve({ success: true } as T);
          break;
        case 'mark_read':
          resolve({ success: true } as T);
          break;
        case 'test_connection':
          resolve({ success: true, message: 'Connection successful' } as T);
          break;
        case 'ai_summarize':
          resolve({ summary: 'This email discusses the Q2 product roadmap with key milestones for AI features including email summarization, smart reply, and priority inbox.' } as T);
          break;
        case 'ai_categorize':
          resolve({ categories: ['product', 'planning', 'ai'] } as T);
          break;
        case 'ai_priority':
          resolve({ priority: 'high' } as T);
          break;
        case 'ai_rewrite':
          resolve({ text: args?.text ? `Improved: ${String(args.text)}` : '' } as T);
          break;
        case 'ai_compose':
          resolve({ text: 'Dear colleague,\n\nThank you for your message. I wanted to follow up regarding the items we discussed.\n\nBest regards' } as T);
          break;
        default:
          resolve({} as T);
      }
    }, 300);
  });
}

// ─── Exported API ───

export const api = {
  getAccounts: () => tauriInvoke<Account[]>('get_accounts'),
  getFolders: (accountId?: string) => tauriInvoke<Folder[]>('get_folders', { accountId }),
  getEmails: (folderId?: string) => tauriInvoke<Email[]>('get_emails', { folderId }),
  getEmail: (id: string) => tauriInvoke<Email>('get_email', { id }),
  getContacts: () => tauriInvoke<Contact[]>('get_contacts'),

  sendEmail: (data: { to: string; cc: string; bcc: string; subject: string; body: string }) =>
    tauriInvoke<{ success: boolean }>('send_email', data),
  saveDraft: (data: { to: string; cc: string; bcc: string; subject: string; body: string }) =>
    tauriInvoke<{ success: boolean }>('save_draft', data),
  deleteEmail: (id: string) => tauriInvoke<{ success: boolean }>('delete_email', { id }),
  moveEmail: (id: string, folderId: string) =>
    tauriInvoke<{ success: boolean }>('move_email', { id, folderId }),
  starEmail: (id: string, starred: boolean) =>
    tauriInvoke<{ success: boolean }>('star_email', { id, starred }),
  markRead: (id: string, read: boolean) =>
    tauriInvoke<{ success: boolean }>('mark_read', { id, read }),
  testConnection: (account: Partial<Account>) =>
    tauriInvoke<{ success: boolean; message: string }>('test_connection', { account }),

  // AI
  aiSummarize: (emailId: string) =>
    tauriInvoke<{ summary: string }>('ai_summarize', { emailId }),
  aiCategorize: (emailId: string) =>
    tauriInvoke<{ categories: string[] }>('ai_categorize', { emailId }),
  aiPriority: (emailId: string) =>
    tauriInvoke<{ priority: string }>('ai_priority', { emailId }),
  aiRewrite: (text: string, tone?: string) =>
    tauriInvoke<{ text: string }>('ai_rewrite', { text, tone }),
  aiCompose: (prompt: string) =>
    tauriInvoke<{ text: string }>('ai_compose', { prompt }),
};
