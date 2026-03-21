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
    getSystemPrompt(mode = 'fast') {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        const workspacePath = workspaceFolders && workspaceFolders.length > 0 ? workspaceFolders[0].uri.fsPath : 'No workspace open';
        let prompt = `You are Cycy AI, an elite agentic coding assistant integrated directly into VS Code (similar to Google Antigravity or GitHub Copilot).

CURRENT WORKSPACE ROOT: ${workspacePath}
You MUST restrict all your file reading, writing, and searching strictly to this workspace path. Do NOT attempt to read from or list root directories like '/' as it triggers OS permission errors.

CRITICAL BEHAVIORAL RULES:
1. USE TOOLS DIRECTLY: You have direct access to tools to read, write, edit files, and run terminal commands. Do NOT just print out code blocks for the user to copy-paste. You MUST use 'write_to_file' or 'replace_file_content' to apply the changes directly in the workspace.
2. DO NOT REPEAT CODE IN CHAT: When you use a tool to create or modify a file, DO NOT print the file contents in the chat message. Simply tell the user what you did in plain English. Keep your chat concise but comprehensive.
3. FILE OVERWRITES: It is perfectly acceptable to overwrite or edit an existing file when you are asked to make changes to it. However, if the user explicitly asks to create a "new" file, ensure you generate a novel filename to avoid overwriting their old work. Use 'list_dir' or 'find_by_name' if you need to check existing file names first.
4. AGENTIC WORKFLOW: You are an autonomous agent. If a task requires multiple steps, use the tools chained together to finish the entire task.
5. THINKING: Always show your step-by-step reasoning before taking any action. You MUST wrap your reasoning inside <think> and </think> tags.`;
        if (mode === 'plan') {
            prompt += `

PLANNING MODE ENABLED:
You are currently in Planning Mode. Your goal is to design a technical solution BEFORE taking any destructive actions.
1. RESEARCH: Use 'list_dir', 'grep_search', and 'view_file' to understand the codebase.
2. PLAN: You MUST use the 'write_to_file' tool to create a file named 'plan.md' in the workspace root containing your proposed plan. Do NOT just print the plan in the chat. The 'plan.md' file MUST include:
   - ## Goal: What are we doing?
   - ## Proposed Changes: Which files will be modified?
   - ## User Feedback: A blank section where the user can add notes.
3. STOP: After using the 'write_to_file' tool to write 'plan.md', explain that the plan is ready and wait for user approval.
4. EXECUTE: Only after the user approves (e.g., says "Approve" or "/approve-plan"), you should start the implementation.`;
        }
        return prompt;
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
    async sendMessage(message, mode = 'fast') {
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
            if (provider === 'gemini') {
                await this.streamGemini(model, apiKey, this._messageHistory, mode);
            }
            else {
                await this.streamOpenAI(provider, model, apiKey, this._messageHistory, mode);
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
    async streamGemini(model, key, messages, mode = 'fast') {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?key=${key}&alt=sse`;
        const geminiMessages = messages.map(m => ({
            role: m.role === 'assistant' ? 'model' : m.role === 'tool' ? 'function' : 'user',
            parts: [{ text: m.content }] // Simplified for text-only history stub
        }));
        const body = {
            systemInstruction: { parts: [{ text: this.getSystemPrompt(mode) }] },
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
                await this.streamGemini(model, key, this._messageHistory, mode);
            }
        }
    }
    async streamOpenAI(provider, model, key, messages, mode = 'fast') {
        const urls = {
            openai: 'https://api.openai.com/v1/chat/completions',
            groq: 'https://api.groq.com/openai/v1/chat/completions',
            nvidia: 'https://integrate.api.nvidia.com/v1/models', // corrected to models prefix if needed, using chat/completions usually
            ollama: 'http://localhost:11434/v1/chat/completions'
        };
        // Correcting common base paths if model names are used in URL for some providers like NVIDIA NIM
        if (provider === 'nvidia')
            urls.nvidia = 'https://integrate.api.nvidia.com/v1/chat/completions';
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
            const toolResults = [];
            // Execute all tools and collect results
            for (const [_, call] of pendingToolCalls.entries()) {
                let args;
                try {
                    args = JSON.parse(call.arguments || '{}');
                }
                catch (e) {
                    args = {}; // fallback if broken JSON
                }
                this._onToolExecutionStart.fire({ name: call.name, args });
                // Execute
                const result = await this._toolExecutor.executeTool(call.name, args);
                this._onToolExecutionEnd.fire({ name: call.name, args, result });
                // Truncate very large results to avoid exceeding API limits
                const truncatedResult = typeof result === 'string' && result.length > 8000
                    ? result.substring(0, 8000) + '\n...(truncated)'
                    : String(result);
                toolResults.push({ name: call.name, result: truncatedResult, parsedArgs: args });
            }
            // Always use native OpenAI format for all providers that support streamOpenAI
            // Push the assistant tool_calls message once
            const toolCallsMsg = { role: 'assistant', content: '', tool_calls: [] };
            let i = 0;
            for (const [_, c] of pendingToolCalls.entries()) {
                toolCallsMsg.tool_calls.push({
                    id: c.id,
                    type: 'function',
                    // CRITICAL: Ensure arguments is a rigorously valid JSON string, 
                    // otherwise strict servers like NVIDIA NIM will throw a 400 error on the next request 
                    function: { name: c.name, arguments: JSON.stringify(toolResults[i].parsedArgs) }
                });
                i++;
            }
            this._messageHistory.push(toolCallsMsg);
            // Push individual tool result messages
            let j = 0;
            for (const [_, call] of pendingToolCalls.entries()) {
                this._messageHistory.push({
                    role: 'tool',
                    tool_call_id: call.id,
                    name: call.name,
                    content: toolResults[j].result
                });
                j++;
            }
            // Recurse (Agentic Loop)
            if (!this._abortController?.signal.aborted) {
                await this.streamOpenAI(provider, model, key, this._messageHistory, mode);
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
        let isThinking = false;
        let cumulativeContent = '';
        let processedLength = 0;
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
                                    // Process the part text for thinking tags
                                    const result = this.parseThinkingTags(part.text, isThinking, cumulativeContent, processedLength);
                                    isThinking = result.isThinking;
                                    cumulativeContent = result.cumulativeContent;
                                    processedLength = result.processedLength;
                                    if (result.tokens.length > 0) {
                                        for (const t of result.tokens) {
                                            if (t.type === 'thought')
                                                this._onThinkingToken.fire(t.text);
                                            else
                                                onToken(t.text);
                                        }
                                    }
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
        // Final flush
        this.flushThinkingTags(onToken, isThinking, cumulativeContent, processedLength);
    }
    async readSSEStreamOpenAI(response, onToken, signal) {
        const reader = response.body?.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        if (!reader)
            return;
        let isThinking = false;
        let cumulativeContent = '';
        let processedLength = 0;
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
                    const data = line.slice(6).trim();
                    if (data === '[DONE]')
                        continue;
                    try {
                        const parsed = JSON.parse(data);
                        const delta = parsed.choices?.[0]?.delta;
                        if (delta?.content) {
                            const result = this.parseThinkingTags(delta.content, isThinking, cumulativeContent, processedLength);
                            isThinking = result.isThinking;
                            cumulativeContent = result.cumulativeContent;
                            processedLength = result.processedLength;
                            for (const t of result.tokens) {
                                if (t.type === 'thought') {
                                    this._onThinkingToken.fire(t.text);
                                }
                                else {
                                    onToken(t.text);
                                }
                            }
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
        // Final flush
        this.flushThinkingTags(onToken, isThinking, cumulativeContent, processedLength);
    }
    parseThinkingTags(newText, isThinking, cumulativeContent, processedLength) {
        cumulativeContent += newText;
        const tokens = [];
        const THINK_START = '<think>';
        const THINK_END = '</think>';
        while (true) {
            if (!isThinking) {
                const lower = cumulativeContent.toLowerCase();
                const startIdx = lower.indexOf(THINK_START, processedLength);
                if (startIdx !== -1) {
                    // Everything before <think> is text
                    const before = cumulativeContent.substring(processedLength, startIdx);
                    if (before)
                        tokens.push({ type: 'text', text: before });
                    isThinking = true;
                    processedLength = startIdx + THINK_START.length;
                }
                else {
                    // No full <think> tag found. Check for partial tag at the end.
                    const lastOpen = cumulativeContent.lastIndexOf('<');
                    let safeEnd = cumulativeContent.length;
                    if (lastOpen >= processedLength) {
                        const tail = lower.substring(lastOpen);
                        if (THINK_START.startsWith(tail)) {
                            safeEnd = lastOpen;
                        }
                    }
                    if (safeEnd > processedLength) {
                        tokens.push({ type: 'text', text: cumulativeContent.substring(processedLength, safeEnd) });
                        processedLength = safeEnd;
                    }
                    break;
                }
            }
            else {
                const lower = cumulativeContent.toLowerCase();
                const endIdx = lower.indexOf(THINK_END, processedLength);
                if (endIdx !== -1) {
                    // Everything before </think> is thought
                    const thought = cumulativeContent.substring(processedLength, endIdx);
                    if (thought)
                        tokens.push({ type: 'thought', text: thought });
                    isThinking = false;
                    processedLength = endIdx + THINK_END.length;
                }
                else {
                    // No full </think> tag found. Check for partial tag at the end.
                    const lastOpen = cumulativeContent.lastIndexOf('<');
                    let safeEnd = cumulativeContent.length;
                    if (lastOpen >= processedLength) {
                        const tail = lower.substring(lastOpen);
                        if (THINK_END.startsWith(tail)) {
                            safeEnd = lastOpen;
                        }
                    }
                    if (safeEnd > processedLength) {
                        tokens.push({ type: 'thought', text: cumulativeContent.substring(processedLength, safeEnd) });
                        processedLength = safeEnd;
                    }
                    break;
                }
            }
        }
        return { isThinking, cumulativeContent, processedLength, tokens };
    }
    flushThinkingTags(onToken, isThinking, cumulativeContent, processedLength) {
        if (processedLength < cumulativeContent.length) {
            const remaining = cumulativeContent.substring(processedLength);
            if (isThinking) {
                this._onThinkingToken.fire(remaining);
            }
            else {
                onToken(remaining);
            }
        }
    }
}
exports.AIService = AIService;
//# sourceMappingURL=AIService.js.map