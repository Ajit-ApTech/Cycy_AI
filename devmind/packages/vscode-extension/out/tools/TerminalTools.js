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
exports.TerminalTools = void 0;
const vscode = __importStar(require("vscode"));
const cp = __importStar(require("child_process"));
const crypto = __importStar(require("crypto"));
class TerminalTools {
    constructor() {
        this.commands = new Map();
    }
    async runCommand(command) {
        // Send complex commands to the background system
        const cmdId = crypto.randomUUID();
        const workspaceDir = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || process.cwd();
        const proc = cp.exec(command, { cwd: workspaceDir });
        const output = { stdout: '', stderr: '', status: 'running' };
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
    async commandStatus(cmdId) {
        const cmd = this.commands.get(cmdId);
        if (!cmd)
            return `Error: Unknown command ID ${cmdId}`;
        return this.formatOutput(cmdId, cmd.output);
    }
    async sendCommandInput(cmdId, input) {
        const cmd = this.commands.get(cmdId);
        if (!cmd)
            return `Error: Unknown command ID ${cmdId}`;
        if (cmd.output.status !== 'running') {
            return `Error: Process ${cmdId} is no longer running (Status: ${cmd.output.status})`;
        }
        if (!cmd.proc.stdin) {
            return `Error: Stdin is not available for process ${cmdId}`;
        }
        try {
            cmd.proc.stdin.write(input);
            return `Successfully sent input to process ${cmdId}`;
        }
        catch (error) {
            return `Error sending input: ${error.message}`;
        }
    }
    formatOutput(id, output) {
        return `Command ID: ${id}\nStatus: ${output.status}\nExit Code: ${output.exitCode ?? 'N/A'}\n\nSTDOUT:\n${output.stdout}\n\nSTDERR:\n${output.stderr}`;
    }
}
exports.TerminalTools = TerminalTools;
//# sourceMappingURL=TerminalTools.js.map