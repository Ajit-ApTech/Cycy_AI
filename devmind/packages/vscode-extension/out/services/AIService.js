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
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const ToolExecutor_1 = require("../tools/ToolExecutor");
class AIService {
    generateWorkspaceTree(dirPath, depth = 0, maxDepth = 3) {
        if (depth > maxDepth)
            return '';
        let tree = '';
        const excludeDirs = new Set(['node_modules', '.git', 'out', 'dist', 'build', '.vscode', '.cycy']);
        try {
            const items = fs.readdirSync(dirPath, { withFileTypes: true });
            // Sort: directories first, then files
            items.sort((a, b) => {
                if (a.isDirectory() && !b.isDirectory())
                    return -1;
                if (!a.isDirectory() && b.isDirectory())
                    return 1;
                return a.name.localeCompare(b.name);
            });
            for (const item of items) {
                // Skip hidden files and excluded directories
                if (item.name.startsWith('.') && item.name !== '.gitignore' && item.name !== '.env.example')
                    continue;
                if (item.isDirectory() && excludeDirs.has(item.name))
                    continue;
                const indent = '  '.repeat(depth);
                const prefix = item.isDirectory() ? '📂 ' : '📄 ';
                tree += `${indent}${prefix}${item.name}\n`;
                if (item.isDirectory()) {
                    tree += this.generateWorkspaceTree(path.join(dirPath, item.name), depth + 1, maxDepth);
                }
            }
        }
        catch (e) {
            // ignore read errors
        }
        return tree;
    }
    getSystemPrompt(mode = 'fast') {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        const workspacePath = workspaceFolders && workspaceFolders.length > 0 ? workspaceFolders[0].uri.fsPath : 'No workspace open';
        let workspaceTree = '';
        if (workspacePath !== 'No workspace open') {
            const treeLimit = this.generateWorkspaceTree(workspacePath, 0, 3);
            if (treeLimit.trim().length > 0) {
                workspaceTree = '\n\nWORKSPACE FILE TREE (Depth 3):\n' + treeLimit;
            }
        }
        let pinnedContext = '';
        const pinnedFiles = this._toolExecutor.getPinnedFiles();
        if (pinnedFiles.length > 0) {
            pinnedContext = '\n\nPINNED FILES CONTEXT:\n' + pinnedFiles.map(filePath => {
                try {
                    const content = fs.readFileSync(filePath, 'utf-8');
                    return `--- Start of Pinned File: ${filePath} ---\n${content}\n--- End of Pinned File ---`;
                }
                catch (e) {
                    return `--- Error reading pinned file: ${filePath} ---`;
                }
            }).join('\n\n');
        }
        let knowledgeContext = '';
        if (workspacePath !== 'No workspace open') {
            const knPath = path.join(workspacePath, '.cycy', 'knowledge.md');
            if (fs.existsSync(knPath)) {
                try {
                    const knContent = fs.readFileSync(knPath, 'utf-8');
                    knowledgeContext = '\n\nPROJECT KNOWLEDGE BASE:\nThe following rules and patterns MUST be followed for this project:\n' + knContent;
                }
                catch (e) { }
            }
        }
        let prompt = `You are Cycy AI, an elite agentic coding assistant integrated directly into VS Code (similar to Google Antigravity or GitHub Copilot).

CURRENT WORKSPACE ROOT: ${workspacePath}${workspaceTree}${pinnedContext}${knowledgeContext}
You MUST restrict all your file reading, writing, and searching strictly to this workspace path. Do NOT attempt to read from or list root directories like '/' as it triggers OS permission errors.

CRITICAL BEHAVIORAL RULES:
1. USE TOOLS DIRECTLY: You have direct access to tools to read, write, edit files, and run terminal commands. Do NOT just print out code blocks for the user to copy-paste. You MUST use 'write_to_file' or 'replace_file_content' to apply the changes directly in the workspace.
2. DO NOT REPEAT CODE IN CHAT: When you use a tool to create or modify a file, DO NOT print the file contents in the chat message. Simply tell the user what you did in plain English. Keep your chat concise but comprehensive.
3. FILE OVERWRITES: It is perfectly acceptable to overwrite or edit an existing file when you are asked to make changes to it. However, if the user explicitly asks to create a "new" file, ensure you generate a novel filename to avoid overwriting their old work. Use 'list_dir' or 'find_by_name' if you need to check existing file names first.
4. AGENTIC WORKFLOW: You are an autonomous agent. If a task requires multiple steps, use the tools chained together to finish the entire task.
The user's ORIGINAL PROMPT is your PRIMARY source of truth — not the checklist. The checklist is only a progress tracker.
If the user asks you to implement a multistep plan:
- FIRST, create a 'task.md' file. It MUST start with a '## Original Request' section that contains the user's FULL original prompt copied VERBATIM — do not summarize or shorten it. Below that, add a '## Checklist' section with DETAILED step-by-step tasks. Each task item MUST include a brief explanation of the technical implementation (e.g., '[ ] Task 1: Update AIService.ts to include the new validation logic in getSystemPrompt'). This ensures you have a clear execution path for each step.
- BEFORE executing each step, RE-READ the '## Original Request' section in 'task.md' to ensure your next action is aligned with the user's actual instructions, not just the checklist item title.
- Execute the tasks step by step. As you complete each step, use 'replace_file_content' to update 'task.md' and mark the task as done (e.g. \`[x] Task 1\`).
- DO NOT recreate 'task.md' from scratch with 'write_to_file' once it exists.
- COMPLIANCE CHECK: When all checklist items are marked done, re-read the '## Original Request' one final time. Verify that EVERY specific requirement, instruction, and detail from the user's original prompt has been addressed. If anything was missed, add new checklist items and complete them before declaring done.
- Only after the compliance check passes, output your final result to the user.
5. THINKING: Always show your step-by-step reasoning before taking any action. You MUST wrap your private reasoning completely inside <think> and </think> tags. Keep reasoning analytical and concise. NEVER dump long code blocks, raw HTML, or JSON outputs inside <think> tags. The user CANNOT see what is inside <think> tags. Your final response or question to the user MUST be OUTSIDE the <think> tags.
6. EXPLORE SMARTLY: You already have the workspace directory tree in your context. Do not use 'list_dir' on the project root. When exploring unknown files, ALWAYS use 'view_file_outline' first to get the structural layout before committing to reading the entire file with 'view_file'.
7. PIN CONTEXT: If you are tasked with heavily modifying a specific file or need to frequently reference a core utility file, proactively use 'pin_file' to inject it into your permanent memory. Use 'unpin_file' when you no longer need it.
8. BUILD KNOWLEDGE: If you discover a strict architectural pattern in the codebase, or if the user explicitly gives you a project rule (e.g., 'we use Tailwind', 'all APIs must be wrapped in a specific JSON'), you MUST proactively use the 'update_project_knowledge' tool to memorize it.
9. VISION CAPABILITIES: The user can attach screenshots to their messages. You are able to see and analyze them natively for visual debugging, UI evaluation, and understanding errors!
10. TARGETED EDITS ONLY: When you need to make a small change to an existing file (e.g., fix a CSS path, update a variable, change one line), you MUST use 'replace_file_content' with the exact text to find and replace. NEVER rewrite an entire file using 'write_to_file' just to change a few characters or lines.
11. SMART FILE READING: The 'view_file' tool caps output at 200 lines by default. If you only need to check a header or link in a file, use startLine and endLine to read just those lines (e.g., startLine: 1, endLine: 20 for the HTML head). Do NOT read an entire 500-line file when you only need 10 lines.
12. CORRECT TOOL ARGUMENTS: Always use the exact argument names documented in the tool schemas. The argument for file path is always "path" (not "file_path", "TargetFile", or "filename"). The arguments for replace_file_content are "path", "targetText", and "replacementText". NEVER wrap tool calls in markdown blocks (e.g., \`\`\`json). Output them directly. If you are a model that must output tool calls as text, use the <invoke> format without any extra text before or after.
13. HONESTY ABOUT ERRORS: If a tool call returns an error message (e.g., "File not found", "Error writing to file"), you MUST report this failure to the user honestly. NEVER claim that you successfully completed an action if the tool returned an error. Instead, explain the error and try a different approach.
14. SELF-CORRECTION: If a tool call fails, carefully re-read the error message. It often tells you exactly what went wrong (e.g., missing argument, wrong path). Fix the specific issue and retry with the corrected arguments. Do NOT try a completely different tool or approach unless the original approach is fundamentally wrong.
15. VERIFY YOUR WORK: After making changes, ALWAYS verify the content you just wrote. Do NOT just check if the file exists. Use 'view_file' with targeted line ranges to verify that specific classes, objects, or core logic you implemented are correct and error-free. You MUST confirm this internal correctness BEFORE proceeding to the next task in your checklist. Only tell the user the overall job is done after this verification succeeds.
16. TERMINAL OBSERVATION: When you use 'run_command' (especially for long-running scripts like npm install or dev servers), the process runs in the background. You MUST proactively use the 'command_status' tool to check its output, verify it executed successfully, and read any error messages it produced.
17. TOOL SELECTION & CONSTRAINTS: Prioritize specialized tools ('list_dir', 'view_file', 'grep_search', 'replace_file_content') over their generic shell equivalents ('ls', 'cat', 'grep', 'sed'). NEVER use 'run_command' with 'cat', 'sed', or redirections ('>') to modify or read files. Before executing any tool, identify ALL relevant tools required for the entire task to ensure a mindful and efficient execution plan.
18. NEW EXPANDED TOOLSET: You are fully equipped with Web Access (use 'WebSearch' & 'WebFetch' to query internet and read sites), Advanced Execution (use 'REPL' for instantaneous Node/Python subprocess runs instead of heavy run_command where applicable), Project Tasks (use 'TodoWrite' to update task trackers), and foundational Git capabilities (git_status, git_diff, git_commit). Utilize these specialized tools natively!`;
        if (mode === 'plan') {
            prompt += `

PLANNING MODE ENABLED:
You are currently in Planning Mode. Your goal is to design a technical solution BEFORE taking any destructive actions.
1. RESEARCH: Formulate your implementation approach by referencing the provided WORKSPACE FILE TREE, utilizing 'view_file_outline' for rapid file analysis, and using 'grep_search' for deep codebase searches.
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
        this._onConfirmationNeeded = new vscode.EventEmitter();
        this.onToken = this._onToken.event;
        this.onThinkingToken = this._onThinkingToken.event;
        this.onError = this._onError.event;
        this.onStreamingComplete = this._onStreamingComplete.event;
        this.onToolExecutionStart = this._onToolExecutionStart.event;
        this.onToolExecutionEnd = this._onToolExecutionEnd.event;
        this.onConfirmationNeeded = this._onConfirmationNeeded.event;
        this._messageHistory = [];
        this._isStreaming = false;
        this._abortController = null;
        this._toolExecutor = new ToolExecutor_1.ToolExecutor();
        this._toolExecutor.onConfirmationNeeded(event => {
            this._onConfirmationNeeded.fire(event);
        });
    }
    resolveConfirmation(id, approved) {
        this._toolExecutor.resolveConfirmation(id, approved);
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
        const ollamaBaseUrl = this.settingsManager.getOllamaUrl().replace(/\/$/, '');
        const customHeadersRaw = this.settingsManager.getCustomHeaders();
        let customHeaders = {};
        try {
            if (customHeadersRaw) {
                customHeaders = JSON.parse(customHeadersRaw);
            }
        }
        catch (e) {
            console.error('Failed to parse custom headers JSON', e);
        }
        const urls = {
            openai: 'https://api.openai.com/v1/models',
            groq: 'https://api.groq.com/openai/v1/models',
            nvidia: 'https://integrate.api.nvidia.com/v1/models',
            gemini: `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`,
            ollama: `${ollamaBaseUrl}/api/tags`
        };
        const url = urls[provider];
        if (!url)
            throw new Error(`Unsupported provider: ${provider}`);
        const fetchWithTimeout = async (u, opts, timeout = 5000) => {
            const controller = new AbortController();
            const id = setTimeout(() => controller.abort(), timeout);
            try {
                const resp = await fetch(u, { ...opts, signal: controller.signal });
                clearTimeout(id);
                return resp;
            }
            catch (e) {
                clearTimeout(id);
                throw e;
            }
        };
        const headers = { ...customHeaders };
        if (apiKey && provider !== 'gemini') {
            headers['Authorization'] = `Bearer ${apiKey}`;
        }
        try {
            if (provider === 'ollama') {
                const modelNames = new Set();
                const parseModels = (data) => {
                    if (Array.isArray(data)) {
                        data.forEach((m) => {
                            if (typeof m === 'string')
                                modelNames.add(m);
                            else if (m.id)
                                modelNames.add(m.id);
                            else if (m.name)
                                modelNames.add(m.name);
                        });
                    }
                    else if (data && typeof data === 'object') {
                        // Handle { models: [...] } or { data: [...] }
                        const list = data.models || data.data || data.model_list;
                        if (Array.isArray(list)) {
                            list.forEach((m) => {
                                if (typeof m === 'string')
                                    modelNames.add(m);
                                else if (m.id)
                                    modelNames.add(m.id);
                                else if (m.name)
                                    modelNames.add(m.name);
                            });
                        }
                    }
                };
                // 1. Try native Ollama tags endpoint
                try {
                    const resp = await fetchWithTimeout(url, { headers });
                    if (resp.ok) {
                        const data = await resp.json();
                        parseModels(data);
                    }
                }
                catch (e) {
                    console.warn('Ollama tags endpoint failed', e);
                }
                // 2. Try OpenAI compatible v1/models
                try {
                    const v1Url = `${ollamaBaseUrl}/v1/models`;
                    const resp = await fetchWithTimeout(v1Url, { headers });
                    if (resp.ok) {
                        const data = await resp.json();
                        parseModels(data);
                    }
                }
                catch (e) {
                    console.warn('Ollama v1/models endpoint failed', e);
                }
                return Array.from(modelNames);
            }
            const resp = await fetch(url, { headers });
            if (!resp.ok)
                throw new Error(`HTTP ${resp.status}`);
            const data = await resp.json();
            // Map the response
            if (provider === 'gemini')
                return data.models?.map((m) => m.name.replace('models/', '')) || [];
            // OpenAI compatible (OpenAI, Groq, NVIDIA)
            return data.data?.map((m) => m.id) || [];
        }
        catch (e) {
            console.error(e);
            throw new Error('Failed to fetch models: ' + e.message);
        }
    }
    async sendMessage(message, mode = 'fast', images = []) {
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
        this._messageHistory.push({ role: 'user', content: message, images });
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
        const geminiMessages = messages.map(m => {
            const parts = [{ text: m.content || " " }];
            if (m.images && m.images.length > 0) {
                m.images.forEach((b64) => {
                    const match = b64.match(/^data:(image\/\w+);base64,(.*)$/);
                    if (match) {
                        parts.push({
                            inlineData: { mimeType: match[1], data: match[2] }
                        });
                    }
                });
            }
            return {
                role: m.role === 'assistant' ? 'model' : m.role === 'tool' ? 'function' : 'user',
                parts
            };
        });
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
        const fullRawContent = await this.readSSEStream(response, (text, functionCall) => {
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
            this._messageHistory.push({ role: 'assistant', content: (fullRawContent ? fullRawContent + '\n' : '') + `[Tool Call: ${pendingFunctionCall.name}]` });
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
        const openAIMessages = messages.map(m => {
            if (m.images && m.images.length > 0 && m.role === 'user') {
                const contentParts = [{ type: 'text', text: m.content || " " }];
                m.images.forEach((b64) => {
                    contentParts.push({
                        type: 'image_url',
                        image_url: { url: b64 }
                    });
                });
                return { role: m.role, content: contentParts };
            }
            return { role: m.role, content: m.content || " " };
        });
        const body = {
            model: model,
            messages: [
                { role: 'system', content: this.getSystemPrompt(mode) },
                ...openAIMessages
            ],
            stream: true,
            ...(provider === 'ollama' && { think: true })
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
        const fullRawContent = await this.readSSEStreamOpenAI(response, (text, toolCallChunk) => {
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
        // Fallback: If no structured tool calls were detected (common with local models like Ollama), 
        // search for XML-based tool calls in the content
        if (pendingToolCalls.size === 0 && !this._abortController?.signal.aborted) {
            const invokeRegex = /<invoke\s+name=["']([^"']+)["']\s*>([\s\S]*?)<\/invoke>/g;
            let match;
            let callIndex = 0;
            while ((match = invokeRegex.exec(fullRawContent)) !== null) {
                const name = match[1];
                const paramsBlock = match[2];
                const args = {};
                const paramRegex = /<parameter\s+name=["']([^"']+)["']\s*>([\s\S]*?)<\/parameter>/g;
                let pMatch;
                while ((pMatch = paramRegex.exec(paramsBlock)) !== null) {
                    args[pMatch[1]] = pMatch[2].trim();
                }
                pendingToolCalls.set(callIndex, {
                    id: `call_${Date.now()}_${callIndex}`,
                    name: name,
                    arguments: JSON.stringify(args)
                });
                callIndex++;
            }
        }
        // Loop to execute tools if requested (Agentic Loop)
        if (pendingToolCalls.size > 0 && !this._abortController?.signal.aborted) {
            const toolResults = [];
            // Execute all tools and collect results
            for (const [_, call] of pendingToolCalls.entries()) {
                let argsString = call.arguments || '';
                // Fallback: If arguments are empty or "{}" but content contains JSON (e.g., Llama 3 API bug)
                const isArgsEmpty = !argsString.trim() || argsString.trim() === '{}' || argsString.trim() === 'null';
                if (isArgsEmpty && fullRawContent.includes('{')) {
                    // Custom bracket matcher to extract the last valid JSON object from content
                    let bestJson = '';
                    for (let i = fullRawContent.lastIndexOf('{'); i >= 0; i--) {
                        if (fullRawContent[i] === '{') {
                            let depth = 0;
                            for (let j = i; j < fullRawContent.length; j++) {
                                if (fullRawContent[j] === '{')
                                    depth++;
                                if (fullRawContent[j] === '}') {
                                    depth--;
                                    if (depth === 0) {
                                        const possibleJson = fullRawContent.substring(i, j + 1);
                                        if (possibleJson.includes(call.name) || possibleJson.includes('arguments') || possibleJson.includes('path')) {
                                            bestJson = possibleJson;
                                        }
                                        break; // Found matching closing brace
                                    }
                                }
                            }
                            if (bestJson)
                                break;
                        }
                    }
                    if (bestJson) {
                        argsString = bestJson;
                    }
                    else {
                        // Fallback to simple regex if bracket matching fails
                        const contentMatch = fullRawContent.match(/\{[\s\S]*\}/);
                        if (contentMatch)
                            argsString = contentMatch[0];
                    }
                }
                // Clean up common LLM hallucinations in tool arguments
                argsString = argsString.replace(/<\/tool_call>[\s\S]*$/, '');
                argsString = argsString.replace(/^[\s\S]*?<tool_call>/, '');
                argsString = argsString.replace(/```json/g, '').replace(/```/g, '').trim();
                let args;
                try {
                    // Pre-process common hallucinated JSON issues: unescaped newlines and single quotes
                    let cleanArgsString = argsString
                        .replace(/(?!\\)\n/g, '\\n') // Fix unescaped newlines inside strings
                        .replace(/\'/g, '\\"'); // Some LLMs output single quotes instead of double
                    args = JSON.parse(cleanArgsString || '{}');
                    // Handle NVIDIA NIM Llama 3 edge case where JSON includes 'arguments/parameters' root keys
                    if (args && (args.arguments || args.parameters || args.args) && Object.keys(args).length <= 3) {
                        const innerArgs = args.arguments || args.parameters || args.args;
                        try {
                            args = typeof innerArgs === 'string' ? JSON.parse(innerArgs) : innerArgs;
                        }
                        catch (e) {
                            args = innerArgs;
                        }
                    }
                }
                catch (e) {
                    // One more try: extract just the JSON object and strip aggressive markdown
                    const match = argsString.match(/\{[\s\S]*\}/);
                    if (match) {
                        try {
                            let cleanMatch = match[0]
                                .replace(/(?!\\)\n/g, '\\n')
                                .replace(/\'/g, '\\"');
                            args = JSON.parse(cleanMatch);
                            if (args && (args.arguments || args.parameters || args.args) && Object.keys(args).length <= 3) {
                                const innerArgs = args.arguments || args.parameters || args.args;
                                args = typeof innerArgs === 'string' ? JSON.parse(innerArgs) : innerArgs;
                            }
                        }
                        catch (e2) {
                            console.error(`Cycy UI: Tool Arg Parsing Failed completely. Raw: ${argsString}`);
                            args = { _parseError: true, raw: argsString };
                        }
                    }
                    else {
                        console.error(`Cycy UI: No JSON found in Tool Args. Raw: ${argsString}`);
                        args = { _parseError: true, raw: argsString };
                    }
                }
                this._onToolExecutionStart.fire({ name: call.name, args: args && !args._parseError ? args : {} });
                let result;
                if (args && args._parseError) {
                    result = `Tool Execution Error: Failed to parse JSON arguments for tool '${call.name}'. You output invalid JSON. Make sure to output valid JSON arguments without extra text or markdown. Raw output was: ${args.raw}`;
                }
                else {
                    result = await this._toolExecutor.executeTool(call.name, args);
                }
                this._onToolExecutionEnd.fire({ name: call.name, args: args && !args._parseError ? args : {}, result });
                // Truncate very large results to avoid exceeding API limits
                const truncatedResult = typeof result === 'string' && result.length > 8000
                    ? result.substring(0, 8000) + '\n...(truncated)'
                    : String(result);
                toolResults.push({ name: call.name, result: truncatedResult, parsedArgs: args && !args._parseError ? args : {} });
            }
            // Always use native OpenAI format for all providers that support streamOpenAI
            // Push the assistant tool_calls message once
            const toolCallsMsg = { role: 'assistant', content: fullRawContent || '', tool_calls: [] };
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
            return '';
        let isThinking = false;
        let cumulativeContent = '';
        let processedLength = 0;
        let fullRawContent = '';
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
                                    fullRawContent += part.text;
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
                                if (part.reasoning_content) {
                                    this._onThinkingToken.fire(part.reasoning_content);
                                }
                                if (part.reasoning) {
                                    this._onThinkingToken.fire(part.reasoning);
                                }
                                if (part.thinking) {
                                    this._onThinkingToken.fire(part.thinking);
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
        return fullRawContent;
    }
    async readSSEStreamOpenAI(response, onToken, signal) {
        const reader = response.body?.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        if (!reader)
            return '';
        let isThinking = false;
        let cumulativeContent = '';
        let processedLength = 0;
        let fullRawContent = '';
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
                            fullRawContent += delta.content;
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
                        if (delta?.reasoning) {
                            this._onThinkingToken.fire(delta.reasoning);
                        }
                        if (delta?.thinking) {
                            this._onThinkingToken.fire(delta.thinking);
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
        return fullRawContent;
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