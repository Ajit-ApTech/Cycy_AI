import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as crypto from 'crypto';
import { FileReadingTools } from './FileReadingTools';
import { FileWritingTools } from './FileWritingTools';
import { SearchTools } from './SearchTools';
import { TerminalTools } from './TerminalTools';

export class ToolExecutor {
    private fileReader = new FileReadingTools();
    private fileWriter = new FileWritingTools();
    private searcher = new SearchTools();
    private terminal = new TerminalTools();
    
    private pinnedFiles: Set<string> = new Set();
    
    // Command confirmation queue
    private pendingConfirmations: Map<string, { resolve: (result: string) => void, command: string }> = new Map();
    private _onConfirmationNeeded = new vscode.EventEmitter<{ id: string, name: string, args: any }>();
    public readonly onConfirmationNeeded = this._onConfirmationNeeded.event;

    public getPinnedFiles(): string[] {
        return Array.from(this.pinnedFiles);
    }
    
    public resolveConfirmation(id: string, approved: boolean): void {
        const pending = this.pendingConfirmations.get(id);
        if (pending) {
            if (approved) {
                // Execute it now
                this.terminal.runCommand(pending.command).then(result => {
                    pending.resolve(result);
                });
            } else {
                pending.resolve("Tool Execution Error: The user rejected the command. Do not attempt to run it again. Ask the user how they would like to proceed or provide an alternative solution.");
            }
            this.pendingConfirmations.delete(id);
        }
    }

    // Map commonly hallucinated tool names to real tools
    private static readonly TOOL_ALIASES: Record<string, string> = {
        'replace_in_file': 'replace_file_content',
        'edit_file': 'replace_file_content',
        'str_replace_editor': 'replace_file_content',
        'file_edit': 'replace_file_content',
        'modify_file': 'replace_file_content',
        'create_file': 'write_to_file',
        'read_file': 'view_file',
        'search_files': 'grep_search',
        'execute_command': 'run_command',
        'shell': 'run_command',
    };

    // Normalize hallucinated argument names to canonical ones
    private normalizeArgs(name: string, args: any): any {
        if (!args || typeof args !== 'object') return args;
        const normalized = { ...args };

        // Path aliases
        if (!normalized.path) {
            normalized.path = normalized.file_path || normalized.TargetFile || normalized.filePath || normalized.filename || normalized.file || normalized.AbsolutePath || normalized.dir;
        }

        // Auto-resolve relative paths to absolute workspace paths
        if (normalized.path && typeof normalized.path === 'string' && !path.isAbsolute(normalized.path)) {
            const workspaceFolders = vscode.workspace.workspaceFolders;
            if (workspaceFolders && workspaceFolders.length > 0) {
                normalized.path = path.join(workspaceFolders[0].uri.fsPath, normalized.path);
            }
        }

        // Content aliases
        if (!normalized.content) {
            normalized.content = normalized.file_content || normalized.code || normalized.text_content;
        }

        // write_to_file: default overwrite to true if AI doesn't set it
        if (name === 'write_to_file' && normalized.overwrite === undefined) {
            normalized.overwrite = true;
        }

        // view_file: handle view_range array → startLine/endLine
        if (name === 'view_file' && Array.isArray(normalized.view_range) && normalized.view_range.length >= 2) {
            if (!normalized.startLine) normalized.startLine = normalized.view_range[0];
            if (!normalized.endLine) normalized.endLine = normalized.view_range[1];
        }

        // replace_file_content: handle alternate arg names
        if (name === 'replace_file_content') {
            if (!normalized.targetText) normalized.targetText = normalized.target_text || normalized.old_str || normalized.old_string || normalized.old_text || normalized.search || normalized.find;
            if (!normalized.replacementText) normalized.replacementText = normalized.replacement_text || normalized.new_str || normalized.new_string || normalized.new_text || normalized.replace || normalized.new_content;
        }

        // grep_search / codebase_search: handle alternate search arg names
        if (!normalized.query) normalized.query = normalized.search_term || normalized.regex || normalized.text;

        // run_command: handle alternate command arg names
        if (!normalized.command) normalized.command = normalized.CommandLine || normalized.cmd;

        return normalized;
    }

