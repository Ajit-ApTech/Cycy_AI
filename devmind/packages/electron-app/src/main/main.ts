import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import * as path from 'path';
import * as fs from 'fs/promises';
import { CLIBridge } from '@devmind/cli-bridge';
import { IPC_CHANNELS } from '@devmind/shared';
import { CommandGate } from './security/CommandGate';
import { DatabaseService } from './services/DatabaseService';
import * as pty from 'node-pty';
import { BackendLauncher } from './services/BackendLauncher';
import { BrowserAutomationService } from './services/BrowserAutomationService';
import { LinterService } from './services/LinterService';
import { GitService } from './services/GitService';
import { ModelService } from './services/ModelService';

class CycyApp {
    private mainWindow: BrowserWindow | null = null;
    private cliBridge: CLIBridge | null = null;
    private database: DatabaseService | null = null;
    private backendLauncher: BackendLauncher;
    private browserAutomation: BrowserAutomationService;
    private linter: LinterService;
    private git: GitService;
    private modelService: ModelService;
    private ptyProcess: pty.IPty | null = null;

    constructor() {
        this.database = new DatabaseService();
        this.backendLauncher = new BackendLauncher();
        this.browserAutomation = new BrowserAutomationService();
        this.linter = new LinterService(process.cwd());
        this.git = new GitService(process.cwd());
        this.modelService = new ModelService();
        this.setupBackendListeners();
    }

    private setupBackendListeners() {
        this.backendLauncher.on('status', (status) => {
            console.log(`[Backend Status] ${status}`);
            this.mainWindow?.webContents.send(IPC_CHANNELS.BACKEND.STATUS, status);
        });

        this.backendLauncher.on('error', (error) => {
            console.error(`[Backend Error] ${error}`);
            this.mainWindow?.webContents.send(IPC_CHANNELS.BACKEND.ERROR, error);
        });

        this.backendLauncher.on('ready', () => {
            console.log('[Backend] Ready');
            this.mainWindow?.webContents.send(IPC_CHANNELS.BACKEND.STATUS, 'Ready');
        });
    }

    public createWindow() {
        this.mainWindow = new BrowserWindow({
            width: 1400,
            height: 900,
            titleBarStyle: 'hiddenInset',
            webPreferences: {
                preload: path.join(__dirname, 'preload.js'),
                contextIsolation: true,
                sandbox: true,
                nodeIntegration: false
            }
        });

        if (process.env.NODE_ENV === 'development') {
            this.mainWindow.loadURL('http://localhost:5173');
        } else {
            this.mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
        }
        this.mainWindow.webContents.openDevTools();

        this.mainWindow.webContents.on('console-message', (event, level, message, line, sourceId) => {
            console.log(`[Renderer] ${message} (${sourceId}:${line})`);
        });

        // Initialize node-pty terminal with safety
        try {
            const shell = process.env.SHELL || (process.platform === 'win32' ? 'powershell.exe' : '/bin/zsh');
            const defaultCwd = app.getPath('home');

            console.log(`[main] Spawning PTY with shell: ${shell} in ${defaultCwd}`);

            this.ptyProcess = pty.spawn(shell, [], {
                name: 'xterm-color',
                cols: 80,
                rows: 24,
                cwd: defaultCwd,
                env: process.env as { [key: string]: string }
            });

            this.ptyProcess.onData((data: string) => {
                this.mainWindow?.webContents.send(IPC_CHANNELS.TERMINAL.OUTPUT, data);
            });

            this.ptyProcess.onExit(({ exitCode, signal }) => {
                console.warn(`[main] PTY process exited with code ${exitCode}, signal ${signal}`);
                this.mainWindow?.webContents.send(IPC_CHANNELS.TERMINAL.OUTPUT, '\r\n\x1b[31m[Terminal Process Exited]\x1b[0m\r\n');
            });

            console.log('[main] node-pty terminal successfully spawned.');
        } catch (err: any) {
            console.error('[main] node-pty spawn failed. This often happens if the native module is not rebuilt for the current Electron version.', err);
            // Notify UI so user isn't wondering why terminal is blank
            setTimeout(() => {
                this.mainWindow?.webContents.send(IPC_CHANNELS.TERMINAL.OUTPUT,
                    `\x1b[31mError: Failed to spawn terminal process.\x1b[0m\r\n` +
                    `\x1b[33mReason: ${err.message}\x1b[0m\r\n` +
                    `Try running: \x1b[36mnpm run build\x1b[0m in the electron-app directory.\r\n`
                );
            }, 2000);
        }
    }

