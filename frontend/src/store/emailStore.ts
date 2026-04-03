import { create } from 'zustand';
import type {
  Account,
  Email,
  Folder,
  Contact,
  ComposeState,
  AIPanelState,
  Priority,
  SortOption,
  SortDirection,
  InboxTab,
  SearchFilter,
} from '../types';
import { api } from '../lib/tauri';

interface EmailState {
  // Data
  accounts: Account[];
  activeAccountId: string | null;
  folders: Folder[];
  activeFolderId: string | null;
  emails: Email[];
  selectedEmailId: string | null;
  selectedEmailIds: string[];
  contacts: Contact[];

  // Search & Sort
  searchQuery: string;
  searchFilters: SearchFilter;
  sortBy: SortOption;
  sortDirection: SortDirection;

  // Inbox tabs
  activeInboxTab: InboxTab;

  // Compose
  compose: ComposeState;

  // AI
  ai: AIPanelState;

  // UI
  sidebarCollapsed: boolean;
  isLoading: boolean;
  lastSyncTime: Date | null;
  connectionStatus: 'connected' | 'syncing' | 'offline';

  // Actions - Data
  loadAccounts: () => Promise<void>;
  setActiveAccount: (id: string) => void;
  loadFolders: (accountId?: string) => Promise<void>;
  setActiveFolder: (id: string) => void;
  loadEmails: (folderId?: string) => Promise<void>;
  selectEmail: (id: string | null) => void;
  toggleEmailSelection: (id: string) => void;
  clearSelection: () => void;
  loadContacts: () => Promise<void>;
  refreshEmails: () => Promise<void>;

  // Actions - Email operations
  starEmail: (id: string) => void;
  flagEmail: (id: string) => void;
  deleteEmail: (id: string) => void;
  moveEmail: (id: string, folderId: string) => void;
  markRead: (id: string, read: boolean) => void;

  // Actions - Search & Sort
  setSearchQuery: (query: string) => void;
  setSearchFilters: (filters: SearchFilter) => void;
  setSortBy: (sort: SortOption) => void;
  setSortDirection: (dir: SortDirection) => void;
  setActiveInboxTab: (tab: InboxTab) => void;

  // Actions - Compose
  openCompose: (mode?: ComposeState['mode'], replyToId?: string) => void;
  closeCompose: () => void;
  updateCompose: (fields: Partial<ComposeState>) => void;
  sendEmail: () => Promise<void>;
  saveDraft: () => Promise<void>;

  // Actions - AI
  toggleAIPanel: () => void;
  aiSummarize: () => Promise<void>;
  aiCategorize: () => Promise<void>;
  aiPriority: () => Promise<void>;
  aiRewrite: (text: string) => Promise<void>;
  aiCompose: (prompt: string) => Promise<void>;
  clearAI: () => void;

  // Actions - UI
  toggleSidebar: () => void;

  // Derived
  getFilteredEmails: () => Email[];
  getSelectedEmail: () => Email | undefined;
  getUnreadCount: () => number;
  getTotalCount: () => number;
}

const defaultCompose: ComposeState = {
  isOpen: false,
  isFullScreen: false,
  to: '',
  cc: '',
  bcc: '',
  subject: '',
  body: '',
  attachments: [],
  mode: 'new',
  importance: 'normal',
};

const defaultAI: AIPanelState = {
  isOpen: false,
  isLoading: false,
  summary: '',
  categories: [],
  priority: 'normal',
  rewriteInput: '',
  rewriteOutput: '',
  quickComposePrompt: '',
  quickComposeOutput: '',
};

