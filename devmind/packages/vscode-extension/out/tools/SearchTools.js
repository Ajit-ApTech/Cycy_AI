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
exports.SearchTools = void 0;
const vscode = __importStar(require("vscode"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
class SearchTools {
    async listDir(dirPath) {
        // Automatically default to workspace root if empty or '.'
        let targetPath = dirPath;
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (workspaceFolders && workspaceFolders.length > 0) {
            const root = workspaceFolders[0].uri.fsPath;
            if (!dirPath || dirPath === '.' || dirPath === './') {
                targetPath = root;
            }
            else if (!path.isAbsolute(dirPath)) {
                targetPath = path.join(root, dirPath);
            }
        }
        if (!fs.existsSync(targetPath))
            return `Directory not found: ${targetPath}`;
        try {
            const files = fs.readdirSync(targetPath, { withFileTypes: true });
            let result = `Listing contents of ${targetPath}:\n`;
            for (const file of files) {
                const fullPath = path.join(targetPath, file.name);
                try {
                    const stat = fs.statSync(fullPath);
                    result += `${file.isDirectory() ? '[DIR]' : '[FILE]'} ${file.name} - ${stat.size} bytes\n`;
                }
                catch {
                    // skip unreadable files/symlinks
                }
            }
            return result;
        }
        catch (e) {
            return `Error reading directory: ${e.message}`;
        }
    }
    async findByName(pattern, searchDir) {
        try {
            const relativePattern = new vscode.RelativePattern(vscode.Uri.file(searchDir), pattern);
            const files = await vscode.workspace.findFiles(relativePattern, '**/node_modules/**', 50);
            if (files.length === 0)
                return 'No files found matching pattern.';
            return files.map(f => vscode.workspace.asRelativePath(f)).join('\n');
        }
        catch (error) {
            return `Error finding files: ${error.message}`;
        }
    }
    async grepSearch(query, searchPath) {
        try {
            let results = '';
            // Basic fallback implementation since native VS Code findTextInFiles is complex to expose cleanly
            // For production, we would chain Ripgrep child_process directly
            const uri = vscode.Uri.file(searchPath);
            const isDir = fs.statSync(searchPath).isDirectory();
            if (!isDir) {
                const lines = fs.readFileSync(searchPath, 'utf8').split('\n');
                for (let i = 0; i < lines.length; i++) {
                    if (lines[i].includes(query)) {
                        results += `${searchPath}:${i + 1}:${lines[i]}\n`;
                    }
                }
            }
            else {
                return 'Directory grep fallback not fully implemented in stub here. Use external command ripgrep.';
            }
            return results || 'No results found.';
        }
        catch (e) {
            return `Grep Error: ${e.message}`;
        }
    }
    async codebaseSearch(query) {
        // Semantic proxy
        return 'Codebase semantic search not hooked up to local vector DB yet.';
    }
}
exports.SearchTools = SearchTools;
//# sourceMappingURL=SearchTools.js.map