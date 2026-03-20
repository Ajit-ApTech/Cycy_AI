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
exports.FileWritingTools = void 0;
const vscode = __importStar(require("vscode"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
class FileWritingTools {
    async writeToFile(filePath, content, overwrite = false) {
        if (fs.existsSync(filePath) && !overwrite) {
            return `File already exists at ${filePath}. Ensure overwrite is true to replace.`;
        }
        try {
            // Ensure directory exists
            fs.mkdirSync(path.dirname(filePath), { recursive: true });
            fs.writeFileSync(filePath, content, 'utf-8');
            // Try to open it in VS Code
            const doc = await vscode.workspace.openTextDocument(filePath);
            await vscode.window.showTextDocument(doc, { preview: false });
            return `Successfully wrote to ${filePath}`;
        }
        catch (error) {
            return `Error writing to file: ${error.message}`;
        }
    }
    async replaceContent(filePath, targetContent, replacementContent) {
        if (!fs.existsSync(filePath)) {
            return `File not found: ${filePath}`;
        }
        try {
            const document = await vscode.workspace.openTextDocument(filePath);
            const text = document.getText();
            const startIdx = text.indexOf(targetContent);
            if (startIdx === -1) {
                return 'Target text not found in file. Ensure exact whitespace matching.';
            }
            const startPos = document.positionAt(startIdx);
            const endPos = document.positionAt(startIdx + targetContent.length);
            const range = new vscode.Range(startPos, endPos);
            const edit = new vscode.WorkspaceEdit();
            edit.replace(document.uri, range, replacementContent);
            const success = await vscode.workspace.applyEdit(edit);
            if (success) {
                await document.save();
                return 'Replacement successful.';
            }
            else {
                return 'Failed to apply replacement via WorkspaceEdit.';
            }
        }
        catch (error) {
            return `Error replacing content: ${error.message}`;
        }
    }
    async multiReplaceContent(filePath, replacements) {
        if (!fs.existsSync(filePath)) {
            return `File not found: ${filePath}`;
        }
        try {
            const document = await vscode.workspace.openTextDocument(filePath);
            const edit = new vscode.WorkspaceEdit();
            let text = document.getText();
            for (const r of replacements) {
                const startIdx = text.indexOf(r.target);
                if (startIdx === -1) {
                    return `Target text '${r.target.substring(0, 20)}...' not found in file. Batch aborted.`;
                }
                const startPos = document.positionAt(startIdx);
                const endPos = document.positionAt(startIdx + r.target.length);
                const range = new vscode.Range(startPos, endPos);
                edit.replace(document.uri, range, r.replacement);
                // Update local text for subsequent matches in the same batch if they overlap or shift
                // But generally WorkspaceEdit handles multiple replaces on the same version correctly if they don't overlap
            }
            const success = await vscode.workspace.applyEdit(edit);
            if (success) {
                await document.save();
                return `Successfully applied ${replacements.length} replacements.`;
            }
            else {
                return 'Failed to apply multi-replacement.';
            }
        }
        catch (error) {
            return `Error in multi-replace: ${error.message}`;
        }
    }
}
exports.FileWritingTools = FileWritingTools;
//# sourceMappingURL=FileWritingTools.js.map