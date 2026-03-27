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
exports.FileReadingTools = void 0;
const vscode = __importStar(require("vscode"));
const fs = __importStar(require("fs"));
class FileReadingTools {
    async viewFile(filePath, startLine, endLine) {
        if (!fs.existsSync(filePath)) {
            return `File not found: ${filePath}`;
        }
        try {
            const content = fs.readFileSync(filePath, 'utf-8');
            const lines = content.split('\n');
            const noRangeSpecified = !startLine && !endLine;
            let s = startLine ? Math.max(1, startLine) : 1;
            let e = endLine ? Math.min(lines.length, endLine) : lines.length;
            // If no range was specified and file is large, cap it
            let wasCapped = false;
            if (noRangeSpecified && lines.length > FileReadingTools.MAX_LINES_DEFAULT) {
                e = FileReadingTools.MAX_LINES_DEFAULT;
                wasCapped = true;
            }
            let result = '';
            for (let i = s - 1; i < e; i++) {
                result += `${i + 1}\t${lines[i]}\n`;
            }
            if (wasCapped) {
                result += `\n--- OUTPUT CAPPED at ${FileReadingTools.MAX_LINES_DEFAULT} of ${lines.length} total lines ---\n`;
                result += `To see more, call view_file again with startLine and endLine arguments (e.g., startLine: ${FileReadingTools.MAX_LINES_DEFAULT + 1}, endLine: ${Math.min(lines.length, FileReadingTools.MAX_LINES_DEFAULT + 200)}).\n`;
            }
            return result;
        }
        catch (error) {
            return `Error reading file: ${error.message}`;
        }
    }
    async viewFileOutline(filePath) {
        try {
            const uri = vscode.Uri.file(filePath);
            const symbols = await vscode.commands.executeCommand('vscode.executeDocumentSymbolProvider', uri) || [];
            if (symbols.length === 0)
                return 'No symbols found.';
            let outline = '';
            const formatSymbol = (sym, indent = '') => {
                outline += `${indent}- ${sym.name} (${vscode.SymbolKind[sym.kind]}) L${sym.range.start.line + 1}-L${sym.range.end.line + 1}\n`;
                for (const child of sym.children) {
                    formatSymbol(child, indent + '  ');
                }
            };
            symbols.forEach(s => formatSymbol(s));
            return outline;
        }
        catch (error) {
            return `Error fetching outline: ${error.message}`;
        }
    }
    async viewCodeItem(filePath, itemName) {
        try {
            const uri = vscode.Uri.file(filePath);
            const symbols = await vscode.commands.executeCommand('vscode.executeDocumentSymbolProvider', uri) || [];
            const findSymbol = (syms) => {
                for (const s of syms) {
                    if (s.name === itemName)
                        return s;
                    const child = findSymbol(s.children);
                    if (child)
                        return child;
                }
                return undefined;
            };
            const symbol = findSymbol(symbols);
            if (!symbol)
                return `Code item '${itemName}' not found in ${filePath}`;
            const doc = await vscode.workspace.openTextDocument(uri);
            return doc.getText(symbol.range);
        }
        catch (error) {
            return `Error reading code item: ${error.message}`;
        }
    }
}
exports.FileReadingTools = FileReadingTools;
FileReadingTools.MAX_LINES_DEFAULT = 200;
//# sourceMappingURL=FileReadingTools.js.map