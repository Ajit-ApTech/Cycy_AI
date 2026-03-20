import * as vscode from 'vscode';
import * as cp from 'child_process';
import * as crypto from 'crypto';

interface CommandOutput {
    stdout: string;
    stderr: string;
    status: 'running' | 'done' | 'error';
    exitCode?: number | null;
}

export class TerminalTools {
    private commands = new Map<string, { proc: cp.ChildProcess, output: CommandOutput }>();

    public async runCommand(command: string): Promise<string> {
        // Send complex commands to the background system
        const cmdId = crypto.randomUUID();
        const workspaceDir = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || process.cwd();
        
        const proc = cp.exec(command, { cwd: workspaceDir });
        const output: CommandOutput = { stdout: '', stderr: '', status: 'running' };
        
        this.commands.set(cmdId, { proc, output });

        proc.stdout?.on('data', data => output.stdout += data);
        proc.stderr?.on('data', data => output.stderr += data);
        
        proc.on('close', code => {
            output.status = 'done';
            output.exitCode = code;
        });

        proc.on('error', err => {
            output.status = 'error';
            output.stderr += `\nProcess error: ${err.message}`;
        });

        // Wait a small bit to see if it finishes instantly
        await new Promise(res => setTimeout(res, 500));

        if (output.status !== 'running') {
            return this.formatOutput(cmdId, output);
        }
        
        return `Background command ID: ${cmdId}\nUse 'command_status' tool to poll.`;
    }

    public async commandStatus(cmdId: string): Promise<string> {
        const cmd = this.commands.get(cmdId);
        if (!cmd) return `Error: Unknown command ID ${cmdId}`;
        return this.formatOutput(cmdId, cmd.output);
    }

    public async sendCommandInput(cmdId: string, input: string): Promise<string> {
        const cmd = this.commands.get(cmdId);
        if (!cmd) return `Error: Unknown command ID ${cmdId}`;
        
        if (cmd.output.status !== 'running') {
            return `Error: Process ${cmdId} is no longer running (Status: ${cmd.output.status})`;
        }

        if (!cmd.proc.stdin) {
            return `Error: Stdin is not available for process ${cmdId}`;
        }

        try {
            cmd.proc.stdin.write(input);
            return `Successfully sent input to process ${cmdId}`;
        } catch (error: any) {
            return `Error sending input: ${error.message}`;
        }
    }

    private formatOutput(id: string, output: CommandOutput): string {
        return `Command ID: ${id}\nStatus: ${output.status}\nExit Code: ${output.exitCode ?? 'N/A'}\n\nSTDOUT:\n${output.stdout}\n\nSTDERR:\n${output.stderr}`;
    }
}
