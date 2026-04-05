"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.GitTools = void 0;
const vscode = __importStar(require("vscode"));
const child_process = __importStar(require("child_process"));
const util = __importStar(require("util"));
const execAsync = util.promisify(child_process.exec);
class GitTools {
    async runGitCommand(args, cwd) {
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
        }
        catch (error) {
            return `Git Execution Error: ${error.message}`;
        }
    }
    async gitStatus() {
        return await this.runGitCommand('status');
    }
    async gitDiff(staged = false) {
        return await this.runGitCommand(staged ? 'diff --cached' : 'diff');
    }
    async gitCommit(message) {
        // Warning: This will only commit staged changes
        // Using quotes around the message for safety in shell. Ideally we'd use spawn but this is simple enough.
        return await this.runGitCommand(`commit -m "${message.replace(/"/g, '\\"')}"`);
    }
    async gitAddAll() {
        return await this.runGitCommand('add .');
    }
}
exports.GitTools = GitTools;
//# sourceMappingURL=GitTools.js.map