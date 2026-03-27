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
exports.CycyChatViewProvider = void 0;
const vscode = __importStar(require("vscode"));
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const AIService_1 = require("../services/AIService");
class CycyChatViewProvider {
    constructor(_extensionUri, _settingsManager) {
        this._extensionUri = _extensionUri;
        this._settingsManager = _settingsManager;
        this._aiService = new AIService_1.AIService(this._settingsManager);
        // Setup AI Service listeners
        this._aiService.onToken((token) => {
            this._view?.webview.postMessage({ type: 'token', value: token });
        });
        this._aiService.onThinkingToken((token) => {
            this._view?.webview.postMessage({ type: 'thinkingToken', value: token });
        });
        this._aiService.onError((error) => {
            this._view?.webview.postMessage({ type: 'error', value: error });
        });
        this._aiService.onStreamingComplete(() => {
            this._view?.webview.postMessage({ type: 'stopStreaming' });
        });
        this._aiService.onToolExecutionStart(({ name, args }) => {
            this._view?.webview.postMessage({ type: 'toolStart', name, args });
        });
        this._aiService.onToolExecutionEnd(({ name, args, result }) => {
            this._view?.webview.postMessage({ type: 'toolEnd', name, args, result });
        });
        this._aiService.onConfirmationNeeded(({ id, name, args }) => {
            this._view?.webview.postMessage({ type: 'confirmCommand', id, name, args });
        });
    }
    resolveWebviewView(webviewView, context, _token) {
        this._view = webviewView;
        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this._extensionUri]
        };
        webviewView.webview.html = this._getHtmlForWebview();
        webviewView.webview.onDidReceiveMessage(async (data) => {
            switch (data.type) {
                case 'resolveConfirmation':
                    this._aiService.resolveConfirmation(data.id, data.approved);
                    break;
                case 'showTerminal':
                    const terminal = vscode.window.terminals.find(t => t.name === 'Cycy AI Exec');
                    if (terminal) {
                        terminal.show(false);
                    }
                    else {
                        vscode.window.showInformationMessage('No active terminal is running.');
                    }
                    break;
                case 'send':
                    this._aiService.sendMessage(data.message, data.mode, data.images);
                    break;
                case 'stop':
                    this._aiService.stop();
                    break;
                case 'setConfig':
                    await this._settingsManager.setProvider(data.provider);
                    await this._settingsManager.setModel(data.model);
                    if (data.apiKey) {
                        await this._settingsManager.setApiKey(data.provider, data.apiKey);
                    }
                    this._aiService.resetHistory();
                    break;
                case 'clearHistory':
                    this._aiService.resetHistory();
                    break;
                case 'ready':
                    // Send initial configuration to the webview
                    const provider = this._settingsManager.getProvider();
                    const model = this._settingsManager.getModel();
                    const apiKey = await this._settingsManager.getApiKey(provider);
                    webviewView.webview.postMessage({
                        type: 'init',
                        config: {
                            provider,
                            model,
                            hasKey: !!apiKey
                        }
                    });
                    break;
                case 'fetchModels':
                    try {
                        let keyToUse = data.apiKey;
                        if (!keyToUse) {
                            keyToUse = await this._settingsManager.getApiKey(data.provider);
                        }
                        const models = await this._aiService.fetchModels(data.provider, keyToUse);
                        webviewView.webview.postMessage({ type: 'modelsFetched', models });
                    }
                    catch (e) {
                        webviewView.webview.postMessage({ type: 'error', value: 'Failed to fetch models: ' + e.message });
                    }
                    break;
            }
        });
    }
    _getHtmlForWebview() {
        const htmlPath = path.join(this._extensionUri.fsPath, 'src', 'webview', 'chatView.html');
        try {
            return fs.readFileSync(htmlPath, 'utf-8');
        }
        catch (e) {
            return `<!DOCTYPE html><html><body>Error loading UI: ${e}</body></html>`;
        }
    }
}
exports.CycyChatViewProvider = CycyChatViewProvider;
CycyChatViewProvider.viewType = 'cycy-chat';
//# sourceMappingURL=CycyChatViewProvider.js.map