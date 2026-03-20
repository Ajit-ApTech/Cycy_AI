import * as fs from 'fs/promises';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export interface ToolParams {
    [key: string]: any;
}

export interface ToolExecutionResult {
    success: boolean;
    output: string;
    error?: string;
}

export interface AgentTool {
    name: string;
    description: string;
    schema: any; // JSON schema for parameters
    execute: (params: ToolParams) => Promise<ToolExecutionResult>;
}

export class ToolRegistry {
    private tools: Map<string, AgentTool> = new Map();

    constructor() {
        this.registerDefaultTools();
    }

    public register(tool: AgentTool) {
        this.tools.set(tool.name, tool);
        console.log(`[ToolRegistry] Registered Tool: ${tool.name}`);
    }

    public getTool(name: string): AgentTool | undefined {
        return this.tools.get(name);
    }

    public getAvailableTools(): AgentTool[] {
        return Array.from(this.tools.values());
    }

    public async executeTool(name: string, params: ToolParams): Promise<ToolExecutionResult> {
        const tool = this.tools.get(name);
        if (!tool) {
            return {
                success: false,
                output: '',
                error: `Tool ${name} not found in registry.`
            };
        }

        try {
            return await tool.execute(params);
        } catch (e: any) {
            return {
                success: false,
                output: '',
                error: e.message || 'Unknown tool execution error'
            };
        }
    }

    private registerDefaultTools() {
        this.register({
            name: 'read_file',
            description: 'Reads the content of a file from the file system.',
            schema: {
                type: 'object',
                properties: {
                    filePath: { type: 'string', description: 'Absolute path to the file' }
                },
                required: ['filePath']
            },
            execute: async (params) => {
                const content = await fs.readFile(params.filePath, 'utf-8');
                return { success: true, output: content };
            }
        });

        this.register({
            name: 'write_file',
            description: 'Writes content to a file, overwriting existing content.',
            schema: {
                type: 'object',
                properties: {
                    filePath: { type: 'string', description: 'Absolute path to the file' },
                    content: { type: 'string', description: 'Content to write' }
                },
                required: ['filePath', 'content']
            },
            execute: async (params) => {
                await fs.mkdir(path.dirname(params.filePath), { recursive: true });
                await fs.writeFile(params.filePath, params.content, 'utf-8');
                return { success: true, output: `Successfully wrote to ${params.filePath}` };
            }
        });

        this.register({
            name: 'run_command',
            description: 'Runs a shell command in the specified directory.',
            schema: {
                type: 'object',
                properties: {
                    command: { type: 'string', description: 'The shell command to run' },
                    cwd: { type: 'string', description: 'Working directory to run in' }
                },
                required: ['command', 'cwd']
            },
            execute: async (params) => {
                // In Phase 4, commands triggered by the Agent should pass through CommandGate for approval
                // For now, in MVP form, execute directly but notify in logs
                console.log(`[ToolRegistry] Running command: ${params.command} in ${params.cwd}`);
                try {
                    const { stdout, stderr } = await execAsync(params.command, { cwd: params.cwd });
                    return { success: true, output: stdout || stderr };
                } catch (e: any) {
                    return { success: false, output: e.stdout || '', error: e.message || e.stderr };
                }
            }
        });
    }
}
