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
exports.UtilityTools = void 0;
const vscode = __importStar(require("vscode"));
const child_process = __importStar(require("child_process"));
class UtilityTools {
    async sleep(durationMs) {
        return new Promise(resolve => {
            setTimeout(() => {
                resolve(`Sleep completed successfully after ${durationMs}ms`);
            }, durationMs);
        });
    }
    async config(setting, value) {
        try {
            const configuration = vscode.workspace.getConfiguration();
            if (value !== undefined) {
                // If setting config, we update it at the workspace level.
                await configuration.update(setting, value, vscode.ConfigurationTarget.Workspace);
                return `Config Success: Set '${setting}' to '${value}'`;
            }
            else {
                // Return the current value
                const val = configuration.get(setting);
                return `Config Value for '${setting}': ${val !== undefined ? JSON.stringify(val) : 'undefined'}`;
            }
        }
        catch (error) {
            return `Config Error: ${error.message}`;
        }
    }
    async sendUserMessage(message, status = 'info') {
        try {
            if (status === 'error') {
                vscode.window.showErrorMessage(`Cycy AI: ${message}`);
            }
            else if (status === 'success') {
                vscode.window.showInformationMessage(`Cycy AI Success: ${message}`);
            }
            else {
                vscode.window.showInformationMessage(`Cycy AI: ${message}`);
            }
            return `Message sent to user successfully.`;
        }
        catch (err) {
            return `SendUserMessage Error: ${err.message}`;
        }
    }
    async notebookEdit(notebookPath, cellId, editMode, newSource) {
        // Placeholder for notebook edit integration. Real implementation would require parsing .ipynb JSON, finding the cell, and saving.
        return 'NotebookEdit: Simulating editing of Jupyter notebook cell ' + cellId + ' mode ' + editMode + '. Detailed formatting implemented in Future Phase.';
    }
    async executeRepl(code, language, timeoutMs = 30000) {
        return new Promise((resolve) => {
            let command = '';
            let processArgs = [];
            if (language.toLowerCase() === 'node' || language.toLowerCase() === 'javascript' || language.toLowerCase() === 'js') {
                command = 'node';
                processArgs = ['-e', code];
            }
            else if (language.toLowerCase() === 'python' || language.toLowerCase() === 'py') {
                command = 'python3';
                processArgs = ['-c', code];
            }
            else {
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
exports.UtilityTools = UtilityTools;
//# sourceMappingURL=UtilityTools.js.map