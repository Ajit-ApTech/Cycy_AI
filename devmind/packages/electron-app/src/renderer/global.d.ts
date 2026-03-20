export { };

declare global {
    interface Window {
        devmindAPI: {
            chat: {
                send: (message: string | any) => void;
                stop: () => void;
                setConfig: (provider: string, model: string, apiKey: string) => void;
                setCwd: (cwd: string) => void;
                selectFile: () => Promise<any>;
                onToken: (callback: (token: string) => void) => void;
                onError: (callback: (error: string) => void) => void;
                removeListeners: () => void;
                fetchModels: (provider: string, apiKey: string) => Promise<string[]>;
            };
            terminal: {
                sendInput: (data: string) => void;
                resize: (cols: number, rows: number) => void;
                setCwd: (cwd: string) => void;
                onOutput: (callback: (data: string) => void) => void;
                removeListeners: () => void;
            };
            folder: {
                openPicker: () => Promise<string | null>;
                readDir: (dirPath: string) => Promise<Array<{ name: string; path: string; isDirectory: boolean }>>;
                readFile: (filePath: string) => Promise<string>;
            };
            agent: {
                onCommandRequest: (callback: (data: any) => void) => void;
                approveCommand: (id: string) => Promise<void>;
                cancelCommand: (id: string) => Promise<void>;
            };
            database: {
                saveMessage: (msg: any) => void;
                getMessages: (sessionId?: string) => Promise<any[]>;
                saveSetting: (key: string, value: string) => void;
                getSetting: (key: string) => Promise<string | null>;
            };
        };
    }
}
