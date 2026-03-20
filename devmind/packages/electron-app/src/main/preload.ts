import { contextBridge, ipcRenderer } from 'electron';
import { IPCWhitelist } from './security/IPCWhitelist';
import { IPC_CHANNELS } from '@devmind/shared';

contextBridge.exposeInMainWorld('devmindAPI', {
    chat: {
        send: (message: string) => {
            IPCWhitelist.validate(IPC_CHANNELS.CHAT.SEND);
            ipcRenderer.send(IPC_CHANNELS.CHAT.SEND, message);
        },
        stop: () => {
            IPCWhitelist.validate(IPC_CHANNELS.CHAT.STOP);
            ipcRenderer.send(IPC_CHANNELS.CHAT.STOP);
        },
        setConfig: (provider: string, model: string, apiKey: string) => {
            IPCWhitelist.validate(IPC_CHANNELS.CHAT.SET_CONFIG);
            ipcRenderer.send(IPC_CHANNELS.CHAT.SET_CONFIG, { provider, model, apiKey });
        },
        setCwd: (cwd: string) => {
            IPCWhitelist.validate(IPC_CHANNELS.CHAT.SET_CWD);
            ipcRenderer.send(IPC_CHANNELS.CHAT.SET_CWD, cwd);
        },
        selectFile: (): Promise<any> => {
            IPCWhitelist.validate(IPC_CHANNELS.CHAT.SELECT_FILE);
            return ipcRenderer.invoke(IPC_CHANNELS.CHAT.SELECT_FILE);
        },
        onToken: (callback: (token: string) => void) => {
            IPCWhitelist.validate(IPC_CHANNELS.CHAT.TOKEN);
            ipcRenderer.on(IPC_CHANNELS.CHAT.TOKEN, (_event, token: string) => callback(token));
        },
        onError: (callback: (error: string) => void) => {
            IPCWhitelist.validate(IPC_CHANNELS.CHAT.ERROR);
            ipcRenderer.on(IPC_CHANNELS.CHAT.ERROR, (_event, error: string) => callback(error));
        },
        removeListeners: () => {
            ipcRenderer.removeAllListeners(IPC_CHANNELS.CHAT.TOKEN);
            ipcRenderer.removeAllListeners(IPC_CHANNELS.CHAT.ERROR);
        },
        fetchModels: (provider: string, apiKey: string): Promise<string[]> => {
            IPCWhitelist.validate(IPC_CHANNELS.CHAT.FETCH_MODELS);
            return ipcRenderer.invoke(IPC_CHANNELS.CHAT.FETCH_MODELS, provider, apiKey);
        }
    },
    terminal: {
        sendInput: (data: string) => {
            IPCWhitelist.validate(IPC_CHANNELS.TERMINAL.INPUT);
            ipcRenderer.send(IPC_CHANNELS.TERMINAL.INPUT, data);
        },
        resize: (cols: number, rows: number) => {
            IPCWhitelist.validate(IPC_CHANNELS.TERMINAL.RESIZE);
            ipcRenderer.send(IPC_CHANNELS.TERMINAL.RESIZE, { cols, rows });
        },
        setCwd: (cwd: string) => {
            IPCWhitelist.validate(IPC_CHANNELS.TERMINAL.SET_CWD);
            ipcRenderer.send(IPC_CHANNELS.TERMINAL.SET_CWD, cwd);
        },
        onOutput: (callback: (data: string) => void) => {
            IPCWhitelist.validate(IPC_CHANNELS.TERMINAL.OUTPUT);
            ipcRenderer.on(IPC_CHANNELS.TERMINAL.OUTPUT, (_event, data: string) => callback(data));
        },
        removeListeners: () => {
            ipcRenderer.removeAllListeners(IPC_CHANNELS.TERMINAL.OUTPUT);
        }
    },
    folder: {
        openPicker: (): Promise<string | null> => {
            IPCWhitelist.validate(IPC_CHANNELS.FOLDER.OPEN_PICKER);
            return ipcRenderer.invoke(IPC_CHANNELS.FOLDER.OPEN_PICKER);
        },
        readDir: (dirPath: string): Promise<Array<{ name: string; path: string; isDirectory: boolean }>> => {
            IPCWhitelist.validate(IPC_CHANNELS.FOLDER.READ_DIR);
            return ipcRenderer.invoke(IPC_CHANNELS.FOLDER.READ_DIR, dirPath);
        },
        readFile: (filePath: string): Promise<string> => {
            IPCWhitelist.validate(IPC_CHANNELS.FOLDER.READ_FILE);
            return ipcRenderer.invoke(IPC_CHANNELS.FOLDER.READ_FILE, filePath);
        }
    },
    agent: {
        onCommandRequest: (callback: (data: any) => void) => {
            IPCWhitelist.validate(IPC_CHANNELS.AGENT.RUN);
            ipcRenderer.on(IPC_CHANNELS.AGENT.RUN, (_event, data) => callback(data));
        },
        approveCommand: (id: string) => {
            IPCWhitelist.validate(IPC_CHANNELS.AGENT.APPROVE);
            return ipcRenderer.invoke(IPC_CHANNELS.AGENT.APPROVE, id);
        },
        cancelCommand: (id: string) => {
            IPCWhitelist.validate(IPC_CHANNELS.AGENT.CANCEL);
            return ipcRenderer.invoke(IPC_CHANNELS.AGENT.CANCEL, id);
        }
    },
    database: {
        saveMessage: (msg: any) => {
            IPCWhitelist.validate(IPC_CHANNELS.DATABASE.SAVE_MESSAGE);
            ipcRenderer.send(IPC_CHANNELS.DATABASE.SAVE_MESSAGE, msg);
        },
        getMessages: (sessionId: string = 'default') => {
            IPCWhitelist.validate(IPC_CHANNELS.DATABASE.GET_MESSAGES);
            return ipcRenderer.invoke(IPC_CHANNELS.DATABASE.GET_MESSAGES, sessionId);
        },
        saveSetting: (key: string, value: string) => {
            IPCWhitelist.validate(IPC_CHANNELS.DATABASE.SAVE_SETTING);
            ipcRenderer.send(IPC_CHANNELS.DATABASE.SAVE_SETTING, { key, value });
        },
        getSetting: (key: string) => {
            IPCWhitelist.validate(IPC_CHANNELS.DATABASE.GET_SETTING);
            return ipcRenderer.invoke(IPC_CHANNELS.DATABASE.GET_SETTING, key);
        }
    }
});
