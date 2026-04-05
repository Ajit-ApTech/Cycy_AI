import * as vscode from 'vscode';

export class SettingsManager {
    constructor(private context: vscode.ExtensionContext) {}

    public async setProvider(provider: string) {
        await this.context.globalState.update('cycy.provider', provider);
    }

    public getProvider(): string {
        return this.context.globalState.get<string>('cycy.provider') || 'gemini';
    }

    public async setModel(model: string) {
        await this.context.globalState.update('cycy.model', model);
    }

    public getModel(): string {
        return this.context.globalState.get<string>('cycy.model') || '';
    }

    public async setOllamaUrl(url: string) {
        await this.context.globalState.update('cycy.ollamaUrl', url);
    }

    public getOllamaUrl(): string {
        return this.context.globalState.get<string>('cycy.ollamaUrl') || 'http://localhost:11434';
    }

    public async setCustomHeaders(headers: string) {
        await this.context.globalState.update('cycy.customHeaders', headers);
    }

    public getCustomHeaders(): string {
        return this.context.globalState.get<string>('cycy.customHeaders') || '';
    }

    public async setApiKey(provider: string, apiKey: string) {
        await this.context.secrets.store(`cycy.apiKey.${provider}`, apiKey);
    }

    public async getApiKey(provider: string): Promise<string | undefined> {
        return await this.context.secrets.get(`cycy.apiKey.${provider}`);
    }
}
