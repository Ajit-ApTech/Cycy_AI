import React from 'react';
import Editor from '@monaco-editor/react';
import { useEditorStore } from '../store/editorStore';

const EditorPane: React.FC = () => {
    const { activeFile, fileContents, updateFileContent } = useEditorStore();

    const handleEditorChange = (value: string | undefined) => {
        if (activeFile && value !== undefined) {
            updateFileContent(activeFile, value);
        }
    };

    return (
        <div style={{ flex: 1, backgroundColor: '#1e1e1e', borderRight: '1px solid #333' }}>
            {activeFile ? (
                <Editor
                    height="100%"
                    theme="vs-dark"
                    path={activeFile}
                    value={fileContents[activeFile] || ''}
                    onChange={handleEditorChange}
                    options={{
                        minimap: { enabled: false },
                        fontSize: 14,
                        wordWrap: 'on'
                    }}
                />
            ) : (
                <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#666' }}>
                    Select a file to edit
                </div>
            )}
        </div>
    );
};

export default EditorPane;
