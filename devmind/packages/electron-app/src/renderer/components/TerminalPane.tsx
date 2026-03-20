import React, { useEffect, useRef } from 'react';
import { Terminal as TerminalIcon } from 'lucide-react';
import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import 'xterm/css/xterm.css';

const TerminalPane: React.FC<{ height?: number }> = ({ height = 220 }) => {
    const terminalRef = useRef<HTMLDivElement>(null);
    const termInstance = useRef<Terminal | null>(null);
    const fitAddonRef = useRef<FitAddon | null>(null);
    const resizeTimeoutRef = useRef<any>(null);

    useEffect(() => {
        if (!terminalRef.current) return;

        const term = new Terminal({
            theme: {
                background: '#0a0a0a',
                foreground: '#d4d4d4',
                cursor: '#aeafad',
                selectionBackground: '#264f78',
                black: '#1e1e1e',
                red: '#f44747',
                green: '#6a9955',
                yellow: '#dcdcaa',
                blue: '#569cd6',
                magenta: '#c586c0',
                cyan: '#4ec9b0',
                white: '#d4d4d4',
            },
            fontFamily: '"Cascadia Code", "Fira Code", Menlo, Monaco, "Courier New", monospace',
            fontSize: 12,
            lineHeight: 1.4,
            cursorBlink: true,
            allowTransparency: true,
        });

        const fitAddon = new FitAddon();
        term.loadAddon(fitAddon);
        term.open(terminalRef.current);

        // Initial fit
        requestAnimationFrame(() => {
            try {
                fitAddon.fit();
            } catch (e) {
                console.warn('[TerminalPane] Initial fit failed:', e);
            }
        });

        termInstance.current = term;
        fitAddonRef.current = fitAddon;

        // Wire input from xterm -> main process (node-pty)
        term.onData(data => {
            (window as any).devmindAPI.terminal.sendInput(data);
        });

        // Wire output from main process (node-pty) -> xterm
        (window as any).devmindAPI.terminal.onOutput((data: string) => {
            term.write(data);
        });

        // Handle resize with debouncing and safety guards
        const handleResize = () => {
            if (resizeTimeoutRef.current) {
                clearTimeout(resizeTimeoutRef.current);
            }

            resizeTimeoutRef.current = setTimeout(() => {
                if (!terminalRef.current || !fitAddonRef.current || !termInstance.current) return;

                // Only fit if the element is visible and has dimensions
                if (terminalRef.current.offsetWidth > 0 && terminalRef.current.offsetHeight > 0) {
                    try {
                        fitAddonRef.current.fit();
                        (window as any).devmindAPI.terminal.resize(termInstance.current.cols, termInstance.current.rows);
                    } catch (err) {
                        console.warn('[TerminalPane] Failed to fit terminal during resize:', err);
                    }
                }
            }, 100);
        };

        const resizeObserver = new ResizeObserver(handleResize);
        resizeObserver.observe(terminalRef.current);
        window.addEventListener('resize', handleResize);

        return () => {
            if (resizeTimeoutRef.current) {
                clearTimeout(resizeTimeoutRef.current);
            }
            window.removeEventListener('resize', handleResize);
            resizeObserver.disconnect();
            (window as any).devmindAPI.terminal.removeListeners();
            if (termInstance.current) {
                termInstance.current.dispose();
                termInstance.current = null;
            }
        };
    }, []);

    return (
        <div style={{ height: `${height}px`, backgroundColor: '#0a0a0a', borderTop: '1px solid #1e1e1e', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            <div style={{ padding: '8px 16px', fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', color: '#555', letterSpacing: '2px', borderBottom: '1px solid #1a1a1a', flexShrink: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <TerminalIcon size={12} />
                Terminal
            </div>
            <div ref={terminalRef} style={{ flex: 1, overflow: 'hidden', padding: '8px' }} />
        </div>
    );
};

export default TerminalPane;
