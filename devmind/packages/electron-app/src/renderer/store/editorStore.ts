import { create } from 'zustand';

interface EditorStore {
    openFiles: string[];
    activeFile: string | null;
    fileContents: Record<string, string>;
    openFile: (path: string, content: string) => void;
    closeFile: (path: string) => void;
    setActiveFile: (path: string) => void;
    updateFileContent: (path: string, content: string) => void;
}

export const useEditorStore = create<EditorStore>((set) => ({
    openFiles: [],
    activeFile: null,
    fileContents: {},
    openFile: (path, content) => set((state) => {
        if (!state.openFiles.includes(path)) {
            return {
                openFiles: [...state.openFiles, path],
                activeFile: path,
                fileContents: { ...state.fileContents, [path]: content }
            };
        }
        return { activeFile: path };
    }),
    closeFile: (path) => set((state) => {
        const newOpenFiles = state.openFiles.filter(p => p !== path);
        return {
            openFiles: newOpenFiles,
            activeFile: state.activeFile === path ? (newOpenFiles[newOpenFiles.length - 1] || null) : state.activeFile
        };
    }),
    setActiveFile: (path) => set({ activeFile: path }),
    updateFileContent: (path, content) => set((state) => ({
        fileContents: { ...state.fileContents, [path]: content }
    }))
}));
