export interface Account {
  id: string;
  name: string;
  email: string;
  protocol: 'imap' | 'pop3';
  imapHost: string;
  imapPort: number;
  smtpHost: string;
  smtpPort: number;
  username: string;
  password: string;
  useTls: boolean;
  color: string;
}

export interface Folder {
  id: string;
  name: string;
  icon: string;
  unreadCount: number;
  type: 'inbox' | 'sent' | 'drafts' | 'trash' | 'spam' | 'archive' | 'custom';
  accountId: string;
}

export interface EmailAddress {
  name: string;
  email: string;
}

export interface Attachment {
  id: string;
  filename: string;
  mimeType: string;
  size: number;
}

export type Priority = 'critical' | 'high' | 'normal' | 'low' | 'none';

export interface Email {
  id: string;
  accountId: string;
  folderId: string;
  from: EmailAddress;
  to: EmailAddress[];
  cc: EmailAddress[];
  bcc: EmailAddress[];
  subject: string;
  preview: string;
  body: string;
  date: string;
  isRead: boolean;
  isStarred: boolean;
  hasAttachments: boolean;
  attachments: Attachment[];
  priority: Priority;
  labels: string[];
}

export interface Contact {
  id: string;
  name: string;
  email: string;
  avatar?: string;
}

export interface ComposeState {
  isOpen: boolean;
  isFullScreen: boolean;
  to: string;
  cc: string;
  bcc: string;
  subject: string;
  body: string;
  attachments: File[];
  replyToId?: string;
  mode: 'new' | 'reply' | 'replyAll' | 'forward';
}

export interface AIPanelState {
  isOpen: boolean;
  isLoading: boolean;
  summary: string;
  categories: string[];
  priority: Priority;
  rewriteInput: string;
  rewriteOutput: string;
  quickComposePrompt: string;
  quickComposeOutput: string;
}

export interface AISettings {
  provider: 'openai' | 'anthropic' | 'ollama' | 'custom';
  baseUrl: string;
  apiKey: string;
  model: string;
  temperature: number;
}

export interface DisplayPreferences {
  compactMode: boolean;
  showPreview: boolean;
  showAvatars: boolean;
}

export type Theme = 'dark' | 'light';

export type SortOption = 'date' | 'priority' | 'unread' | 'sender' | 'subject';
export type SortDirection = 'asc' | 'desc';
