import React, { useState, useRef, useEffect } from 'react';
import { useChatStore, ChatMessage, Attachment } from '../store/chatStore';
import { Send, Square, Zap, Map, Trash2, Copy, ChevronDown, Settings, Key, X, Check, Terminal as TerminalIcon, FileText, Paperclip } from 'lucide-react';

type Mode = 'fast' | 'plan';

const PROVIDERS: Record<string, { label: string; models: string[]; needsKey: boolean; keyPlaceholder: string }> = {
    gemini: {
        label: '✦ Google Gemini',
        models: ['gemini-2.0-flash', 'gemini-2.0-pro', 'gemini-1.5-pro', 'gemini-1.5-flash'],
        needsKey: true,
        keyPlaceholder: 'Google AI API key (AIza...)'
    },
    nvidia: {
        label: '⚡ NVIDIA NIM',
        models: ['meta/llama-3.1-405b-instruct', 'mistralai/mixtral-8x22b-instruct-v0.1', 'microsoft/phi-3-medium-128k-instruct', 'meta/llama3-70b-instruct'],
        needsKey: true,
        keyPlaceholder: 'NVIDIA NIM API key (nvapi-...)'
    },
    openai: {
        label: '◎ OpenAI',
        models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-3.5-turbo'],
        needsKey: true,
        keyPlaceholder: 'OpenAI API key (sk-...)'
    },
    groq: {
        label: '⚡ Groq (Fast)',
        models: ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'mixtral-8x7b-32768', 'gemma2-9b-it'],
        needsKey: true,
        keyPlaceholder: 'Groq API key (gsk_...)'
    },
    ollama: {
        label: '🖥 Ollama (Local)',
        models: ['llama3.2', 'mistral', 'phi4', 'qwen2.5-coder'],
        needsKey: false,
        keyPlaceholder: ''
    },
    glm: {
        label: '🌐 GLM (Zhipu)',
        models: ['glm-4', 'glm-4-flash', 'glm-3-turbo'],
        needsKey: true,
        keyPlaceholder: 'ZhipuAI API key'
    },
};

