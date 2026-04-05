import * as vscode from 'vscode';
import * as child_process from 'child_process';
import * as crypto from 'crypto';

export class UtilityTools {
    public async sleep(durationMs: number): Promise<string> {
        return new Promise(resolve => {
            setTimeout(() => {
                resolve(`Sleep completed successfully after ${durationMs}ms`);
            }, durationMs);
        });
    }

    public async config(setting: string, value?: string): Promise<string> {
        try {
            const configuration = vscode.workspace.getConfiguration();
            if (value !== undefined) {
                // If setting config, we update it at the workspace level.
                await configuration.update(setting, value, vscode.ConfigurationTarget.Workspace);
                return `Config Success: Set '${setting}' to '${value}'`;
            } else {
                // Return the current value
                const val = configuration.get(setting);
                return `Config Value for '${setting}': ${val !== undefined ? JSON.stringify(val) : 'undefined'}`;
            }
        } catch (error: any) {
            return `Config Error: ${error.message}`;
        }
    }

    public async sendUserMessage(message: string, status: 'success' | 'error' | 'info' = 'info'): Promise<string> {
        try {
            if (status === 'error') {
                vscode.window.showErrorMessage(`Cycy AI: ${message}`);
            } else if (status === 'success') {
                vscode.window.showInformationMessage(`Cycy AI Success: ${message}`);
            } else {
                vscode.window.showInformationMessage(`Cycy AI: ${message}`);
            }
            return `Message sent to user successfully.`;
        } catch (err: any) {
            return `SendUserMessage Error: ${err.message}`;
        }
    }

    public async notebookEdit(notebookPath: string, cellId: string, editMode: string, newSource: string): Promise<string> {
        // Placeholder for notebook edit integration. Real implementation would require parsing .ipynb JSON, finding the cell, and saving.
        return 'NotebookEdit: Simulating editing of Jupyter notebook cell ' + cellId + ' mode ' + editMode + '. Detailed formatting implemented in Future Phase.';
    }

    public async executeRepl(code: string, language: string, timeoutMs: number = 30000): Promise<string> {
        return new Promise((resolve) => {
            let command = '';
            let processArgs: string[] = [];
            
            if (language.toLowerCase() === 'node' || language.toLowerCase() === 'javascript' || language.toLowerCase() === 'js') {
                command = 'node';
                processArgs = ['-e', code];
            } else if (language.toLowerCase() === 'python' || language.toLowerCase() === 'py') {
                command = 'python3';
                processArgs = ['-c', code];
            } else {
                return resolve(`REPL Error: Language '${language}' not supported by standard REPL yet. Use 'node' or 'python'.`);
            }

            const child = child_process.spawn(command, processArgs, {
                cwd: vscode.workspace.workspaceFolders?.[0]?.uri.fsPath
            });

            let stdout = '';
            let stderr = '';

            const timeout = setTimeout(() => {
                child.kill();
                resolve(`REPL Error: Timeout reached after ${timeoutMs}ms.\nStdout: ${stdout}\nStderr: ${stderr}`);
            }, timeoutMs);

            child.stdout.on('data', (data) => {
                stdout += data.toString();
            });

            child.stderr.on('data', (data) => {
                stderr += data.toString();
            });

            child.on('close', (codeStatus) => {
                clearTimeout(timeout);
                resolve(`REPL execution finished with code ${codeStatus}.\nStdout:\n${stdout}\nStderr:\n${stderr}`);
            });

            child.on('error', (err) => {
                clearTimeout(timeout);
                resolve(`REPL Error: Failed to start process: ${err.message}`);
            });
        });
    }
}