export const useEmailStore = create<EmailState>((set, get) => ({
  accounts: [],
  activeAccountId: null,
  folders: [],
  activeFolderId: null,
  emails: [],
  selectedEmailId: null,
  selectedEmailIds: [],
  contacts: [],
  searchQuery: '',
  searchFilters: {},
  sortBy: 'date',
  sortDirection: 'desc',
  activeInboxTab: 'focused',
  compose: { ...defaultCompose },
  ai: { ...defaultAI },
  sidebarCollapsed: false,
  isLoading: false,
  lastSyncTime: null,
  connectionStatus: 'connected',

  loadAccounts: async () => {
    const accounts = await api.getAccounts();
    set({ accounts });
    if (accounts.length > 0 && !get().activeAccountId) {
      set({ activeAccountId: accounts[0].id });
    }
  },

  setActiveAccount: (id) => {
    set({ activeAccountId: id, activeFolderId: null, selectedEmailId: null });
    get().loadFolders(id);
  },

  loadFolders: async (accountId) => {
    const folders = await api.getFolders(accountId);
    set({ folders });
    if (folders.length > 0 && !get().activeFolderId) {
      const inbox = folders.find((f) => f.type === 'inbox');
      if (inbox) {
        set({ activeFolderId: inbox.id });
        get().loadEmails(inbox.id);
      }
    }
  },

  setActiveFolder: (id) => {
    set({ activeFolderId: id, selectedEmailId: null });
    get().loadEmails(id);
  },

  loadEmails: async (folderId) => {
    set({ isLoading: true, connectionStatus: 'syncing' });
    const emails = await api.getEmails(folderId);
    // Add isFlagged default
    const enriched = emails.map(e => ({ ...e, isFlagged: e.isFlagged ?? false }));
    set({ emails: enriched, isLoading: false, connectionStatus: 'connected', lastSyncTime: new Date() });
  },

  selectEmail: (id) => {
    set({ selectedEmailId: id });
    if (id) {
      const email = get().emails.find((e) => e.id === id);
      if (email && !email.isRead) {
        get().markRead(id, true);
      }
    }
  },

  toggleEmailSelection: (id) => {
    set((state) => {
      const ids = state.selectedEmailIds.includes(id)
        ? state.selectedEmailIds.filter(i => i !== id)
        : [...state.selectedEmailIds, id];
      return { selectedEmailIds: ids };
    });
  },

  clearSelection: () => set({ selectedEmailIds: [] }),

  loadContacts: async () => {
    const contacts = await api.getContacts();
    set({ contacts });
  },

  refreshEmails: async () => {
    const { activeFolderId } = get();
    if (activeFolderId) {
      await get().loadEmails(activeFolderId);
    }
  },

  starEmail: (id) => {
    set((state) => ({
      emails: state.emails.map((e) =>
        e.id === id ? { ...e, isStarred: !e.isStarred } : e
      ),
    }));
    const email = get().emails.find((e) => e.id === id);
    if (email) api.starEmail(id, email.isStarred);
  },

  flagEmail: (id) => {
    set((state) => ({
      emails: state.emails.map((e) =>
        e.id === id ? { ...e, isFlagged: !e.isFlagged } : e
      ),
    }));
  },

  deleteEmail: (id) => {
    set((state) => ({
      emails: state.emails.filter((e) => e.id !== id),
      selectedEmailId: state.selectedEmailId === id ? null : state.selectedEmailId,
    }));
    api.deleteEmail(id);
  },

  moveEmail: (id, folderId) => {
    set((state) => ({
      emails: state.emails.filter((e) => e.id !== id),
      selectedEmailId: state.selectedEmailId === id ? null : state.selectedEmailId,
    }));
    api.moveEmail(id, folderId);
  },

  markRead: (id, read) => {
    set((state) => ({
      emails: state.emails.map((e) =>
        e.id === id ? { ...e, isRead: read } : e
      ),
    }));
    api.markRead(id, read);
  },

  setSearchQuery: (searchQuery) => set({ searchQuery }),
  setSearchFilters: (searchFilters) => set({ searchFilters }),
  setSortBy: (sortBy) => set({ sortBy }),
  setSortDirection: (sortDirection) => set({ sortDirection }),
  setActiveInboxTab: (activeInboxTab) => set({ activeInboxTab }),

  openCompose: (mode = 'new', replyToId) => {
    const state = get();
    const composeState: ComposeState = {
      ...defaultCompose,
      isOpen: true,
      mode,
      replyToId,
    };

    if (replyToId && (mode === 'reply' || mode === 'replyAll' || mode === 'forward')) {
      const email = state.emails.find((e) => e.id === replyToId);
      if (email) {
        if (mode === 'reply') {
          composeState.to = email.from.email;
          composeState.subject = `Re: ${email.subject.replace(/^Re:\s*/i, '')}`;
        } else if (mode === 'replyAll') {
          composeState.to = email.from.email;
          composeState.cc = email.cc.map((c) => c.email).join(', ');
          composeState.subject = `Re: ${email.subject.replace(/^Re:\s*/i, '')}`;
        } else if (mode === 'forward') {
          composeState.subject = `Fwd: ${email.subject.replace(/^Fwd:\s*/i, '')}`;
          composeState.body = `\n\n---------- Forwarded message ----------\nFrom: ${email.from.name} <${email.from.email}>\nDate: ${email.date}\nSubject: ${email.subject}\n\n${email.body}`;
        }
      }
    }

    set({ compose: composeState });
  },

  closeCompose: () => set({ compose: { ...defaultCompose } }),

  updateCompose: (fields) =>
    set((state) => ({ compose: { ...state.compose, ...fields } })),

  sendEmail: async () => {
    const { compose } = get();
    await api.sendEmail({
      to: compose.to,
      cc: compose.cc,
      bcc: compose.bcc,
      subject: compose.subject,
      body: compose.body,
    });
    set({ compose: { ...defaultCompose } });
  },

  saveDraft: async () => {
    const { compose } = get();
    await api.saveDraft({
      to: compose.to,
      cc: compose.cc,
      bcc: compose.bcc,
      subject: compose.subject,
      body: compose.body,
    });
  },

  toggleAIPanel: () =>
    set((state) => ({ ai: { ...state.ai, isOpen: !state.ai.isOpen } })),

  aiSummarize: async () => {
    const { selectedEmailId } = get();
    if (!selectedEmailId) return;
    set((state) => ({ ai: { ...state.ai, isLoading: true } }));
    const result = await api.aiSummarize(selectedEmailId);
    set((state) => ({
      ai: { ...state.ai, isLoading: false, summary: result.summary },
    }));
  },

  aiCategorize: async () => {
    const { selectedEmailId } = get();
    if (!selectedEmailId) return;
    set((state) => ({ ai: { ...state.ai, isLoading: true } }));
    const result = await api.aiCategorize(selectedEmailId);
    set((state) => ({
      ai: { ...state.ai, isLoading: false, categories: result.categories },
    }));
  },

  aiPriority: async () => {
    const { selectedEmailId } = get();
    if (!selectedEmailId) return;
    set((state) => ({ ai: { ...state.ai, isLoading: true } }));
    const result = await api.aiPriority(selectedEmailId);
    set((state) => ({
      ai: { ...state.ai, isLoading: false, priority: result.priority as Priority },
    }));
  },

  aiRewrite: async (text) => {
    set((state) => ({ ai: { ...state.ai, isLoading: true, rewriteInput: text } }));
    const result = await api.aiRewrite(text);
    set((state) => ({
      ai: { ...state.ai, isLoading: false, rewriteOutput: result.text },
    }));
  },

  aiCompose: async (prompt) => {
    set((state) => ({
      ai: { ...state.ai, isLoading: true, quickComposePrompt: prompt },
    }));
    const result = await api.aiCompose(prompt);
    set((state) => ({
      ai: { ...state.ai, isLoading: false, quickComposeOutput: result.text },
    }));
  },

  clearAI: () => set({ ai: { ...defaultAI, isOpen: get().ai.isOpen } }),

  toggleSidebar: () =>
    set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),

  getFilteredEmails: () => {
    const { emails, searchQuery, sortBy, sortDirection, searchFilters } = get();
    let filtered = [...emails];

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (e) =>
          e.subject.toLowerCase().includes(q) ||
          e.from.name.toLowerCase().includes(q) ||
          e.from.email.toLowerCase().includes(q) ||
          e.preview.toLowerCase().includes(q)
      );
    }

    if (searchFilters.isUnread) {
      filtered = filtered.filter(e => !e.isRead);
    }
    if (searchFilters.isFlagged) {
      filtered = filtered.filter(e => e.isFlagged);
    }
    if (searchFilters.hasAttachment) {
      filtered = filtered.filter(e => e.hasAttachments);
    }
    if (searchFilters.from) {
      const f = searchFilters.from.toLowerCase();
      filtered = filtered.filter(e => e.from.email.toLowerCase().includes(f) || e.from.name.toLowerCase().includes(f));
    }

    filtered.sort((a, b) => {
      const dir = sortDirection === 'asc' ? 1 : -1;
      switch (sortBy) {
        case 'date':
          return dir * (new Date(a.date).getTime() - new Date(b.date).getTime());
        case 'sender':
          return dir * a.from.name.localeCompare(b.from.name);
        case 'subject':
          return dir * a.subject.localeCompare(b.subject);
        case 'priority': {
          const pOrder: Record<string, number> = { critical: 0, high: 1, normal: 2, low: 3, none: 4 };
          return dir * ((pOrder[a.priority] ?? 2) - (pOrder[b.priority] ?? 2));
        }
        case 'unread':
          return dir * (Number(b.isRead) - Number(a.isRead));
        default:
          return 0;
      }
    });

    return filtered;
  },

  getSelectedEmail: () => {
    const { emails, selectedEmailId } = get();
    return emails.find((e) => e.id === selectedEmailId);
  },

  getUnreadCount: () => {
    return get().emails.filter(e => !e.isRead).length;
  },

  getTotalCount: () => {
    return get().emails.length;
  },
}));
