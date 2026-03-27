import * as vscode from 'vscode';
import * as fs from 'fs';
import * as readline from 'readline';

export class FileReadingTools {
    
    private static readonly MAX_LINES_DEFAULT = 200;

    public async viewFile(filePath: string, startLine?: number, endLine?: number): Promise<string> {
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
        } catch (error: any) {
            return `Error reading file: ${error.message}`;
        }
    }

    public async viewFileOutline(filePath: string): Promise<string> {
        try {
            const uri = vscode.Uri.file(filePath);
            const symbols: vscode.DocumentSymbol[] = await vscode.commands.executeCommand(
                'vscode.executeDocumentSymbolProvider',
                uri
            ) || [];

            if (symbols.length === 0) return 'No symbols found.';

            let outline = '';
            const formatSymbol = (sym: vscode.DocumentSymbol, indent: string = '') => {
                outline += `${indent}- ${sym.name} (${vscode.SymbolKind[sym.kind]}) L${sym.range.start.line + 1}-L${sym.range.end.line + 1}\n`;
                for (const child of sym.children) {
                    formatSymbol(child, indent + '  ');
                }
            };

            symbols.forEach(s => formatSymbol(s));
            return outline;
        } catch (error: any) {
            return `Error fetching outline: ${error.message}`;
        }
    }

    public async viewCodeItem(filePath: string, itemName: string): Promise<string> {
        try {
            const uri = vscode.Uri.file(filePath);
            const symbols: vscode.DocumentSymbol[] = await vscode.commands.executeCommand(
                'vscode.executeDocumentSymbolProvider',
                uri
            ) || [];

            const findSymbol = (syms: vscode.DocumentSymbol[]): vscode.DocumentSymbol | undefined => {
                for (const s of syms) {
                    if (s.name === itemName) return s;
                    const child = findSymbol(s.children);
                    if (child) return child;
                }
                return undefined;
            };

            const symbol = findSymbol(symbols);
            if (!symbol) return `Code item '${itemName}' not found in ${filePath}`;

            const doc = await vscode.workspace.openTextDocument(uri);
            return doc.getText(symbol.range);
        } catch (error: any) {
            return `Error reading code item: ${error.message}`;
        }
    }
}