    async init() {
        // 1. Setup IPC Handlers FIRST so renderer can talk to us immediately
        this.setupIpcHandlers();

        // 1. Calculate Python backend root
        const pythonRoot = app.isPackaged
            ? path.join(process.resourcesPath, 'python-backend')
            : path.join(__dirname, '../../../../../');

        // 2. Initialize CLI Bridge
        const isPackaged = app.isPackaged;
        console.log(`[main] Initializing CLI Bridge. isPackaged: ${isPackaged}`);
        console.log(`[main] pythonRoot: ${pythonRoot}`);

        // Workaround: Use the frozen binary even in dev if backend source is missing
        const binaryPath = path.join(pythonRoot, 'dist-python', 'cycy-ai');
        const hasBinary = require('fs').existsSync(binaryPath);

        if (isPackaged || hasBinary) {
            const finalBinaryPath = isPackaged
                ? path.join(process.resourcesPath, 'python-backend', 'cycy-ai')
                : binaryPath;

            console.log(`[main] Using binary mode: binaryPath=${finalBinaryPath}`);
            this.cliBridge = new CLIBridge({
                pythonPath: finalBinaryPath,
                scriptPath: '',   // binary mode — no separate script
                cwd: pythonRoot
            });
        } else {
            // Development: use local python3 + main.py
            console.log(`[main] Development mode: scriptPath=main.py`);
            this.cliBridge = new CLIBridge({
                scriptPath: 'main.py',
                cwd: pythonRoot
            });
        }

        this.cliBridge.on('token', (token: string) => {
            console.log(`[CLI Token] ${token.substring(0, 50)}...`);
            this.mainWindow?.webContents.send(IPC_CHANNELS.CHAT.TOKEN, token);
        });

        this.cliBridge.on('error', (err: any) => {
            console.error(`[CLI Bridge Error]`, err);
            const msg = err.message || JSON.stringify(err);
            this.mainWindow?.webContents.send(IPC_CHANNELS.CHAT.ERROR, `CLI Bridge Error: ${msg}`);
        });

        this.cliBridge.on('stderr', (data: string) => {
            console.error(`[CLI Stderr] ${data}`);
            const formatted = data.replace(/\r?\n/g, '\r\n');
            this.mainWindow?.webContents.send(IPC_CHANNELS.TERMINAL.OUTPUT, formatted);
        });

        this.cliBridge.on('exit', ({ code, signal }) => {
            console.log(`[CLI Bridge] Exited with code: ${code}, signal: ${signal}`);
            this.mainWindow?.webContents.send(IPC_CHANNELS.CHAT.ERROR, `CLI Bridge exited with code ${code}`);
        });

        this.cliBridge.start();
        console.log('[main] CLI Bridge started.');

        // 3. Create window
        this.createWindow();

        // 4. Start backend services (async, don't block window if Neo4j is slow)
        this.backendLauncher.start().then(() => {
            console.log('[main] Backend services started successfully.');
        }).catch((err: any) => {
            console.error('[main] Backend startup failed:', err.message);
            this.mainWindow?.webContents.send(IPC_CHANNELS.BACKEND.ERROR, `Backend startup failed: ${err.message}`);
        });
    }

