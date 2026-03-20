import React, { useEffect } from 'react';
import Layout from './components/Layout';
import { useChatStore } from './store/chatStore';

const App: React.FC = () => {
    const { appendToken, addMessage } = useChatStore();

    useEffect(() => {
        // Basic Chat hookup
        window.devmindAPI.chat.onToken((token: string) => {
            const isTurnStart = token.includes('[TURN_START]');
            const isEndOfStream = token.includes('You: ') ||
                token.includes('You:') ||
                token.includes('Run this command? (y/n):') ||
                token.includes('[STATUS: RUNNING_COMMAND]');

            if (isEndOfStream) {
                useChatStore.getState().setStreaming(false);
            }

            // Clean up markers from the token before display
            let cleanToken = token
                .replace(/\[TURN_START\]/g, '')
                .replace(/You:\s*/g, '')
                .replace(/\[STATUS: RUNNING_COMMAND\].*/g, '');

            if (!cleanToken.trim() && !isTurnStart) return;

            const messages = useChatStore.getState().messages;
            const lastMsg = messages[messages.length - 1];

            // Force a new bubble if it's a [TURN_START] or if the last message wasn't from assistant
            if (isTurnStart || !lastMsg || lastMsg.role !== 'assistant') {
                addMessage({
                    id: Date.now().toString() + (isTurnStart ? '-turn' : ''),
                    role: 'assistant',
                    content: cleanToken,
                    timestamp: new Date().toISOString()
                });
            } else {
                appendToken(cleanToken);
            }
        });

        window.devmindAPI.chat.onError((error: string) => {
            useChatStore.getState().setStreaming(false);
            addMessage({
                id: Date.now().toString(),
                role: 'system',
                content: `Error: ${error}`,
                timestamp: new Date().toISOString()
            });
        });

        return () => {
            window.devmindAPI.chat.removeListeners();
        };
    }, [addMessage, appendToken]);

    return <Layout />;
};

export default App;