const ChatPane: React.FC<{ width?: number }> = ({ width = 360 }) => {
    const { messages, isStreaming, addMessage, setStreaming, clearHistory } = useChatStore();
    const [input, setInput] = useState('');
    const [mode, setMode] = useState<Mode>('fast');
    const [showModeMenu, setShowModeMenu] = useState(false);
    const [showSettings, setShowSettings] = useState(false);
    const [copiedId, setCopiedId] = useState<string | null>(null);
    const [answeredPrompts, setAnsweredPrompts] = useState<Set<string>>(new Set());
    const [attachments, setAttachments] = useState<Attachment[]>([]);

    const [provider, setProvider] = useState('gemini');
    const [model, setModel] = useState(PROVIDERS.gemini.models[0]);
    const [apiKey, setApiKey] = useState('');
    const [configured, setConfigured] = useState(false);
    const [showApiKey, setShowApiKey] = useState(false);
    const [fetchedModels, setFetchedModels] = useState<string[]>([]);
    const [isFetchingModels, setIsFetchingModels] = useState(false);
    const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    // Load saved settings on mount
    useEffect(() => {
        (async () => {
            const savedProvider = await window.devmindAPI.database.getSetting('provider');
            const savedModel = await window.devmindAPI.database.getSetting('model');
            if (savedProvider && PROVIDERS[savedProvider]) {
                setProvider(savedProvider);
                setModel(savedModel || PROVIDERS[savedProvider].models[0]);

                // Load saved API key for this provider
                const savedApiKey = await window.devmindAPI.database.getSetting(`api_key_${savedProvider}`);
                if (savedApiKey) {
                    setApiKey(savedApiKey);
                }
            }
        })();
    }, []);

    const handleProviderChange = async (p: string) => {
        setProvider(p);
        setModel(PROVIDERS[p].models[0]);
        setFetchedModels([]);
        setConfigured(false);

        // Load saved API key for the new provider
        const savedApiKey = await window.devmindAPI.database.getSetting(`api_key_${p}`);
        if (savedApiKey) {
            setApiKey(savedApiKey);
        } else {
            setApiKey('');
        }
    };

    const handleFetchModels = async () => {
        if (PROVIDERS[provider].needsKey && !apiKey.trim()) {
            alert('Please enter an API key first.');
            return;
        }

        setIsFetchingModels(true);
        try {
            // Use the main process service via IPC
            const models = await window.devmindAPI.chat.fetchModels(provider, apiKey.trim());

            if (models && models.length > 0) {
                // Deduplicate to avoid React key warnings
                const uniqueModels = Array.from(new Set(models));
                setFetchedModels(uniqueModels);
                setModel(uniqueModels[0]);
            } else {
                alert('No models found for this provider.');
            }
        } catch (e: any) {
            console.error('[ChatPane] Fetch models error:', e);
            alert('Failed to fetch models: ' + e.message + '\n(Check your API key and network connection)');
        } finally {
            setIsFetchingModels(false);
        }
    };

    const handleSaveApiKey = () => {
        if (!apiKey.trim()) {
            alert('Please enter an API key first.');
            return;
        }
        setSaveStatus('saving');
        window.devmindAPI.database.saveSetting(`api_key_${provider}`, apiKey.trim());
        setTimeout(() => {
            setSaveStatus('saved');
            setTimeout(() => setSaveStatus('idle'), 2000);
        }, 300);
    };

    const handleApplyConfig = () => {
        if (PROVIDERS[provider].needsKey && !apiKey.trim()) {
            alert('Please enter an API key for ' + PROVIDERS[provider].label);
            return;
        }
        window.devmindAPI.chat.setConfig(provider, model, apiKey.trim());
        setConfigured(true);
        setShowSettings(false);

        // Clear messages from previous provider
        clearHistory();
        addMessage({ id: 'system-1', role: 'system', content: `Switched to ${PROVIDERS[provider].label} · ${model}`, timestamp: new Date().toISOString() });

        // Auto-start the chat with a silent greeting so the AI responds immediately
        setTimeout(() => {
            const greetingMsg = {
                id: Date.now().toString(),
                role: 'user' as const,
                content: 'Hi',
                timestamp: new Date().toISOString()
            };
            addMessage(greetingMsg);
            window.devmindAPI.database.saveMessage({ ...greetingMsg, sessionId: 'default' });
            window.devmindAPI.chat.send('Hi');
            setStreaming(true);
        }, 300);
    };

    const handleSend = () => {
        if ((!input.trim() && attachments.length === 0) || !configured) return;

        const msgId = Date.now().toString();
        const payload = attachments.length > 0
            ? { text: input, attachments }
            : input;

        window.devmindAPI.chat.send(payload);
        setStreaming(true);

        addMessage({
            id: msgId,
            role: 'user',
            content: input,
            attachments: attachments.length > 0 ? attachments : undefined,
            timestamp: new Date().toISOString()
        });

        setInput('');
        setAttachments([]);
        if (textareaRef.current) {
            textareaRef.current.style.height = '36px';
        }
    };

    const handleAttach = async () => {
        const file = await window.devmindAPI.chat.selectFile();
        if (file) {
            setAttachments(prev => [...prev, file]);
        }
    };

    const removeAttachment = (index: number) => {
        setAttachments(prev => prev.filter((_, i) => i !== index));
    };

    const handleStop = () => {
        window.devmindAPI.chat.stop();
        setStreaming(false);
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        setInput(e.target.value);
        e.target.style.height = '36px';
        e.target.style.height = Math.min(e.target.scrollHeight, 160) + 'px';
    };

    const handleCopy = (content: string, id: string) => {
        navigator.clipboard.writeText(content);
        setCopiedId(id);
        setTimeout(() => setCopiedId(null), 1500);
    };

    const modeConfig = {
        fast: { icon: <Zap size={12} />, label: 'Fast', color: '#e5c07b', description: 'Instant answers' },
        plan: { icon: <Map size={12} />, label: 'Plan', color: '#61afef', description: 'Think step by step' },
    };

    const formatMessage = (content: string) => {
        if (content.startsWith('Switched to ')) {
            return <span style={{ color: '#888', fontStyle: 'italic', fontSize: '12px' }}>{content}</span>;
        }
        const parts = content.split(/(\[THOUGHT\][\s\S]*?\[\/THOUGHT\]|```[\s\S]*?```)/g);
        return parts.map((part, i) => {
            if (part.startsWith('[THOUGHT]')) {
                const thought = part.replace('[THOUGHT]', '').replace('[/THOUGHT]', '').trim();
                if (!thought) return null;
                return (
                    <div key={i} style={{
                        background: '#252526',
                        borderLeft: '2px solid #007acc',
                        padding: '8px 12px',
                        margin: '8px 0',
                        fontSize: '12px',
                        color: '#888',
                        fontStyle: 'italic',
                        borderRadius: '0 4px 4px 0',
                        lineHeight: '1.4'
                    }}>
                        <div style={{ fontSize: '10px', color: '#007acc', fontWeight: 600, marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Reasoning</div>
                        {thought}
                    </div>
                );
            }
            if (part.startsWith('```')) {
                const lines = part.split('\n');
                const lang = lines[0].replace('```', '').trim();
                const code = lines.slice(1, -1).join('\n');
                return (
                    <pre key={i} style={{ background: '#1a1a1a', borderRadius: '6px', padding: '10px 12px', margin: '6px 0', fontSize: '12px', overflowX: 'auto', border: '1px solid #333', lineHeight: '1.5', fontFamily: '"Cascadia Code", "Fira Code", monospace' }}>
                        {lang && <div style={{ color: '#888', fontSize: '10px', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '1px' }}>{lang}</div>}
                        <code style={{ color: '#abb2bf' }}>{code}</code>
                    </pre>
                );
            }
            return (
                <span key={i} style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                    {part.split(/(`[^`]+`|\*\*[^*]+\*\*)/g).map((seg, j) => {
                        if (seg.startsWith('`') && seg.endsWith('`')) {
                            return <code key={j} style={{ background: '#2d2d2d', padding: '1px 5px', borderRadius: '3px', fontSize: '12px', fontFamily: 'monospace', color: '#abb2bf' }}>{seg.slice(1, -1)}</code>;
                        }
                        if (seg.startsWith('**') && seg.endsWith('**')) {
                            return <strong key={j}>{seg.slice(2, -2)}</strong>;
                        }
                        return seg;
                    })}
                </span>
            );
        });
    };

    return (
        <div style={{ width: `${width}px`, backgroundColor: '#121212', color: '#ccc', display: 'flex', flexDirection: 'column', flexShrink: 0, position: 'relative', borderLeft: '1px solid #1a1a1a' }}>

            {/* Settings Overlay */}
            {showSettings && (
                <div style={{ position: 'absolute', inset: 0, background: '#1e1e1e', zIndex: 20, display: 'flex', flexDirection: 'column', padding: '16px', gap: '12px', overflowY: 'auto' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontWeight: 600, fontSize: '14px', color: '#e0e0e0' }}>AI Provider Settings</span>
                        <button onClick={() => setShowSettings(false)} style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer' }}><X size={16} /></button>
                    </div>

                    {/* Provider */}
                    <div>
                        <label style={{ fontSize: '11px', color: '#888', textTransform: 'uppercase', letterSpacing: '1px' }}>Provider</label>
                        <div style={{ marginTop: '6px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            {Object.entries(PROVIDERS).map(([key, p]) => (
                                <button
                                    key={key}
                                    onClick={() => handleProviderChange(key)}
                                    style={{ textAlign: 'left', padding: '8px 12px', background: provider === key ? '#0e639c22' : '#2d2d2d', border: `1px solid ${provider === key ? '#0e639c' : '#3d3d3d'}`, borderRadius: '6px', color: '#d4d4d4', cursor: 'pointer', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px' }}
                                >
                                    {provider === key && <Check size={12} color="#0e639c" />}
                                    {p.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* API Key */}
                    {PROVIDERS[provider].needsKey && (
                        <div>
                            <label style={{ fontSize: '11px', color: '#888', textTransform: 'uppercase', letterSpacing: '1px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <Key size={11} /> API Key
                            </label>
                            <div style={{ marginTop: '6px', position: 'relative' }}>
                                <input
                                    type={showApiKey ? 'text' : 'password'}
                                    value={apiKey}
                                    onChange={e => setApiKey(e.target.value)}
                                    placeholder={PROVIDERS[provider].keyPlaceholder}
                                    style={{ width: '100%', background: '#2d2d2d', border: '1px solid #3d3d3d', borderRadius: '6px', color: '#d4d4d4', padding: '8px 36px 8px 10px', fontSize: '12px', outline: 'none', boxSizing: 'border-box' }}
                                />
                                <button onClick={() => setShowApiKey(!showApiKey)} style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#888', cursor: 'pointer', fontSize: '11px' }}>
                                    {showApiKey ? 'hide' : 'show'}
                                </button>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '6px' }}>
                                <p style={{ fontSize: '11px', color: '#555' }}>Stored locally and never sent to our servers.</p>
                                <button
                                    onClick={handleSaveApiKey}
                                    style={{
                                        background: saveStatus === 'saved' ? '#2ea043' : '#2d2d2d',
                                        color: saveStatus === 'saved' ? 'white' : '#d4d4d4',
                                        border: `1px solid ${saveStatus === 'saved' ? '#2ea043' : '#3d3d3d'}`,
                                        borderRadius: '4px',
                                        padding: '4px 8px',
                                        cursor: 'pointer',
                                        fontSize: '11px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '4px',
                                        transition: 'all 0.2s'
                                    }}
                                >
                                    {saveStatus === 'saved' ? <Check size={12} /> : <Key size={12} />}
                                    {saveStatus === 'saving' ? 'Saving...' : saveStatus === 'saved' ? 'Saved' : 'Save Key'}
                                </button>
                            </div>
                        </div>
                    )}

                    <button
                        onClick={handleFetchModels}
                        disabled={isFetchingModels || (PROVIDERS[provider].needsKey && !apiKey.trim())}
                        style={{ background: '#2d2d2d', color: '#d4d4d4', border: '1px solid #3d3d3d', borderRadius: '6px', padding: '6px 10px', cursor: 'pointer', fontSize: '12px', marginTop: '2px' }}
                    >
                        {isFetchingModels ? 'Fetching...' : 'Fetch Available Models'}
                    </button>

                    {/* Model */}
                    <div>
                        <label style={{ fontSize: '11px', color: '#888', textTransform: 'uppercase', letterSpacing: '1px' }}>Model</label>
                        <select
                            value={model}
                            onChange={e => setModel(e.target.value)}
                            style={{ marginTop: '6px', width: '100%', background: '#2d2d2d', border: '1px solid #3d3d3d', borderRadius: '6px', color: '#d4d4d4', padding: '8px 10px', fontSize: '13px', outline: 'none' }}
                        >
                            {(fetchedModels.length > 0 ? fetchedModels : PROVIDERS[provider].models).map(m => <option key={m} value={m}>{m}</option>)}
                        </select>
                    </div>

                    <button
                        onClick={handleApplyConfig}
                        style={{ background: '#0e639c', color: 'white', border: 'none', borderRadius: '6px', padding: '10px', cursor: 'pointer', fontSize: '13px', fontWeight: 600, marginTop: '4px' }}
                    >
                        Apply & Connect
                    </button>
                </div>
            )}

            {/* Header */}
            <div style={{ padding: '9px 12px', borderBottom: '1px solid #2a2a2a', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '13px', fontWeight: 600, color: '#e0e0e0' }}>Cycy</span>

                    {/* Mode Picker */}
                    <div style={{ position: 'relative' }}>
                        <button
                            onClick={() => setShowModeMenu(!showModeMenu)}
                            style={{ display: 'flex', alignItems: 'center', gap: '4px', background: '#2d2d2d', border: '1px solid #3d3d3d', borderRadius: '12px', padding: '3px 9px', cursor: 'pointer', color: modeConfig[mode].color, fontSize: '11px' }}
                        >
                            {modeConfig[mode].icon} {modeConfig[mode].label}
                            <ChevronDown size={10} />
                        </button>
                        {showModeMenu && (
                            <div style={{ position: 'absolute', top: '110%', left: 0, background: '#252526', border: '1px solid #3d3d3d', borderRadius: '8px', boxShadow: '0 8px 24px rgba(0,0,0,0.4)', zIndex: 100, minWidth: '160px', overflow: 'hidden' }}>
                                {(Object.keys(modeConfig) as Mode[]).map(m => (
                                    <button key={m} onClick={() => { setMode(m); setShowModeMenu(false); }}
                                        style={{ display: 'flex', flexDirection: 'column', width: '100%', textAlign: 'left', padding: '9px 12px', background: mode === m ? '#2a2d2e' : 'transparent', border: 'none', color: modeConfig[m].color, cursor: 'pointer' }}
                                    >
                                        <span style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px', fontWeight: 600 }}>{modeConfig[m].icon} {modeConfig[m].label}</span>
                                        <span style={{ fontSize: '11px', color: '#888' }}>{modeConfig[m].description}</span>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Provider badge */}
                    <button
                        onClick={() => setShowSettings(true)}
                        title="Switch provider / model"
                        style={{ display: 'flex', alignItems: 'center', gap: '4px', background: configured ? '#1d3a1d' : '#2a2222', border: `1px solid ${configured ? '#2d6a2d' : '#5a3333'}`, borderRadius: '12px', padding: '3px 8px', cursor: 'pointer', color: configured ? '#89d185' : '#f44747', fontSize: '11px' }}
                    >
                        <Settings size={11} />
                        {configured ? PROVIDERS[provider].label.split(' ').slice(1).join(' ') : 'Setup'}
                    </button>
                </div>

                <button onClick={() => clearHistory()} title="Clear chat"
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#555', display: 'flex', borderRadius: '4px', padding: '3px' }}
                    onMouseEnter={e => (e.currentTarget.style.color = '#f44747')}
                    onMouseLeave={e => (e.currentTarget.style.color = '#555')}
                >
                    <Trash2 size={14} />
                </button>
            </div>

            {/* Messages */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '12px', display: 'flex', flexDirection: 'column', gap: '12px' }}
                onClick={() => { setShowModeMenu(false); }}>
                {messages.length === 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#555', gap: '10px', textAlign: 'center' }}>
                        <Zap size={30} color="#444" />
                        <div style={{ fontSize: '14px', color: '#888' }}>Ask Cycy anything</div>
                        {!configured && <div onClick={() => setShowSettings(true)} style={{ fontSize: '12px', color: '#0e639c', cursor: 'pointer', textDecoration: 'underline' }}>Configure AI provider first →</div>}
                    </div>
                )}
                {messages.map(m => (
                    <div key={m.id} style={{ display: 'flex', flexDirection: 'column', alignItems: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
                        {m.role === 'system' ? (
                            <div style={{ alignSelf: 'center', marginTop: '4px', marginBottom: '4px' }}>
                                {formatMessage(m.content)}
                            </div>
                        ) : m.role === 'user' ? (
                            <div style={{
                                background: 'linear-gradient(135deg, #0e639c 0%, #007acc 100%)',
                                color: '#fff',
                                padding: '10px 14px',
                                borderRadius: '16px 16px 4px 16px',
                                maxWidth: '85%',
                                fontSize: '13px',
                                lineHeight: '1.5',
                                wordBreak: 'break-word',
                                boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
                                marginBottom: '4px'
                            }}>
                                {m.attachments && m.attachments.length > 0 && (
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '8px' }}>
                                        {m.attachments.map((att, idx) => (
                                            <div key={idx} style={{ position: 'relative' }}>
                                                {att.type.startsWith('image/') ? (
                                                    <img src={`data:${att.type};base64,${att.base64}`} alt={att.name} style={{ maxWidth: '200px', maxHeight: '150px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.2)' }} />
                                                ) : (
                                                    <div style={{ background: 'rgba(0,0,0,0.2)', padding: '6px 10px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                        <FileText size={14} />
                                                        <span style={{ fontSize: '11px' }}>{att.name}</span>
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}
                                {m.content}
                            </div>
                        ) : (
                            <div style={{ maxWidth: '100%', fontSize: '13px', lineHeight: '1.6', color: '#d4d4d4' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                                    <span style={{ fontSize: '11px', color: '#555', fontWeight: 600 }}>CYCY</span>
                                    <button onClick={() => handleCopy(m.content, m.id)}
                                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#555', padding: '1px 4px', borderRadius: '4px', fontSize: '10px', display: 'flex', alignItems: 'center' }}
                                        onMouseEnter={e => (e.currentTarget.style.color = '#aaa')}
                                        onMouseLeave={e => (e.currentTarget.style.color = '#555')}
                                    >
                                        <Copy size={11} />
                                        {copiedId === m.id && <span style={{ marginLeft: '3px' }}>Copied!</span>}
                                    </button>
                                </div>
                                {m.content.toLowerCase().includes("run this command? (y/n):") ? (
                                    <div>
                                        <div>{formatMessage(m.content.replace("Run this command? (y/n):", ""))}</div>
                                        {!answeredPrompts.has(m.id) ? (
                                            <div style={{ display: 'flex', gap: '8px', marginTop: '10px', padding: '8px', background: '#252526', borderRadius: '6px', border: '1px solid #333' }}>
                                                <span style={{ fontSize: '12px', color: '#ccc', alignSelf: 'center' }}>Run this command?</span>
                                                <button
                                                    onClick={() => {
                                                        window.devmindAPI.chat.send('y');
                                                        setAnsweredPrompts(prev => new Set(prev).add(m.id));
                                                        useChatStore.getState().setStreaming(true);
                                                    }}
                                                    style={{ background: '#2ea043', color: 'white', border: 'none', borderRadius: '4px', padding: '4px 12px', cursor: 'pointer', fontSize: '12px', fontWeight: 600 }}
                                                >
                                                    Yes
                                                </button>
                                                <button
                                                    onClick={() => {
                                                        window.devmindAPI.chat.send('n');
                                                        setAnsweredPrompts(prev => new Set(prev).add(m.id));
                                                    }}
                                                    style={{ background: '#da3633', color: 'white', border: 'none', borderRadius: '4px', padding: '4px 12px', cursor: 'pointer', fontSize: '12px', fontWeight: 600 }}
                                                >
                                                    No
                                                </button>
                                            </div>
                                        ) : (
                                            <div style={{ marginTop: '8px', fontSize: '11px', color: '#666', fontStyle: 'italic' }}>
                                                Command prompt resolved.
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <div>{formatMessage(m.content)}</div>
                                )}
                            </div>
                        )}
                    </div>
                ))}
                {isStreaming && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#888', fontSize: '12px' }}>
                        <div style={{ display: 'flex', gap: '4px' }}>
                            {[0, 1, 2].map(i => <div key={i} style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#555', animation: `pulse 1.2s ${i * 0.2}s ease-in-out infinite` }} />)}
                        </div>
                        Thinking...
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div style={{ borderTop: '1px solid #2a2a2a', padding: '10px', flexShrink: 0 }}>
                {attachments.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '10px', paddingBottom: '10px', borderBottom: '1px solid #333' }}>
                        {attachments.map((att, i) => (
                            <div key={i} style={{ position: 'relative', background: '#2d2d2d', borderRadius: '6px', padding: '4px', border: '1px solid #444' }}>
                                {att.type.startsWith('image/') ? (
                                    <img src={`data:${att.type};base64,${att.base64}`} style={{ width: '50px', height: '50px', objectFit: 'cover', borderRadius: '4px' }} alt="preview" />
                                ) : (
                                    <div style={{ width: '50px', height: '50px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><FileText size={20} /></div>
                                )}
                                <button onClick={() => removeAttachment(i)} style={{ position: 'absolute', top: '-6px', right: '-6px', background: '#e81123', color: 'white', border: 'none', borderRadius: '50%', width: '16px', height: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: '10px' }}>
                                    <X size={10} />
                                </button>
                            </div>
                        ))}
                    </div>
                )}
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: '8px', background: '#2d2d2d', borderRadius: '10px', border: '1px solid #3d3d3d', padding: '6px 8px' }}>
                    <button onClick={handleAttach} title="Attach file"
                        style={{ background: 'none', border: 'none', padding: '6px', cursor: 'pointer', color: '#888', display: 'flex', flexShrink: 0 }}
                        onMouseEnter={e => e.currentTarget.style.color = '#ccc'}
                        onMouseLeave={e => e.currentTarget.style.color = '#888'}
                    >
                        <Paperclip size={18} />
                    </button>
                    <textarea
                        ref={textareaRef}
                        value={input}
                        onChange={handleTextareaChange}
                        onKeyDown={handleKeyDown}
                        placeholder={configured ? `Ask Cycy… (${modeConfig[mode].label})` : 'Configure a provider first →'}
                        rows={1}
                        style={{ flex: 1, background: 'transparent', border: 'none', color: '#d4d4d4', resize: 'none', outline: 'none', fontSize: '13px', lineHeight: '1.5', height: '36px', minHeight: '36px', maxHeight: '160px', fontFamily: 'inherit' }}
                    />
                    {isStreaming ? (
                        <button onClick={handleStop} title="Stop generation"
                            style={{ background: '#c0392b', border: 'none', borderRadius: '6px', padding: '6px', cursor: 'pointer', color: 'white', display: 'flex', flexShrink: 0 }}
                        >
                            <Square size={14} fill="white" />
                        </button>
                    ) : (
                        <button onClick={() => handleSend()} disabled={!input.trim()}
                            style={{ background: input.trim() ? '#0e639c' : '#2a2a2a', border: 'none', borderRadius: '6px', padding: '6px', cursor: input.trim() ? 'pointer' : 'default', color: input.trim() ? 'white' : '#555', display: 'flex', flexShrink: 0, transition: 'background 0.15s' }}
                        >
                            <Send size={14} />
                        </button>
                    )}
                </div>
                <div style={{ marginTop: '4px', fontSize: '11px', color: '#444', textAlign: 'right' }}>Enter to send · Shift+Enter for new line</div>
            </div>

            <style>{`
                @keyframes pulse {
                    0%,80%,100%{opacity:.3;transform:scale(.8)}
                    40%{opacity:1;transform:scale(1.1)}
                }
            `}</style>
        </div>
    );
};

export default ChatPane;
