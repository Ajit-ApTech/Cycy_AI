import * as vscode from 'vscode';
import * as child_process from 'child_process';
import * as util from 'util';

const execAsync = util.promisify(child_process.exec);

export class GitTools {
    private async runGitCommand(args: string, cwd?: string): Promise<string> {
        try {
            const workspaceFolders = vscode.workspace.workspaceFolders;
            const execCwd = cwd || (workspaceFolders && workspaceFolders.length > 0 ? workspaceFolders[0].uri.fsPath : undefined);
            
            if (!execCwd) {
                return 'Git Error: No workspace folder found to run git command.';
            }

            const { stdout, stderr } = await execAsync(`git ${args}`, { cwd: execCwd });
            if (stderr && stderr.trim().length > 0 && !stdout) {
                // Git sometimes writes normal output to stderr (like clone/fetch progress)
                return stderr;
            }
            return stdout || 'Command completed successfully (no output).';
        } catch (error: any) {
            return `Git Execution Error: ${error.message}`;
        }
    }

    public async gitStatus(): Promise<string> {
        return await this.runGitCommand('status');
    }

    public async gitDiff(staged: boolean = false): Promise<string> {
        return await this.runGitCommand(staged ? 'diff --cached' : 'diff');
    }

    public async gitCommit(message: string): Promise<string> {
        // Warning: This will only commit staged changes
        // Using quotes around the message for safety in shell. Ideally we'd use spawn but this is simple enough.
        return await this.runGitCommand(`commit -m "${message.replace(/"/g, '\\"')}"`);
    }

    public async gitAddAll(): Promise<string> {
        return await this.runGitCommand('add .');
    }
}
