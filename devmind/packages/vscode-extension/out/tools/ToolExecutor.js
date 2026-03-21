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
exports.ToolExecutor = void 0;
const vscode = __importStar(require("vscode"));
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const FileReadingTools_1 = require("./FileReadingTools");
const FileWritingTools_1 = require("./FileWritingTools");
const SearchTools_1 = require("./SearchTools");
const TerminalTools_1 = require("./TerminalTools");
class ToolExecutor {
    constructor() {
        this.fileReader = new FileReadingTools_1.FileReadingTools();
        this.fileWriter = new FileWritingTools_1.FileWritingTools();
        this.searcher = new SearchTools_1.SearchTools();
        this.terminal = new TerminalTools_1.TerminalTools();
        this.pinnedFiles = new Set();
    }
    getPinnedFiles() {
        return Array.from(this.pinnedFiles);
    }
    async executeTool(name, args) {
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
                    if (!workspaceFolders || workspaceFolders.length === 0)
                        return 'No workspace found to save knowledge.';
                    const cycyDir = path.join(workspaceFolders[0].uri.fsPath, '.cycy');
                    if (!fs.existsSync(cycyDir))
                        fs.mkdirSync(cycyDir);
                    const knPath = path.join(cycyDir, 'knowledge.md');
                    let content = args.knowledge;
                    if (fs.existsSync(knPath)) {
                        content = fs.readFileSync(knPath, 'utf-8') + '\n\n### ' + args.topic + '\n' + args.knowledge;
                    }
                    else {
                        content = '# Project Knowledge Base\n\n### ' + args.topic + '\n' + args.knowledge;
                    }
                    fs.writeFileSync(knPath, content);
                    return `Successfully added knowledge about '${args.topic}' to .cycy/knowledge.md`;
                }
                default:
                    return `Error: Unknown tool '${name}'`;
            }
        }
        catch (error) {
            return `Tool Execution Error: ${error.message}`;
        }
    }
    getToolSchemas() {
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
exports.ToolExecutor = ToolExecutor;
//# sourceMappingURL=ToolExecutor.js.map