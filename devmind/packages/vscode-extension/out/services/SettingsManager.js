"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SettingsManager = void 0;
class SettingsManager {
    constructor(context) {
        this.context = context;
    }
    async setProvider(provider) {
        await this.context.globalState.update('cycy.provider', provider);
    }
    getProvider() {
        return this.context.globalState.get('cycy.provider') || 'gemini';
    }
    async setModel(model) {
        await this.context.globalState.update('cycy.model', model);
    }
    getModel() {
        return this.context.globalState.get('cycy.model') || '';
    }
    async setApiKey(provider, apiKey) {
        await this.context.secrets.store(`cycy.apiKey.${provider}`, apiKey);
    }
    async getApiKey(provider) {
        return await this.context.secrets.get(`cycy.apiKey.${provider}`);
    }
}
exports.SettingsManager = SettingsManager;
//# sourceMappingURL=SettingsManager.js.map