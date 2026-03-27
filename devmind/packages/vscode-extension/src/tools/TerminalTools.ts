import * as vscode from 'vscode';
import * as cp from 'child_process';
import * as crypto from 'crypto';

export class TerminalTools {
    private writeEmitter = new vscode.EventEmitter<string>();
    private terminal: vscode.Terminal | null = null;
    private commands = new Map<string, { proc: cp.ChildProcess }>();
    private terminalBuffer = "";
    private isPtyOpen = false;

    private logToTerminal(text: string) {
        this.terminalBuffer += text;
        if (this.isPtyOpen) {
            this.writeEmitter.fire(text);
        }
    }

    private initTerminal() {
        if (!this.terminal) {
            this.isPtyOpen = false;
            const pty: vscode.Pseudoterminal = {
                onDidWrite: this.writeEmitter.event,
                open: () => { 
                    this.isPtyOpen = true; 
                    this.writeEmitter.fire(this.terminalBuffer); 
                },
                close: () => { 
                    this.terminal = null; 
                    this.isPtyOpen = false; 
                }
            };
            this.terminal = vscode.window.createTerminal({ name: 'Cycy AI Exec', pty });
        }
    }

    public async runCommand(command: string): Promise<string> {
        this.initTerminal();
        const workspaceDir = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || process.cwd();
        
        this.logToTerminal(`\x1b[32m$ ${command}\x1b[0m\r\n`);
        
        return new Promise((resolve) => {
            let outputBody = "";
            let errorBody = "";
            
            const proc = cp.spawn(command, { cwd: workspaceDir, shell: true });
            const cmdId = crypto.randomUUID();
            this.commands.set(cmdId, { proc });

            proc.stdout?.on('data', data => {
                const chunk = data.toString();
                outputBody += chunk;
                this.logToTerminal(chunk.replace(/\n/g, '\r\n'));
            });

            proc.stderr?.on('data', data => {
                const chunk = data.toString();
                errorBody += chunk;
                this.logToTerminal(chunk.replace(/\n/g, '\r\n'));
            });

            proc.on('close', code => {
                this.commands.delete(cmdId);
                const result = `Command: ${command}\nExit Code: ${code}\nSTDOUT:\n${outputBody}\nSTDERR:\n${errorBody}`;
                this.logToTerminal(`\r\n\x1b[33m[Completed with code ${code}]\x1b[0m\r\n\r\n`);
                resolve(result);
            });

            proc.on('error', err => {
                this.commands.delete(cmdId);
                const result = `Process Error: ${err.message}\nSTDOUT:\n${outputBody}\nSTDERR:\n${errorBody}`;
                this.logToTerminal(`\r\n\x1b[31m[Error: ${err.message}]\x1b[0m\r\n\r\n`);
                resolve(result);
            });
        });
    }

    public async commandStatus(cmdId: string): Promise<string> {
        return `Error: command_status is deprecated. Commands now run synchronously.`;
    }

    public async sendCommandInput(cmdId: string, input: string): Promise<string> {
        const cmd = this.commands.get(cmdId);
        if (!cmd) return `Error: Unknown command ID ${cmdId} or process already finished.`;
        if (!cmd.proc.stdin) return `Error: Stdin is not available.`;
        try {
            cmd.proc.stdin.write(input);
            return `Successfully sent input to process.`;
        } catch (error: any) {
            return `Error sending input: ${error.message}`;
        }
    }
}
