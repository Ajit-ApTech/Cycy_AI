import * as vscode from 'vscode';
import { SettingsManager } from './SettingsManager';
import { ToolExecutor } from '../tools/ToolExecutor';

export class AIService {
    private getSystemPrompt(mode: 'fast' | 'plan' = 'fast'): string {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        const workspacePath = workspaceFolders && workspaceFolders.length > 0 ? workspaceFolders[0].uri.fsPath : 'No workspace open';
        let prompt = `You are Cycy AI, an elite agentic coding assistant integrated directly into VS Code (similar to Google Antigravity or GitHub Copilot).

CURRENT WORKSPACE ROOT: ${workspacePath}
You MUST restrict all your file reading, writing, and searching strictly to this workspace path. Do NOT attempt to read from or list root directories like '/' as it triggers OS permission errors.

CRITICAL BEHAVIORAL RULES:
1. USE TOOLS DIRECTLY: You have direct access to tools to read, write, edit files, and run terminal commands. Do NOT just print out code blocks for the user to copy-paste. You MUST use 'write_to_file' or 'replace_file_content' to apply the changes directly in the workspace.
2. DO NOT REPEAT CODE IN CHAT: When you use a tool to create or modify a file, DO NOT print the file contents in the chat message. Simply tell the user what you did in plain English. Keep your chat concise but comprehensive.
3. FILE OVERWRITES: It is perfectly acceptable to overwrite or edit an existing file when you are asked to make changes to it. However, if the user explicitly asks to create a "new" file, ensure you generate a novel filename to avoid overwriting their old work. Use 'list_dir' or 'find_by_name' if you need to check existing file names first.
4. AGENTIC WORKFLOW: You are an autonomous agent. If a task requires multiple steps, use the tools chained together to finish the entire task.`;

        if (mode === 'plan') {
            prompt += `

PLANNING MODE ENABLED:
You are currently in Planning Mode. Your goal is to design a technical solution BEFORE taking any destructive actions.
1. RESEARCH: Use 'list_dir', 'grep_search', and 'view_file' to understand the codebase.
2. PLAN: Create a 'plan.md' file in the workspace root. It MUST include:
   - ## Goal: What are we doing?
   - ## Proposed Changes: Which files will be modified?
   - ## User Feedback: A blank section where the user can add notes.
3. STOP: After writing 'plan.md', explain that the plan is ready and wait for user approval.
4. EXECUTE: Only after the user approves (e.g., says "Approve" or "/approve-plan"), you should create a 'task.md' checklist and then start the implementation.`;
        }

        return prompt;
    }

    private _onToken = new vscode.EventEmitter<string>();
    private _onThinkingToken = new vscode.EventEmitter<string>();
    private _onError = new vscode.EventEmitter<string>();
    private _onStreamingComplete = new vscode.EventEmitter<void>();
    private _onToolExecutionStart = new vscode.EventEmitter<{name: string, args: any}>();
    private _onToolExecutionEnd = new vscode.EventEmitter<{name: string, args: any, result: string}>();
    
    public readonly onToken = this._onToken.event;
    public readonly onThinkingToken = this._onThinkingToken.event;
    public readonly onError = this._onError.event;
    public readonly onStreamingComplete = this._onStreamingComplete.event;
    public readonly onToolExecutionStart = this._onToolExecutionStart.event;
    public readonly onToolExecutionEnd = this._onToolExecutionEnd.event;

    private _messageHistory: any[] = [];
    private _isStreaming = false;
    private _abortController: AbortController | null = null;
    private _toolExecutor = new ToolExecutor();

    constructor(private readonly settingsManager: SettingsManager) {}

    public resetHistory() {
        this._messageHistory = [];
    }

    public stop() {
        if (this._abortController) {
            this._abortController.abort();
        }
        this._isStreaming = false;
        this._onStreamingComplete.fire();
    }

    public async fetchModels(provider: string, apiKey?: string): Promise<string[]> {
        // Simple stub for model fetching; mapped directly from Electron App's ModelService
        const urls: Record<string, string> = {
            openai: 'https://api.openai.com/v1/models',
            groq: 'https://api.groq.com/openai/v1/models',
            nvidia: 'https://integrate.api.nvidia.com/v1/models',
            gemini: `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`,
            ollama: 'http://localhost:11434/api/tags'
        };

        const url = urls[provider];
        if (!url) throw new Error(`Unsupported provider: ${provider}`);

        const headers: any = {};
        if (apiKey && provider !== 'gemini' && provider !== 'ollama') {
            headers['Authorization'] = `Bearer ${apiKey}`;
        }

        try {
            const resp = await fetch(url, { headers });
            if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
            
            const data: any = await resp.json();
            
            // Map the response
            if (provider === 'gemini') return data.models?.map((m: any) => m.name.replace('models/', '')) || [];
            if (provider === 'ollama') return data.models?.map((m: any) => m.name) || [];
            
            // OpenAI compatible (OpenAI, Groq, NVIDIA)
            return data.data?.map((m: any) => m.id) || [];
        } catch (e: any) {
            console.error(e);
            throw new Error('Failed to fetch models: ' + e.message);
        }
    }

