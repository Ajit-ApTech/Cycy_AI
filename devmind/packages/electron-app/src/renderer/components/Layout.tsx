import React, { useState, useCallback, useEffect, useRef } from 'react';
import FileTreePane from './FileTreePane';
import EditorPane from './EditorPane';
import ChatPane from './ChatPane';
import TerminalPane from './TerminalPane';
import ApprovalGate from './ApprovalGate';

const Layout: React.FC = () => {
    const [fileTreeWidth, setFileTreeWidth] = useState(250);
    const [chatWidth, setChatWidth] = useState(360);
    const [terminalHeight, setTerminalHeight] = useState(220);
    const [isResizingFileTree, setIsResizingFileTree] = useState(false);
    const [isResizingChat, setIsResizingChat] = useState(false);
    const [isResizingTerminal, setIsResizingTerminal] = useState(false);

    const layoutRef = useRef<HTMLDivElement>(null);

    const handleMouseMove = useCallback((e: MouseEvent) => {
        if (isResizingFileTree) {
            setFileTreeWidth(Math.max(150, Math.min(e.clientX, 600)));
        } else if (isResizingChat) {
            if (layoutRef.current) {
                const rightEdge = layoutRef.current.getBoundingClientRect().right;
                setChatWidth(Math.max(250, Math.min(rightEdge - e.clientX, 600)));
            }
        } else if (isResizingTerminal) {
            if (layoutRef.current) {
                const bottomEdge = layoutRef.current.getBoundingClientRect().bottom;
                setTerminalHeight(Math.max(100, Math.min(bottomEdge - e.clientY, 500)));
            }
        }
    }, [isResizingFileTree, isResizingChat, isResizingTerminal]);

    const handleMouseUp = useCallback(() => {
        setIsResizingFileTree(false);
        setIsResizingChat(false);
        setIsResizingTerminal(false);
    }, []);

    useEffect(() => {
        if (isResizingFileTree || isResizingChat || isResizingTerminal) {
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
            document.body.style.cursor = isResizingTerminal ? 'row-resize' : 'col-resize';
        } else {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
            document.body.style.cursor = 'default';
        }
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isResizingFileTree, isResizingChat, isResizingTerminal, handleMouseMove, handleMouseUp]);

    return (
        <div ref={layoutRef} style={{ display: 'flex', height: '100%', flexDirection: 'column', backgroundColor: '#1e1e1e', overflow: 'hidden' }}>
            <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
                <FileTreePane width={fileTreeWidth} />

                {/* Resizer */}
                <div
                    onMouseDown={() => setIsResizingFileTree(true)}
                    style={{
                        width: '4px',
                        cursor: 'col-resize',
                        backgroundColor: isResizingFileTree ? '#007acc' : 'transparent',
                        transition: 'background-color 0.2s',
                        zIndex: 10,
                        borderRight: '1px solid #2a2a2a'
                    }}
                />

                <div style={{ flex: 1, position: 'relative', display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                    <EditorPane />
                </div>

                {/* Resizer */}
                <div
                    onMouseDown={() => setIsResizingChat(true)}
                    style={{
                        width: '4px',
                        cursor: 'col-resize',
                        backgroundColor: isResizingChat ? '#007acc' : 'transparent',
                        transition: 'background-color 0.2s',
                        zIndex: 10,
                        borderLeft: '1px solid #2a2a2a'
                    }}
                />

                <ChatPane width={chatWidth} />
            </div>

            {/* Resizer */}
            <div
                onMouseDown={() => setIsResizingTerminal(true)}
                style={{
                    height: '4px',
                    cursor: 'row-resize',
                    backgroundColor: isResizingTerminal ? '#007acc' : 'transparent',
                    transition: 'background-color 0.2s',
                    zIndex: 10,
                    borderTop: '1px solid #2a2a2a'
                }}
            />

            <TerminalPane height={terminalHeight} />
            <ApprovalGate />
        </div>
    );
};

export default Layout;
