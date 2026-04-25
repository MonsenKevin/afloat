import { create } from 'zustand';
import { ContactSuggestion } from '../types/index';
import apiClient from '../api/client';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  type?: 'text' | 'kb_answer' | 'github_contacts';
  data?: {
    contacts?: { name: string; email?: string; reason: string }[];
    documents?: { title: string; section: string }[];
    githubContacts?: ContactSuggestion[];
    citation?: string;
  };
  timestamp: string;
}

interface ChatState {
  messages: ChatMessage[];
  isLoading: boolean;
  addMessage: (msg: Omit<ChatMessage, 'id' | 'timestamp'>) => void;
  sendMessage: (text: string) => Promise<void>;
  clearMessages: () => void;
  restoreMessages: (userId: string) => Promise<void>;
}

function storageKey(userId: string) {
  return `afloat_messages_${userId}`;
}

function isFilePath(text: string): boolean {
  return /[/\\]/.test(text) || /\.(ts|tsx|js|jsx|py|go|java|rb|rs|cpp|c|h)$/.test(text) || text.startsWith('src/');
}

// Track current user ID for storage key
let currentUserId = '';

export const useChatStore = create<ChatState>((set, get) => ({
  messages: [],
  isLoading: false,

  addMessage: (msg) => {
    const newMsg: ChatMessage = {
      ...msg,
      id: Date.now().toString(),
      timestamp: new Date().toISOString(),
    };
    const messages = [...get().messages, newMsg];
    set({ messages });
    if (currentUserId) {
      chrome.storage.local.set({ [storageKey(currentUserId)]: JSON.stringify(messages) });
    }
  },

  sendMessage: async (text) => {
    const { addMessage } = get();
    addMessage({ role: 'user', content: text, type: 'text' });
    set({ isLoading: true });

    try {
      if (isFilePath(text)) {
        const parts = text.trim().split(/\s+/);
        const filePath = parts[parts.length - 1];
        const repo = parts.length > 1 ? parts[0] : 'platform';
        const res = await apiClient.post('/api/github/blame', { repo, filePath });
        const contacts: ContactSuggestion[] = res.data.contacts || [];
        if (contacts.length === 0) {
          addMessage({ role: 'assistant', content: 'No contributors found for that file path.', type: 'text' });
        } else {
          addMessage({
            role: 'assistant',
            content: `Found ${contacts.length} contributor(s) for \`${filePath}\`:`,
            type: 'github_contacts',
            data: { githubContacts: contacts },
          });
        }
      } else {
        const history = get().messages
          .slice(-6)
          .map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
          .join('\n');
        const res = await apiClient.post('/api/kb/ask', { question: text, history });
        if (res.data.answer) {
          addMessage({
            role: 'assistant',
            content: res.data.answer as string,
            type: 'kb_answer',
            data: {
              contacts: res.data.contacts || [],
              documents: res.data.documents || [],
            },
          });
        } else {
          addMessage({
            role: 'assistant',
            content: (res.data.message as string) || 'No relevant information found. Consider asking a teammate.',
            type: 'text',
          });
        }
      }
    } catch {
      addMessage({ role: 'assistant', content: 'Mission Control is temporarily offline. Try again in a moment.', type: 'text' });
    } finally {
      set({ isLoading: false });
    }
  },

  clearMessages: () => {
    set({ messages: [] });
    if (currentUserId) {
      chrome.storage.local.remove([storageKey(currentUserId)]);
    }
  },

  restoreMessages: async (userId: string) => {
    currentUserId = userId;
    try {
      const key = storageKey(userId);
      const result = await chrome.storage.local.get([key]);
      if (result[key]) {
        set({ messages: JSON.parse(result[key] as string) as ChatMessage[] });
      } else {
        set({ messages: [] });
      }
    } catch {
      set({ messages: [] });
    }
  },
}));
