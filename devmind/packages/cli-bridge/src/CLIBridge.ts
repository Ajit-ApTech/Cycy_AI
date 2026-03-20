import { spawn, ChildProcess } from 'child_process';
import { EventEmitter } from 'events';
import path from 'path';

export interface CLIConfig {
    pythonPath?: string;
    scriptPath: string;
    cwd?: string;
    model?: string;
    provider?: string;
    apiKey?: string;
}

export class CLIBridge extends EventEmitter {
    private childProcess: ChildProcess | null = null;
    private config: CLIConfig;
    private isRestarting: boolean = false;
    private shouldRun: boolean = false;
    private silentNextStart: boolean = false;

    constructor(config: CLIConfig) {
        super();
        this.config = {
            pythonPath: config.pythonPath || 'python3',
            cwd: config.cwd || process.cwd(),
            ...config
        };
    }

    /**
     * Start the python process.
     * Emits tokens as they come from stdout.
     */
    public start(silent: boolean = false) {
        this.shouldRun = true;
        this.silentNextStart = silent;
        this._spawnProcess();
    }

    /**
     * Write data to the python process stdin.
     */
    public sendInput(data: string) {
        if (this.childProcess && this.childProcess.stdin) {
            this.childProcess.stdin.write(data + '\n');
        } else {
            this.emit('error', new Error('Process is not running'));
        }
    }

    /**
     * Stop the python process cleanly.
     */
    public stop() {
        this.shouldRun = false;
        if (this.childProcess) {
            const proc = this.childProcess;
            proc.kill('SIGTERM');

            // Force kill after 2 seconds if still running
            setTimeout(() => {
                try {
                    // check if proc is still active. 
                    // proc.exitCode is null if it's still running
                    if (proc.exitCode === null) {
                        console.log('[CLIBridge] Process did not exit on SIGTERM. Sending SIGKILL.');
                        proc.kill('SIGKILL');
                    }
                } catch (e) { }
            }, 2000);

            this.childProcess = null;
        }
    }

    /**
     * Apply new configuration and restart the process.
     */
    public updateConfigAndRestart(newConfig: Partial<CLIConfig>, silent: boolean = true) {
        this.config = { ...this.config, ...newConfig };
        this.isRestarting = true;
        this.silentNextStart = silent;

        if (this.childProcess) {
            const proc = this.childProcess;
            proc.kill('SIGTERM');

            // Watchdog for restart
            setTimeout(() => {
                if (proc.exitCode === null) {
                    proc.kill('SIGKILL');
                }
            }, 2000);
            // The _spawnProcess will be called by the exit handler automatically
        } else {
            this.isRestarting = false;
            this.start();
        }
    }

    private _spawnProcess() {
        const { pythonPath, scriptPath, cwd, provider, model, apiKey } = this.config;
        const isSilent = this.silentNextStart;
        this.silentNextStart = false; // reset for next spawn

        // CRITICAL: use -u to force unbuffered stdout/stderr streaming
        // When scriptPath is empty, we are in binary mode (PyInstaller frozen exe)
        const args: string[] = scriptPath ? ['-u', scriptPath] : [];
        if (provider) { args.push('--provider', provider); }
        if (model) { args.push('--model', model); }
        if (apiKey) { args.push('--api-key', apiKey); }

        console.log(`[CLIBridge] Spawning process: ${pythonPath} ${args.map(a => a.includes('--api-key') ? '--api-key [REDACTED]' : a).join(' ')}`);
        console.log(`[CLIBridge] CWD: ${cwd}`);

        try {
            this.childProcess = spawn(pythonPath!, args, {
                cwd: cwd,
                env: {
                    ...process.env,
                    PYTHONUNBUFFERED: '1',
                    ...(isSilent ? { CYCY_SILENT_START: '1' } : {})
                }
            });

            this.childProcess.stdout?.on('data', (data: Buffer) => {
                // We emit chunks as they arrive for real-time streaming
                const str = data.toString('utf-8');
                this.emit('token', str);
            });

            this.childProcess.stderr?.on('data', (data: Buffer) => {
                const str = data.toString('utf-8');
                this.emit('stderr', str);
            });

            this.childProcess.on('exit', (code, signal) => {
                this.childProcess = null;
                console.log(`[CLIBridge] Process exited with code ${code}, signal ${signal}`);
                this.emit('exit', { code, signal });

                if (this.isRestarting) {
                    this.isRestarting = false;
                    // Wait a short moment before reconnecting
                    setTimeout(() => this._spawnProcess(), 500);
                } else if (this.shouldRun && code !== 0) {
                    // Auto-restart on unexpected crash
                    this.emit('error', new Error(`CLI crashed with code ${code}. Auto-restarting...`));
                    setTimeout(() => this._spawnProcess(), 1000);
                }
            });

            this.childProcess.on('error', (err: any) => {
                console.error(`[CLIBridge] Spawn error:`, err);
                this.emit('error', new Error(`Failed to start CLI process: ${err.message || err}`));
            });

        } catch (err: any) {
            console.error(`[CLIBridge] Unexpected error in _spawnProcess:`, err);
            this.emit('error', new Error(`Unexpected CLI Bridge error: ${err.message || err}`));
        }
    }
}
