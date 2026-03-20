import * as vscode from 'vscode';
import { FileReadingTools } from './FileReadingTools';
import { FileWritingTools } from './FileWritingTools';
import { SearchTools } from './SearchTools';
import { TerminalTools } from './TerminalTools';

export class ToolExecutor {
    private fileReader = new FileReadingTools();
    private fileWriter = new FileWritingTools();
    private searcher = new SearchTools();
    private terminal = new TerminalTools();

    public async executeTool(name: string, args: any): Promise<string> {
        try {
            switch (name) {
                // File Reading
                case 'view_file': return await this.fileReader.viewFile(args.path, args.startLine, args.endLine);
                case 'view_file_outline': return await this.fileReader.viewFileOutline(args.path);
                case 'view_code_item': return await this.fileReader.viewCodeItem(args.path, args.itemName);
                
                // File Writing
                case 'write_to_file': return await this.fileWriter.writeToFile(args.path, args.content, args.overwrite);
                case 'replace_file_content': return await this.fileWriter.replaceContent(args.path, args.targetText, args.replacementText);
                case 'multi_replace_file_content': return await this.fileWriter.multiReplaceContent(args.path, args.replacements);
                
                // Search
                case 'list_dir': return await this.searcher.listDir(args.path);
                case 'grep_search': return await this.searcher.grepSearch(args.query, args.path);
                case 'codebase_search': return await this.searcher.codebaseSearch(args.query);
                case 'find_by_name': return await this.searcher.findByName(args.pattern, args.path);
                
                // Terminal
                case 'run_command': return await this.terminal.runCommand(args.command);
                case 'command_status': return await this.terminal.commandStatus(args.commandId);
                case 'send_command_input': return await this.terminal.sendCommandInput(args.commandId, args.input);
                
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
                description: 'Reads contents of a file',
                parameters: {
                    type: 'object',
                    properties: {
                        path: { type: 'string', description: 'Absolute path to the file' },
                        startLine: { type: 'number', description: 'Optional start line' },
                        endLine: { type: 'number', description: 'Optional end line' }
                    },
                    required: ['path']
                }
            },
            {
                name: 'view_file_outline',
                description: 'Gets the structural outline of a file (symbols, functions, classes)',
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
                description: 'Creates or overwrites a file with content',
                parameters: {
                    type: 'object',
                    properties: {
                        path: { type: 'string', description: 'Absolute path to the file' },
                        content: { type: 'string', description: 'The exact content to write' },
                        overwrite: { type: 'boolean', description: 'Whether to overwrite if it exists' }
                    },
                    required: ['path', 'content']
                }
            },
            {
                name: 'replace_file_content',
                description: 'Replaces specific text in an existing file',
                parameters: {
                    type: 'object',
                    properties: {
                        path: { type: 'string', description: 'Absolute path to the file' },
                        targetText: { type: 'string', description: 'The exact text to find and replace' },
                        replacementText: { type: 'string', description: 'The new text to insert' }
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