    public async executeTool(name: string, args: any): Promise<string> {
        try {
            // Resolve tool name aliases
            name = ToolExecutor.TOOL_ALIASES[name] || name;

            // Normalize argument names
            args = this.normalizeArgs(name, args);

            // Provide clean error messages if required arguments are completely missing (e.g. from empty {})
            if (['view_file', 'view_file_outline', 'view_code_item', 'write_to_file', 'replace_file_content', 'multi_replace_file_content', 'list_dir', 'find_by_name'].includes(name) && !args.path) {
                if (!args.path) {
                    return `Tool Execution Error: Missing required argument "path". You MUST provide the absolute file path in your JSON arguments. Example: {"path": "/Users/.../myfile.html", ...}`;
                }
            }

            switch (name) {
                // File Reading
                case 'view_file': return await this.fileReader.viewFile(args.path, args.startLine, args.endLine);
                case 'view_file_outline': return await this.fileReader.viewFileOutline(args.path);
                case 'view_code_item': {
                    if (!args.itemName) return `Tool Execution Error: Missing required argument "itemName".`;
                    return await this.fileReader.viewCodeItem(args.path, args.itemName);
                }
                
                // File Writing
                case 'write_to_file': {
                    if (args.content === undefined) return `Tool Execution Error: Missing required argument "content".`;
                    return await this.fileWriter.writeToFile(args.path, args.content, args.overwrite);
                }
                case 'replace_file_content': {
                    if (args.targetText === undefined || args.replacementText === undefined) return `Tool Execution Error: Missing required arguments "targetText" or "replacementText".`;
                    return await this.fileWriter.replaceContent(args.path, args.targetText, args.replacementText);
                }
                case 'multi_replace_file_content': {
                    if (!args.replacements || !Array.isArray(args.replacements)) return `Tool Execution Error: Missing or invalid "replacements" array.`;
                    return await this.fileWriter.multiReplaceContent(args.path, args.replacements);
                }
                
                // Search
                case 'list_dir': return await this.searcher.listDir(args.path);
                case 'grep_search': {
                    args.path = args.path || args.SearchPath || args.dir;
                    if (!args.query) return `Tool Execution Error: Missing required argument "query".`;
                    if (!args.path) return `Tool Execution Error: Missing required argument "path" (or SearchPath).`;
                    return await this.searcher.grepSearch(args.query, args.path);
                }
                case 'codebase_search': {
                    if (!args.query) return `Tool Execution Error: Missing required argument "query".`;
                    return await this.searcher.codebaseSearch(args.query);
                }
                case 'find_by_name': {
                    if (!args.pattern) return `Tool Execution Error: Missing required argument "pattern".`;
                    return await this.searcher.findByName(args.pattern, args.path);
                }
                
                // Terminal (Requires Confirmation)
                case 'run_command': {
                    if (!args.command && !args.CommandLine) return `Tool Execution Error: Missing required argument "command".`;
                    return new Promise((resolve) => {
                        const id = crypto.randomUUID();
                        // handle alias from other models
                        const cmdToRun = args.command || args.CommandLine; 
                        this.pendingConfirmations.set(id, { resolve, command: cmdToRun });
                        this._onConfirmationNeeded.fire({ id, name, args: { ...args, command: cmdToRun } });
                    });
                }
                case 'command_status': {
                    if (!args.commandId) return `Tool Execution Error: Missing required argument "commandId".`;
                    return await this.terminal.commandStatus(args.commandId);
                }
                case 'send_command_input': {
                    if (!args.commandId || args.input === undefined) return `Tool Execution Error: Missing "commandId" or "input".`;
                    return await this.terminal.sendCommandInput(args.commandId, args.input);
                }
                
                // Context Memory
                case 'pin_file': {
                    this.pinnedFiles.add(args.path);
                    return `File pinned successfully: ${args.path}. It is now injected into your context.`;
                }
                case 'unpin_file': {
                    if (this.pinnedFiles.has(args.path)) {
                        this.pinnedFiles.delete(args.path);
                        return `File unpinned successfully: ${args.path}.`;
                    }
                    return `File was not pinned: ${args.path}`;
                }
                case 'update_project_knowledge': {
                    const workspaceFolders = vscode.workspace.workspaceFolders;
                    if (!workspaceFolders || workspaceFolders.length === 0) return 'No workspace found to save knowledge.';
                    const cycyDir = path.join(workspaceFolders[0].uri.fsPath, '.cycy');
                    if (!fs.existsSync(cycyDir)) fs.mkdirSync(cycyDir);
                    const knPath = path.join(cycyDir, 'knowledge.md');
                    
                    let content = args.knowledge;
                    if (fs.existsSync(knPath)) {
                        content = fs.readFileSync(knPath, 'utf-8') + '\n\n### ' + args.topic + '\n' + args.knowledge;
                    } else {
                        content = '# Project Knowledge Base\n\n### ' + args.topic + '\n' + args.knowledge;
                    }
                    fs.writeFileSync(knPath, content);
                    return `Successfully added knowledge about '${args.topic}' to .cycy/knowledge.md`;
                }

                default:
                    return `Error: Unknown tool '${name}'`;
            }
        } catch (error: any) {
            return `Tool Execution Error: ${error.message}`;
        }
    }

