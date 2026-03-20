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
exports.AIService = void 0;
const vscode = __importStar(require("vscode"));
const ToolExecutor_1 = require("../tools/ToolExecutor");
class AIService {
    get SYSTEM_PROMPT() {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        const workspacePath = workspaceFolders && workspaceFolders.length > 0 ? workspaceFolders[0].uri.fsPath : 'No workspace open';
        return `You are Cycy AI, an elite agentic coding assistant integrated directly into VS Code (similar to Google Antigravity or GitHub Copilot).

CURRENT WORKSPACE ROOT: ${workspacePath}
You MUST restrict all your file reading, writing, and searching strictly to this workspace path. Do NOT attempt to read from or list root directories like '/' as it triggers OS permission errors.

CRITICAL BEHAVIORAL RULES:
1. USE TOOLS DIRECTLY: You have direct access to tools to read, write, edit files, and run terminal commands. Do NOT just print out code blocks for the user to copy-paste. You MUST use 'write_to_file' or 'replace_file_content' to apply the changes directly in the workspace.
2. DO NOT REPEAT CODE IN CHAT: When you use a tool to create or modify a file, DO NOT print the file contents in the chat message. Simply tell the user what you did in plain English. Keep your chat extremely concise.
3. FILE OVERWRITES: It is perfectly acceptable to overwrite or edit an existing file when you are asked to make changes to it. However, if the user explicitly asks to create a "new" file, ensure you generate a novel filename to avoid overwriting their old work. Use 'list_dir' or 'find_by_name' if you need to check existing file names first.
4. EXPLAIN ACTIONS CONCISELY: Answer in 1-2 sentences. Example: "I have updated the logic in \`src/main.js\` to fix the bug."`;
    }
    constructor(settingsManager) {
        this.settingsManager = settingsManager;
        this._onToken = new vscode.EventEmitter();
        this._onThinkingToken = new vscode.EventEmitter();
        this._onError = new vscode.EventEmitter();
        this._onStreamingComplete = new vscode.EventEmitter();
        this._onToolExecutionStart = new vscode.EventEmitter();
        this._onToolExecutionEnd = new vscode.EventEmitter();
        this.onToken = this._onToken.event;
        this.onThinkingToken = this._onThinkingToken.event;
        this.onError = this._onError.event;
        this.onStreamingComplete = this._onStreamingComplete.event;
        this.onToolExecutionStart = this._onToolExecutionStart.event;
        this.onToolExecutionEnd = this._onToolExecutionEnd.event;
        this._messageHistory = [];
        this._isStreaming = false;
        this._abortController = null;
        this._toolExecutor = new ToolExecutor_1.ToolExecutor();
    }
    resetHistory() {
        this._messageHistory = [];
    }
    stop() {
        if (this._abortController) {
            this._abortController.abort();
        }
        this._isStreaming = false;
        this._onStreamingComplete.fire();
    }
    async fetchModels(provider, apiKey) {
        // Simple stub for model fetching; mapped directly from Electron App's ModelService
        const urls = {
            openai: 'https://api.openai.com/v1/models',
            groq: 'https://api.groq.com/openai/v1/models',
            nvidia: 'https://integrate.api.nvidia.com/v1/models',
            gemini: `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`,
            ollama: 'http://localhost:11434/api/tags'
        };
        const url = urls[provider];
        if (!url)
            throw new Error(`Unsupported provider: ${provider}`);
        const headers = {};
        if (apiKey && provider !== 'gemini' && provider !== 'ollama') {
            headers['Authorization'] = `Bearer ${apiKey}`;
        }
        try {
            const resp = await fetch(url, { headers });
            if (!resp.ok)
                throw new Error(`HTTP ${resp.status}`);
            const data = await resp.json();
            // Map the response
            if (provider === 'gemini')
                return data.models?.map((m) => m.name.replace('models/', '')) || [];
            if (provider === 'ollama')
                return data.models?.map((m) => m.name) || [];
            // OpenAI compatible (OpenAI, Groq, NVIDIA)
            return data.data?.map((m) => m.id) || [];
        }
        catch (e) {
            console.error(e);
            throw new Error('Failed to fetch models: ' + e.message);
        }
    }
    async sendMessage(message) {
        if (this._isStreaming)
            return;
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
            // Simplified LLM loop specifically for Gemini API to start (as default)
            // (In a full implementation, we abstract providers using an SDK or generic OpenAI REST)
            if (provider === 'gemini') {
                await this.streamGemini(model, apiKey, this._messageHistory);
            }
            else {
                // OpenAI compatible stub
                await this.streamOpenAI(provider, model, apiKey, this._messageHistory);
            }
        }
        catch (e) {
            if (e.name !== 'AbortError') {
                this._onError.fire(e.message);
            }
        }
        finally {
            this._isStreaming = false;
            this._abortController = null;
            this._onStreamingComplete.fire();
        }
    }
    async streamGemini(model, key, messages) {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?key=${key}&alt=sse`;
        const geminiMessages = messages.map(m => ({
            role: m.role === 'assistant' ? 'model' : m.role === 'tool' ? 'function' : 'user',
            parts: [{ text: m.content }] // Simplified for text-only history stub
        }));
        const body = {
            systemInstruction: { parts: [{ text: this.SYSTEM_PROMPT }] },
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
        let pendingFunctionCall = null;
        await this.readSSEStream(response, (text, functionCall) => {
            if (this._abortController?.signal.aborted)
                return;
            if (text)
                this._onToken.fire(text);
            if (functionCall)
                pendingFunctionCall = functionCall;
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
                await this.streamGemini(model, key, this._messageHistory);
            }
        }
    }
    async streamOpenAI(provider, model, key, messages) {
        const urls = {
            openai: 'https://api.openai.com/v1/chat/completions',
            groq: 'https://api.groq.com/openai/v1/chat/completions',
            nvidia: 'https://integrate.api.nvidia.com/v1/chat/completions',
            ollama: 'http://localhost:11434/v1/chat/completions'
        };
        const tools = this._toolExecutor.getToolSchemas().map(t => ({
            type: 'function',
            function: {
                name: t.name,
                description: t.description,
                parameters: t.parameters
            }
        }));
        const body = {
            model: model,
            messages: [
                { role: 'system', content: this.SYSTEM_PROMPT },
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
        const pendingToolCalls = new Map();
        await this.readSSEStreamOpenAI(response, (text, toolCallChunk) => {
            if (this._abortController?.signal.aborted)
                return;
            if (text)
                this._onToken.fire(text);
            if (toolCallChunk) {
                const { index, id, function: fn } = toolCallChunk;
                if (!pendingToolCalls.has(index)) {
                    pendingToolCalls.set(index, { id: id || '', name: fn?.name || '', arguments: '' });
                }
                if (id)
                    pendingToolCalls.get(index).id = id;
                if (fn?.name)
                    pendingToolCalls.get(index).name = fn.name;
                if (fn?.arguments)
                    pendingToolCalls.get(index).arguments += fn.arguments;
            }
        }, this._abortController?.signal);
        // Loop to execute tools if requested (Agentic Loop)
        if (pendingToolCalls.size > 0 && !this._abortController?.signal.aborted) {
            const toolCallsMsg = { role: 'assistant', content: null, tool_calls: [] };
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
                }
                catch (e) {
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
                await this.streamOpenAI(provider, model, key, this._messageHistory);
            }
        }
    }
    // SSE Parse Utilities
    async readSSEStream(response, onToken, signal) {
        const reader = response.body?.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        if (!reader)
            return;
        while (true) {
            if (signal?.aborted) {
                reader.cancel();
                break;
            }
            const { done, value } = await reader.read();
            if (done)
                break;
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';
            for (const line of lines) {
                if (line.startsWith('data: ')) {
                    const data = line.slice(6);
                    if (data === '[DONE]')
                        continue;
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
                    }
                    catch (e) { }
                }
            }
        }
    }
    async readSSEStreamOpenAI(response, onToken, signal) {
        const reader = response.body?.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        if (!reader)
            return;
        while (true) {
            if (signal?.aborted) {
                reader.cancel();
                break;
            }
            const { done, value } = await reader.read();
            if (done)
                break;
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';
            for (const line of lines) {
                if (line.startsWith('data: ')) {
                    const data = line.slice(6);
                    if (data.trim() === '[DONE]')
                        continue;
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
                    }
                    catch (e) { }
                }
            }
        }
    }
}
exports.AIService = AIService;
//# sourceMappingURL=AIService.js.map