    private setupIpcHandlers() {
        ipcMain.on(IPC_CHANNELS.CHAT.SEND, (event, message: any) => {
            const input = typeof message === 'string' ? message : JSON.stringify(message);
            this.cliBridge?.sendInput(input);
        });

        ipcMain.on(IPC_CHANNELS.CHAT.STOP, () => {
            this.cliBridge?.stop();
            setTimeout(() => this.cliBridge?.start(true), 300);
        });

        ipcMain.on(IPC_CHANNELS.CHAT.SET_CONFIG, (event, { provider, model, apiKey }: { provider: string; model: string; apiKey: string }) => {
            this.cliBridge?.updateConfigAndRestart({ provider, model, apiKey });
            this.database?.saveSetting('provider', provider);
            this.database?.saveSetting('model', model);
            if (apiKey) {
                this.database?.saveSetting(`api_key_${provider}`, apiKey);
            }
        });

        ipcMain.on(IPC_CHANNELS.CHAT.SET_CWD, (_event, cwd: string) => {
            console.log(`[main] Setting CWD across services: ${cwd}`);
            // 1. Tell the AI engine (CLI)
            this.cliBridge?.sendInput(`/cd ${cwd}`);

            // 2. Tell the Terminal (PTY)
            if (this.ptyProcess) {
                // We send a raw shell command to change directory in the interactive shell
                const cdCmd = process.platform === 'win32' ? `cd "${cwd}"\r\n` : `cd "${cwd}"\n`;
                this.ptyProcess.write(cdCmd);
            }

            // 3. Update services that care about CWD
            this.linter.setCwd(cwd);
            this.git.setCwd(cwd);
        });

        ipcMain.handle(IPC_CHANNELS.CHAT.FETCH_MODELS, async (_event, provider: string, apiKey: string) => {
            console.log(`[main] Fetching models for provider: ${provider}`);
            try {
                return await this.modelService.fetchModels(provider, apiKey);
            } catch (error: any) {
                console.error(`[main] Failed to fetch models:`, error.message);
                throw error; // Re-throw to be caught in renderer
            }
        });

        ipcMain.handle(IPC_CHANNELS.CHAT.SELECT_FILE, async () => {
            if (!this.mainWindow) return null;
            const result = await dialog.showOpenDialog(this.mainWindow, {
                properties: ['openFile'],
                title: 'Select Screenshot or Image',
                filters: [{ name: 'Images', extensions: ['jpg', 'png', 'gif', 'webp', 'jpeg'] }]
            });
            if (result.canceled || result.filePaths.length === 0) return null;
            const filePath = result.filePaths[0];
            const buffer = await fs.readFile(filePath);
            return {
                path: filePath,
                name: path.basename(filePath),
                type: `image/${path.extname(filePath).slice(1)}`.replace('jpg', 'jpeg'),
                base64: buffer.toString('base64')
            };
        });

        ipcMain.on(IPC_CHANNELS.TERMINAL.INPUT, (event, data: string) => {
            this.ptyProcess?.write(data);
        });

        ipcMain.on(IPC_CHANNELS.TERMINAL.RESIZE, (event, { cols, rows }: { cols: number; rows: number }) => {
            this.ptyProcess?.resize(cols, rows);
        });

        ipcMain.on(IPC_CHANNELS.TERMINAL.SET_CWD, (event, cwd: string) => {
            this.ptyProcess?.write(`cd "${cwd}"\n`);
        });

        ipcMain.handle(IPC_CHANNELS.FOLDER.OPEN_PICKER, async () => {
            if (!this.mainWindow) return null;
            const result = await dialog.showOpenDialog(this.mainWindow, {
                properties: ['openDirectory'],
                title: 'Open Project Folder'
            });
            if (result.canceled || result.filePaths.length === 0) return null;
            return result.filePaths[0];
        });

        ipcMain.handle(IPC_CHANNELS.FOLDER.READ_DIR, async (event, dirPath: string) => {
            try {
                const entries = await fs.readdir(dirPath, { withFileTypes: true });
                return entries.map(e => ({
                    name: e.name,
                    path: path.join(dirPath, e.name),
                    isDirectory: e.isDirectory(),
                }));
            } catch (error: any) {
                return [];
            }
        });

        ipcMain.handle(IPC_CHANNELS.FOLDER.READ_FILE, async (event, filePath: string) => {
            try {
                return await fs.readFile(filePath, 'utf-8');
            } catch (error: any) {
                return `// Error reading file: ${error.message}`;
            }
        });

        ipcMain.on(IPC_CHANNELS.DATABASE.SAVE_MESSAGE, (event, { id, role, content, timestamp, sessionId }) => {
            this.database?.saveChatMessage(id, role, content, timestamp, sessionId);
        });

        ipcMain.handle(IPC_CHANNELS.DATABASE.GET_MESSAGES, (event, sessionId: string) => {
            return this.database?.getChatMessages(sessionId) || [];
        });

        ipcMain.on(IPC_CHANNELS.DATABASE.SAVE_SETTING, (event, { key, value }) => {
            this.database?.saveSetting(key, value);
        });

        ipcMain.handle(IPC_CHANNELS.DATABASE.GET_SETTING, (event, key: string) => {
            return this.database?.getSetting(key) || null;
        });

        ipcMain.handle(IPC_CHANNELS.BACKEND.RELAUNCH, async () => {
            this.backendLauncher.stop();
            return this.backendLauncher.start();
        });

        // ─── Browser IPC ─────────────────────────────────────────────────────────────
        ipcMain.handle(IPC_CHANNELS.BROWSER.LAUNCH, async (_event, headless: boolean = true) => {
            return this.browserAutomation.launch(headless);
        });

        ipcMain.handle(IPC_CHANNELS.BROWSER.NAVIGATE, async (_event, url: string) => {
            return this.browserAutomation.navigate(url);
        });

        ipcMain.handle(IPC_CHANNELS.BROWSER.SCREENSHOT, async () => {
            return this.browserAutomation.screenshot();
        });

        ipcMain.handle(IPC_CHANNELS.BROWSER.CLOSE, async () => {
            return this.browserAutomation.close();
        });

        // ─── Linter IPC ──────────────────────────────────────────────────────────────
        ipcMain.handle(IPC_CHANNELS.LINT.FILE, async (_event, filePath: string) => {
            return this.linter.lintFile(filePath);
        });

        ipcMain.handle(IPC_CHANNELS.LINT.TEXT, async (_event, { text, filePath }: { text: string; filePath: string }) => {
            return this.linter.lintText(text, filePath);
        });

        // ─── Git IPC ─────────────────────────────────────────────────────────────
        ipcMain.handle(IPC_CHANNELS.GIT.STATUS, async () => {
            return this.git.status();
        });

        ipcMain.handle(IPC_CHANNELS.GIT.LOG, async (_event, maxCount: number) => {
            return this.git.log(maxCount);
        });

        ipcMain.handle(IPC_CHANNELS.GIT.COMMIT, async (_event, message: string) => {
            return this.git.commit(message);
        });

        ipcMain.handle(IPC_CHANNELS.GIT.PUSH, async (_event, { remote, branch }: { remote: string; branch: string }) => {
            return this.git.push(remote, branch);
        });

        ipcMain.handle(IPC_CHANNELS.GIT.PULL, async (_event, { remote, branch }: { remote: string; branch: string }) => {
            return this.git.pull(remote, branch);
        });

        ipcMain.handle(IPC_CHANNELS.GIT.REMOTE, async () => {
            return this.git.listRemotes();
        });
    }

    public stop() {
        this.cliBridge?.stop();
        this.database?.close();
        this.ptyProcess?.kill();
        this.backendLauncher.stop();
        this.browserAutomation.close();
    }
}

const cycyApp = new CycyApp();

app.whenReady().then(() => {
    cycyApp.init();
    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) cycyApp.createWindow();
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});

app.on('will-quit', () => {
    cycyApp.stop();
});
