import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { AIService } from '../services/AIService';
import { SettingsManager } from '../services/SettingsManager';

export class CycyChatViewProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = 'cycy-chat';
    private _view?: vscode.WebviewView;
    private _aiService: AIService;

    constructor(
        private readonly _extensionUri: vscode.Uri,
        private readonly _settingsManager: SettingsManager
    ) {
        this._aiService = new AIService(this._settingsManager);
        
        // Setup AI Service listeners
        this._aiService.onToken((token: string) => {
            this._view?.webview.postMessage({ type: 'token', value: token });
        });
        
        this._aiService.onThinkingToken((token: string) => {
            this._view?.webview.postMessage({ type: 'thinkingToken', value: token });
        });
        
        this._aiService.onError((error: string) => {
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
    }

    public resolveWebviewView(
        webviewView: vscode.WebviewView,
        context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken,
    ) {
        this._view = webviewView;

        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this._extensionUri]
        };

        webviewView.webview.html = this._getHtmlForWebview();

        webviewView.webview.onDidReceiveMessage(async (data) => {
            switch (data.type) {
                case 'send':
                    this._aiService.sendMessage(data.message);
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
                    } catch (e: any) {
                        webviewView.webview.postMessage({ type: 'error', value: 'Failed to fetch models: ' + e.message });
                    }
                    break;
            }
        });
    }

    private _getHtmlForWebview(): string {
        const htmlPath = path.join(this._extensionUri.fsPath, 'src', 'webview', 'chatView.html');
        try {
            return fs.readFileSync(htmlPath, 'utf-8');
        } catch (e) {
            return `<!DOCTYPE html><html><body>Error loading UI: ${e}</body></html>`;
        }
    }
}
