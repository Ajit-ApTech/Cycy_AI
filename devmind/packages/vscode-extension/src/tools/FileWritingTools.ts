import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

export class FileWritingTools {
    
    public async writeToFile(filePath: string, content: string, overwrite: boolean = false): Promise<string> {
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
        } catch (error: any) {
            return `Error writing to file: ${error.message}`;
        }
    }

    public async replaceContent(filePath: string, targetContent: string, replacementContent: string): Promise<string> {
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
            } else {
                return 'Failed to apply replacement via WorkspaceEdit.';
            }
        } catch (error: any) {
            return `Error replacing content: ${error.message}`;
        }
    }

    public async multiReplaceContent(filePath: string, replacements: { target: string, replacement: string }[]): Promise<string> {
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
            } else {
                return 'Failed to apply multi-replacement.';
            }
        } catch (error: any) {
            return `Error in multi-replace: ${error.message}`;
        }
    }
}
