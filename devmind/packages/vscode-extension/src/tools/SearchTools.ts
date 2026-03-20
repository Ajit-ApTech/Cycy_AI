import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

export class SearchTools {
    
    public async listDir(dirPath: string): Promise<string> {
        // Automatically default to workspace root if empty or '.'
        let targetPath = dirPath;
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (workspaceFolders && workspaceFolders.length > 0) {
            const root = workspaceFolders[0].uri.fsPath;
            if (!dirPath || dirPath === '.' || dirPath === './') {
                targetPath = root;
            } else if (!path.isAbsolute(dirPath)) {
                targetPath = path.join(root, dirPath);
            }
        }

        if (!fs.existsSync(targetPath)) return `Directory not found: ${targetPath}`;
        
        try {
            const files = fs.readdirSync(targetPath, { withFileTypes: true });
            let result = `Listing contents of ${targetPath}:\n`;
            
            for (const file of files) {
                const fullPath = path.join(targetPath, file.name);
                try {
                    const stat = fs.statSync(fullPath);
                    result += `${file.isDirectory() ? '[DIR]' : '[FILE]'} ${file.name} - ${stat.size} bytes\n`;
                } catch {
                    // skip unreadable files/symlinks
                }
            }
            return result;
        } catch (e: any) {
            return `Error reading directory: ${e.message}`;
        }
    }

    public async findByName(pattern: string, searchDir: string): Promise<string> {
        try {
            const relativePattern = new vscode.RelativePattern(vscode.Uri.file(searchDir), pattern);
            const files = await vscode.workspace.findFiles(relativePattern, '**/node_modules/**', 50);
            
            if (files.length === 0) return 'No files found matching pattern.';
            return files.map(f => vscode.workspace.asRelativePath(f)).join('\n');
        } catch (error: any) {
            return `Error finding files: ${error.message}`;
        }
    }

    public async grepSearch(query: string, searchPath: string): Promise<string> {
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
                        results += `${searchPath}:${i+1}:${lines[i]}\n`;
                    }
                }
            } else {
                return 'Directory grep fallback not fully implemented in stub here. Use external command ripgrep.';
            }

            return results || 'No results found.';
        } catch (e: any) {
            return `Grep Error: ${e.message}`;
        }
    }

    public async codebaseSearch(query: string): Promise<string> {
        // Semantic proxy
        return 'Codebase semantic search not hooked up to local vector DB yet.';
    }
}