    public async sendMessage(message: string, mode: 'fast' | 'plan' = 'fast') {
        if (this._isStreaming) return;
        
        const provider = this.settingsManager.getProvider();
        const model = this.settingsManager.getModel() || 'gemini-2.0-flash';
        const apiKey = await this.settingsManager.getApiKey(provider);

        if (!apiKey && provider !== 'ollama') {
            this._onError.fire(`Missing API Key for ${provider}. Please configure it first.`);
            this._onStreamingComplete.fire();
            return;
        }

        this._isStreaming = true;
        this._abortController = new AbortController();

        // Push user message
        this._messageHistory.push({ role: 'user', content: message });

        try {
            if (provider === 'gemini') {
                await this.streamGemini(model, apiKey!, this._messageHistory, mode);
            } else {
                await this.streamOpenAI(provider, model, apiKey!, this._messageHistory, mode);
            }

        } catch (e: any) {
            if (e.name !== 'AbortError') {
                this._onError.fire(e.message);
            }
        } finally {
            this._isStreaming = false;
            this._abortController = null;
            this._onStreamingComplete.fire();
        }
    }

    private async streamGemini(model: string, key: string, messages: any[], mode: 'fast' | 'plan' = 'fast') {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?key=${key}&alt=sse`;
        
        const geminiMessages = messages.map(m => ({
            role: m.role === 'assistant' ? 'model' : m.role === 'tool' ? 'function' : 'user',
            parts: [{ text: m.content }] // Simplified for text-only history stub
        }));

        const body: any = {
            systemInstruction: { parts: [{ text: this.getSystemPrompt(mode) }]},
            contents: geminiMessages,
            generationConfig: { temperature: 0.2 }
        };

        // Add tools schema
        const tools = this._toolExecutor.getToolSchemas();
        // Format for Gemini API
        body.tools = [{
            functionDeclarations: tools.map(t => ({
                name: t.name,
                description: t.description,
                parameters: t.parameters
            }))
        }];

        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
            signal: this._abortController?.signal
        });

        if (!response.ok) {
            const err = await response.text();
            throw new Error(`Gemini API Error: ${err}`);
        }

        let pendingFunctionCall: any = null;

        await this.readSSEStream(response, (text, functionCall) => {
            if (this._abortController?.signal.aborted) return;
            if (text) this._onToken.fire(text);
            if (functionCall) pendingFunctionCall = functionCall;
        }, this._abortController?.signal);

        // Loop to execute tool if requested (Agentic Loop)
        if (pendingFunctionCall && !this._abortController?.signal.aborted) {
            const args = pendingFunctionCall.args;
            this._onToolExecutionStart.fire({ name: pendingFunctionCall.name, args });
            
            // Execute
            const result = await this._toolExecutor.executeTool(pendingFunctionCall.name, args);
            
            this._onToolExecutionEnd.fire({ name: pendingFunctionCall.name, args, result });
            
            // Append back to history and recurse
            this._messageHistory.push({ role: 'assistant', content: `[Tool Call: ${pendingFunctionCall.name}]` });
            this._messageHistory.push({ role: 'tool', content: `Tool Result for ${pendingFunctionCall.name}:\n${result}` });
            
            // Recurse (Agentic Loop)
            if (!this._abortController?.signal.aborted) {
                await this.streamGemini(model, key, this._messageHistory, mode);
            }
        }
    }

    private async streamOpenAI(provider: string, model: string, key: string, messages: any[], mode: 'fast' | 'plan' = 'fast') {
        const urls: Record<string, string> = {
            openai: 'https://api.openai.com/v1/chat/completions',
            groq: 'https://api.groq.com/openai/v1/chat/completions',
            nvidia: 'https://integrate.api.nvidia.com/v1/models', // corrected to models prefix if needed, using chat/completions usually
            ollama: 'http://localhost:11434/v1/chat/completions'
        };
        
        // Correcting common base paths if model names are used in URL for some providers like NVIDIA NIM
        if (provider === 'nvidia') urls.nvidia = 'https://integrate.api.nvidia.com/v1/chat/completions';

        const tools = this._toolExecutor.getToolSchemas().map(t => ({
            type: 'function',
            function: {
                name: t.name,
                description: t.description,
                parameters: t.parameters
            }
        }));

        const body: any = {
            model: model,
            messages: [
                { role: 'system', content: this.getSystemPrompt(mode) },
                ...messages
            ],
            stream: true
        };

        // Ollama usually requires experimental or strict format for tools, but assuming standard OpenAI spec
        if (tools.length > 0 && provider !== 'ollama') {
            body.tools = tools;
        }

        const response = await fetch(urls[provider], {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...(provider !== 'ollama' && { 'Authorization': `Bearer ${key}` })
            },
            body: JSON.stringify(body),
            signal: this._abortController?.signal
        });

        if (!response.ok) {
            const err = await response.text();
            throw new Error(`API Error: ${err}`);
        }

        const pendingToolCalls = new Map<number, { id: string, name: string, arguments: string }>();

        await this.readSSEStreamOpenAI(response, (text, toolCallChunk) => {
            if (this._abortController?.signal.aborted) return;
            if (text) this._onToken.fire(text);
            
            if (toolCallChunk) {
                const { index, id, function: fn } = toolCallChunk;
                if (!pendingToolCalls.has(index)) {
                    pendingToolCalls.set(index, { id: id || '', name: fn?.name || '', arguments: '' });
                }
                if (id) pendingToolCalls.get(index)!.id = id;
                if (fn?.name) pendingToolCalls.get(index)!.name = fn.name;
                if (fn?.arguments) pendingToolCalls.get(index)!.arguments += fn.arguments;
            }
        }, this._abortController?.signal);

        // Loop to execute tools if requested (Agentic Loop)
        if (pendingToolCalls.size > 0 && !this._abortController?.signal.aborted) {
            const toolCallsMsg: any = { role: 'assistant', content: null, tool_calls: [] };
            
            for (const [_, call] of pendingToolCalls.entries()) {
                toolCallsMsg.tool_calls.push({
                    id: call.id,
                    type: 'function',
                    function: { name: call.name, arguments: call.arguments }
                });
            }
            this._messageHistory.push(toolCallsMsg);

            for (const [_, call] of pendingToolCalls.entries()) {
                let args;
                try {
                    args = JSON.parse(call.arguments);
                } catch (e) {
                    args = {}; // fallback if broken JSON
                }

                this._onToolExecutionStart.fire({ name: call.name, args });

                // Execute
                const result = await this._toolExecutor.executeTool(call.name, args);
                this._onToolExecutionEnd.fire({ name: call.name, args, result });

                this._messageHistory.push({
                    role: 'tool',
                    tool_call_id: call.id,
                    name: call.name,
                    content: result
                });
            }
            
            // Recurse (Agentic Loop)
            if (!this._abortController?.signal.aborted) {
                await this.streamOpenAI(provider, model, key, this._messageHistory, mode);
            }
        }
    }

    // SSE Parse Utilities
    private async readSSEStream(response: Response, onToken: (text: string, functionCall?: any) => void, signal?: AbortSignal) {
        const reader = response.body?.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        if (!reader) return;

        while (true) {
            if (signal?.aborted) {
                reader.cancel();
                break;
            }
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
                if (line.startsWith('data: ')) {
                    const data = line.slice(6);
                    if (data === '[DONE]') continue;
                    try {
                        const parsed = JSON.parse(data);
                        const parts = parsed.candidates?.[0]?.content?.parts;
                        if (parts && parts.length > 0) {
                            for (const part of parts) {
                                if (part.text) {
                                    onToken(part.text);
                                }
                                if (part.thought) {
                                    this._onThinkingToken.fire(part.thought);
                                }
                                if (part.functionCall) {
                                    onToken('', part.functionCall);
                                }
                            }
                        }
                    } catch (e) {}
                }
            }
        }
    }

    private async readSSEStreamOpenAI(response: Response, onToken: (text: string, toolCallChunk?: any) => void, signal?: AbortSignal) {
        const reader = response.body?.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        if (!reader) return;

        while (true) {
            if (signal?.aborted) {
                reader.cancel();
                break;
            }
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
                if (line.startsWith('data: ')) {
                    const data = line.slice(6);
                    if (data.trim() === '[DONE]') continue;
                    try {
                        const parsed = JSON.parse(data);
                        const delta = parsed.choices?.[0]?.delta;
                        
                        if (delta?.content) {
                            onToken(delta.content);
                        }

                        if (delta?.reasoning_content) {
                            this._onThinkingToken.fire(delta.reasoning_content);
                        }
                        
                        if (delta?.tool_calls) {
                            for (const call of delta.tool_calls) {
                                onToken('', call);
                            }
                        }
                    } catch (e) {}
                }
            }
        }
    }
}
