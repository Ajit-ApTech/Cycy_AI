import axios from 'axios';

export interface ModelProvider {
    id: string;
    baseUrl: string;
    authHeader?: string;
    transformResponse?: (data: any) => string[];
}

export class ModelService {
    private providers: Record<string, ModelProvider> = {
        openai: {
            id: 'openai',
            baseUrl: 'https://api.openai.com/v1/models',
            authHeader: 'Authorization',
            transformResponse: (data) => data.data?.map((m: any) => m.id) || []
        },
        groq: {
            id: 'groq',
            baseUrl: 'https://api.groq.com/openai/v1/models',
            authHeader: 'Authorization',
            transformResponse: (data) => data.data?.map((m: any) => m.id) || []
        },
        nvidia: {
            id: 'nvidia',
            baseUrl: 'https://integrate.api.nvidia.com/v1/models',
            authHeader: 'Authorization',
            transformResponse: (data) => data.data?.map((m: any) => m.id) || []
        },
        gemini: {
            id: 'gemini',
            baseUrl: 'https://generativelanguage.googleapis.com/v1beta/models',
            transformResponse: (data) => data.models?.map((m: any) => m.name.replace('models/', '')) || []
        },
        ollama: {
            id: 'ollama',
            baseUrl: 'http://localhost:11434/api/tags',
            transformResponse: (data) => data.models?.map((m: any) => m.name) || []
        }
    };

    async fetchModels(providerId: string, apiKey?: string): Promise<string[]> {
        const provider = this.providers[providerId];
        if (!provider) {
            throw new Error(`Unsupported provider: ${providerId}`);
        }

        try {
            const headers: Record<string, string> = {};
            let url = provider.baseUrl;

            if (apiKey) {
                if (providerId === 'gemini') {
                    url = `${url}?key=${apiKey}`;
                } else if (provider.authHeader) {
                    headers[provider.authHeader] = `Bearer ${apiKey}`;
                }
            }

            const response = await axios.get(url, { headers, timeout: 10000 });

            if (provider.transformResponse) {
                return provider.transformResponse(response.data);
            }

            return response.data;
        } catch (error: any) {
            console.error(`[ModelService] Error fetching models for ${providerId}:`, error.message);
            if (error.response) {
                console.error(`[ModelService] Response data:`, error.response.data);
                throw new Error(error.response.data?.error?.message || `Failed to fetch models: ${error.response.statusText}`);
            }
            throw error;
        }
    }
}