    public getToolSchemas() {
        return [
            // File Reading
            {
                name: 'view_file',
                description: 'Reads contents of a file. Output is CAPPED at 200 lines if no range is specified. For large files, use startLine and endLine to read specific sections. Use view_file_outline first to understand the file structure before reading.',
                parameters: {
                    type: 'object',
                    properties: {
                        path: { type: 'string', description: 'Absolute path to the file' },
                        startLine: { type: 'number', description: 'Start line number (1-indexed). Use this to read a specific section.' },
                        endLine: { type: 'number', description: 'End line number (1-indexed, inclusive). Use this with startLine.' }
                    },
                    required: ['path']
                }
            },
            {
                name: 'view_file_outline',
                description: 'Gets the structural outline of a file (symbols, functions, classes). Use this BEFORE view_file to understand what is in the file without reading the full content.',
                parameters: {
                    type: 'object',
                    properties: {
                        path: { type: 'string', description: 'Absolute path to the file' }
                    },
                    required: ['path']
                }
            },
            {
                name: 'view_code_item',
                description: 'Reads the source code of a specific function, class, or symbol by name',
                parameters: {
                    type: 'object',
                    properties: {
                        path: { type: 'string', description: 'Absolute path to the file' },
                        itemName: { type: 'string', description: 'Name of the function, class, or variable to read' }
                    },
                    required: ['path', 'itemName']
                }
            },
            
            // File Writing
            {
                name: 'write_to_file',
                description: 'Creates a NEW file or completely overwrites an existing file with new content. WARNING: Do NOT use this for small changes to existing files — use replace_file_content instead, which is faster and safer.',
                parameters: {
                    type: 'object',
                    properties: {
                        path: { type: 'string', description: 'Absolute path to the file' },
                        content: { type: 'string', description: 'The full content to write to the file' },
                        overwrite: { type: 'boolean', description: 'Set to true to overwrite existing files (default: true)' }
                    },
                    required: ['path', 'content']
                }
            },
            {
                name: 'replace_file_content',
                description: 'PREFERRED method for making targeted edits to existing files. Finds an exact text snippet in the file and replaces it with new text. Use this instead of write_to_file whenever you need to change a few lines (e.g., fix a CSS path, update a variable, rename a function). Much safer than rewriting the whole file.',
                parameters: {
                    type: 'object',
                    properties: {
                        path: { type: 'string', description: 'Absolute path to the file' },
                        targetText: { type: 'string', description: 'The exact text to find and replace (must match exactly, including whitespace)' },
                        replacementText: { type: 'string', description: 'The new text to replace the target with' }
                    },
                    required: ['path', 'targetText', 'replacementText']
                }
            },
            {
                name: 'multi_replace_file_content',
                description: 'Applies multiple non-adjacent text replacements in a single file',
                parameters: {
                    type: 'object',
                    properties: {
                        path: { type: 'string', description: 'Absolute path to the file' },
                        replacements: {
                            type: 'array',
                            items: {
                                type: 'object',
                                properties: {
                                    target: { type: 'string', description: 'The exact text to find' },
                                    replacement: { type: 'string', description: 'The replacement text' }
                                },
                                required: ['target', 'replacement']
                            }
                        }
                    },
                    required: ['path', 'replacements']
                }
            },

            // Context Memory
            {
                name: 'pin_file',
                description: 'Pins a file to your permanent context memory so you don\'t have to keep re-reading it. Use this for core files you are heavily working on.',
                parameters: {
                    type: 'object',
                    properties: {
                        path: { type: 'string', description: 'Absolute path to the file to pin' }
                    },
                    required: ['path']
                }
            },
            {
                name: 'unpin_file',
                description: 'Removes a file from your permanent context memory once you are done working on it heavily.',
                parameters: {
                    type: 'object',
                    properties: {
                        path: { type: 'string', description: 'Absolute path to the file to unpin' }
                    },
                    required: ['path']
                }
            },
            {
                name: 'update_project_knowledge',
                description: 'Saves important architectural rules, patterns, or facts about this project to a persistent knowledge base so you do not forget them in future sessions.',
                parameters: {
                    type: 'object',
                    properties: {
                        topic: { type: 'string', description: 'A short topic or category for this knowledge (e.g., CSS Framework, Database Schema, Authentication Rule)' },
                        knowledge: { type: 'string', description: 'Detailed markdown notes explaining the rule or pattern to remember.' }
                    },
                    required: ['topic', 'knowledge']
                }
            },

            // Search
            {
                name: 'list_dir',
                description: 'Lists all files and directories in a path',
                parameters: {
                    type: 'object',
                    properties: {
                        path: { type: 'string', description: 'Directory path (relative ok)' }
                    },
                    required: ['path']
                }
            },
            {
                name: 'find_by_name',
                description: 'Searches for files matching a glob pattern (e.g., *.ts, index.html)',
                parameters: {
                    type: 'object',
                    properties: {
                        pattern: { type: 'string', description: 'Glob pattern to search for' },
                        path: { type: 'string', description: 'Directory to search within (use . for root)' }
                    },
                    required: ['pattern', 'path']
                }
            },
            {
                name: 'grep_search',
                description: 'Searches for exact text or regex within files inside a path',
                parameters: {
                    type: 'object',
                    properties: {
                        query: { type: 'string', description: 'Text or regex to search for' },
                        path: { type: 'string', description: 'File or directory path to search within' }
                    },
                    required: ['query', 'path']
                }
            },

            // Terminal
            {
                name: 'run_command',
                description: 'Executes a shell command',
                parameters: {
                    type: 'object',
                    properties: {
                        command: { type: 'string', description: 'The shell command to run' }
                    },
                    required: ['command']
                }
            },
            {
                name: 'command_status',
                description: 'Checks the status of an active background shell command',
                parameters: {
                    type: 'object',
                    properties: {
                        commandId: { type: 'string', description: 'The ID of the command to check' }
                    },
                    required: ['commandId']
                }
            },
            {
                name: 'send_command_input',
                description: 'Sends keyboard input (stdin) to a currently running background process',
                parameters: {
                    type: 'object',
                    properties: {
                        commandId: { type: 'string', description: 'The ID of the running command' },
                        input: { type: 'string', description: 'The text input to send' }
                    },
                    required: ['commandId', 'input']
                }
            }
        ];
    }
}
