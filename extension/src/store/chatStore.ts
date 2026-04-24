import { create } from 'zustand';
import { ContactSuggestion, KBAnswer } from '../types/index';
import apiClient from '../api/client';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  type?: 'text' | 'kb_answer' | 'github_contacts';
  data?: KBAnswer | ContactSuggestion[];
  timestamp: string;
}

interface ChatState {
  messages: ChatMessage[];
  isLoading: boolean;
  addMessage: (msg: Omit<ChatMessage, 'id' | 'timestamp'>) => void;
  sendMessage: (text: string) => Promise<void>;
  clearMessages: () => void;
  restoreMessages: () => Promise<void>;
}

function isFilePath(text: string): boolean {
  return /[/\\]/.test(text) || /\.(ts|tsx|js|jsx|py|go|java|rb|rs|cpp|c|h)$/.test(text) || text.startsWith('src/');
}

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
    chrome.storage.local.set({ afloat_messages: JSON.stringify(messages) });
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
            data: contacts,
          });
        }
      } else {
        const res = await apiClient.post('/api/kb/ask', { question: text });
        if (res.data.answers && res.data.answers.length > 0) {
          addMessage({
            role: 'assistant',
            content: res.data.answers[0].answer as string,
            type: 'kb_answer',
            data: res.data.answers[0] as KBAnswer,
          });
        } else {
          addMessage({
            role: 'assistant',
            content: (res.data.message as string) || 'No relevant documents found. Consider asking a teammate.',
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
    chrome.storage.local.remove(['afloat_messages']);
  },

  restoreMessages: async () => {
    try {
      const result = await chrome.storage.local.get(['afloat_messages']);
      if (result.afloat_messages) {
        set({ messages: JSON.parse(result.afloat_messages as string) as ChatMessage[] });
      }
    } catch {
      // ignore
    }
  },
}));
