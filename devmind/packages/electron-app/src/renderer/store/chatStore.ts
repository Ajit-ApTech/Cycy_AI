import { create } from 'zustand';
import stripAnsi from 'strip-ansi';

export interface Attachment {
    path: string;
    name: string;
    type: string;
    base64?: string;
}

export interface ChatMessage {
    id: string;
    role: 'user' | 'assistant' | 'system';
    content: string;
    timestamp: string;
    attachments?: Attachment[];
}

interface ChatStore {
    messages: ChatMessage[];
    isStreaming: boolean;
    addMessage: (msg: ChatMessage) => void;
    appendToken: (token: string) => void;
    setStreaming: (streaming: boolean) => void;
    clearHistory: () => void;
}

export const useChatStore = create<ChatStore>((set) => ({
    messages: [],
    isStreaming: false,
    addMessage: (msg) => set((state) => ({
        messages: [...state.messages, { ...msg, content: stripAnsi(msg.content) }]
    })),
    appendToken: (token) => set((state) => {
        const messages = [...state.messages];
        if (messages.length > 0 && messages[messages.length - 1].role === 'assistant') {
            messages[messages.length - 1].content += stripAnsi(token);
        }
        return { messages };
    }),
    setStreaming: (streaming) => set({ isStreaming: streaming }),
    clearHistory: () => set({ messages: [] })
}));
