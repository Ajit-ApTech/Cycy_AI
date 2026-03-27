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
        this.writeEmitter = new vscode.EventEmitter();
        this.terminal = null;
        this.commands = new Map();
        this.terminalBuffer = "";
        this.isPtyOpen = false;
    }
    logToTerminal(text) {
        this.terminalBuffer += text;
        if (this.isPtyOpen) {
            this.writeEmitter.fire(text);
        }
    }
    initTerminal() {
        if (!this.terminal) {
            this.isPtyOpen = false;
            const pty = {
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
    async runCommand(command) {
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
    async commandStatus(cmdId) {
        return `Error: command_status is deprecated. Commands now run synchronously.`;
    }
    async sendCommandInput(cmdId, input) {
        const cmd = this.commands.get(cmdId);
        if (!cmd)
            return `Error: Unknown command ID ${cmdId} or process already finished.`;
        if (!cmd.proc.stdin)
            return `Error: Stdin is not available.`;
        try {
            cmd.proc.stdin.write(input);
            return `Successfully sent input to process.`;
        }
        catch (error) {
            return `Error sending input: ${error.message}`;
        }
    }
}
exports.TerminalTools = TerminalTools;
//# sourceMappingURL=TerminalTools.js.map