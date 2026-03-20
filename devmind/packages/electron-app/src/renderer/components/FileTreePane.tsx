import React, { useState, useCallback } from 'react';
import { Folder, FolderOpen, FileText, FolderPlus, ChevronRight, ChevronDown } from 'lucide-react';
import { useEditorStore } from '../store/editorStore';

interface FileNode {
    name: string;
    path: string;
    isDirectory: boolean;
    children?: FileNode[];
    loaded?: boolean;
}

const FileTreeNode: React.FC<{
    node: FileNode;
    level?: number;
    onFileClick: (node: FileNode) => void;
    onExpandDir: (node: FileNode) => Promise<FileNode[]>;
}> = ({ node, level = 0, onFileClick, onExpandDir }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [children, setChildren] = useState<FileNode[]>(node.children || []);
    const [loading, setLoading] = useState(false);

    const handleClick = async () => {
        if (node.isDirectory) {
            if (!isOpen && children.length === 0) {
                setLoading(true);
                const kids = await onExpandDir(node);
                setChildren(kids);
                setLoading(false);
            }
            setIsOpen(!isOpen);
        } else {
            onFileClick(node);
        }
    };

    const getFileColor = (name: string) => {
        if (name.endsWith('.ts') || name.endsWith('.tsx')) return '#519aba';
        if (name.endsWith('.js') || name.endsWith('.jsx')) return '#cbcb41';
        if (name.endsWith('.py')) return '#3572a5';
        if (name.endsWith('.json')) return '#cbcb41';
        if (name.endsWith('.md')) return '#6ad9fb';
        if (name.endsWith('.css') || name.endsWith('.scss')) return '#f55385';
        if (name.endsWith('.html')) return '#e44d26';
        if (name.endsWith('.sh')) return '#89e051';
        return '#cccccc';
    };

    return (
        <div style={{ userSelect: 'none' }}>
            <div
                onClick={handleClick}
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    cursor: 'pointer',
                    padding: '2px 8px 2px ' + (8 + level * 12) + 'px',
                    color: node.isDirectory ? '#c5c5c5' : getFileColor(node.name),
                    fontSize: '13px',
                    lineHeight: '22px',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                }}
                onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#2a2d2e')}
                onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
            >
                <span style={{ marginRight: '4px', color: '#c5c5c5', flexShrink: 0 }}>
                    {node.isDirectory
                        ? isOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />
                        : <span style={{ width: '12px', display: 'inline-block' }} />}
                </span>
                {node.isDirectory ? (
                    isOpen
                        ? <FolderOpen size={14} style={{ marginRight: '6px', color: '#dcb67a', flexShrink: 0 }} />
                        : <Folder size={14} style={{ marginRight: '6px', color: '#dcb67a', flexShrink: 0 }} />
                ) : (
                    <FileText size={14} style={{ marginRight: '6px', color: getFileColor(node.name), flexShrink: 0 }} />
                )}
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {loading ? `${node.name} …` : node.name}
                </span>
            </div>
            {node.isDirectory && isOpen && (
                <div>
                    {children.map(child => (
                        <FileTreeNode
                            key={child.path}
                            node={child}
                            level={level + 1}
                            onFileClick={onFileClick}
                            onExpandDir={onExpandDir}
                        />
                    ))}
                    {children.length === 0 && !loading && (
                        <div style={{ paddingLeft: (8 + (level + 1) * 12) + 'px', color: '#888', fontSize: '12px', fontStyle: 'italic' }}>
                            (empty)
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

const FileTreePane: React.FC<{ width?: number }> = ({ width = 250 }) => {
    const [rootPath, setRootPath] = useState<string | null>(null);
    const [rootChildren, setRootChildren] = useState<FileNode[]>([]);
    const [rootName, setRootName] = useState('');
    const { openFile } = useEditorStore();

    const handleOpenFolder = async () => {
        const folderPath = await window.devmindAPI.folder.openPicker();
        if (!folderPath) return;
        setRootPath(folderPath);
        setRootName(folderPath.split('/').pop() || folderPath);

        // Notify Python Backend and UI Terminal
        window.devmindAPI.chat.setCwd(folderPath);

        const children = await window.devmindAPI.folder.readDir(folderPath);
        const sorted = children.sort((a, b) => {
            if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1;
            return a.name.localeCompare(b.name);
        });
        setRootChildren(sorted.map(c => ({ ...c, children: [] })));
    };

    const handleExpandDir = useCallback(async (node: FileNode): Promise<FileNode[]> => {
        const entries = await window.devmindAPI.folder.readDir(node.path);
        const sorted = entries.sort((a, b) => {
            if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1;
            return a.name.localeCompare(b.name);
        });
        return sorted.map(c => ({ ...c, children: [] }));
    }, []);

    const handleFileClick = async (node: FileNode) => {
        const content = await window.devmindAPI.folder.readFile(node.path);
        openFile(node.path, content);
    };

    const rootNode: FileNode = {
        name: rootName,
        path: rootPath || '',
        isDirectory: true,
        children: rootChildren
    };

    return (
        <div style={{ width: `${width}px`, backgroundColor: '#121212', color: '#ccc', display: 'flex', flexDirection: 'column', flexShrink: 0, borderRight: '1px solid #1e1e1e' }}>
            {/* Header */}
            <div style={{ padding: '12px 16px', fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '1.5px', color: '#777', borderBottom: '1px solid #1e1e1e', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>Explorer</span>
                <button
                    onClick={handleOpenFolder}
                    title="Open Folder"
                    style={{ background: 'rgba(255,255,255,0.05)', border: 'none', cursor: 'pointer', color: '#bbb', padding: '4px', borderRadius: '4px', display: 'flex', alignItems: 'center', transition: 'all 0.2s' }}
                    onMouseEnter={e => {
                        e.currentTarget.style.color = '#fff';
                        e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.1)';
                    }}
                    onMouseLeave={e => {
                        e.currentTarget.style.color = '#bbb';
                        e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.05)';
                    }}
                >
                    <FolderPlus size={14} />
                </button>
            </div>

            {/* Content */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
                {!rootPath ? (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#555', fontSize: '13px', padding: '20px', textAlign: 'center', gap: '16px' }}>
                        <div style={{ background: '#1e1e1e', padding: '20px', borderRadius: '50%' }}>
                            <Folder size={32} color="#444" />
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <span style={{ color: '#888', fontWeight: 500 }}>Empty Workspace</span>
                            <span style={{ fontSize: '11px', color: '#555' }}>Select a folder to start coding</span>
                        </div>
                        <button
                            onClick={handleOpenFolder}
                            style={{
                                background: '#0e639c',
                                color: 'white',
                                border: 'none',
                                borderRadius: '6px',
                                padding: '8px 16px',
                                cursor: 'pointer',
                                fontSize: '12px',
                                fontWeight: 500,
                                transition: 'background 0.2s'
                            }}
                            onMouseEnter={e => e.currentTarget.style.background = '#1177bb'}
                            onMouseLeave={e => e.currentTarget.style.background = '#0e639c'}
                        >
                            Open Folder
                        </button>
                    </div>
                ) : (
                    <FileTreeNode
                        node={{ ...rootNode, children: rootChildren }}
                        onFileClick={handleFileClick}
                        onExpandDir={handleExpandDir}
                    />
                )}
            </div>
        </div>
    );
};

export default FileTreePane;
