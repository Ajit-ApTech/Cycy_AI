import { IPC_CHANNELS } from '@devmind/shared';

/**
 * Flattens the nested IPC_CHANNELS object into a single array of allowed strings.
 */
function getFlattenedChannels(obj: any): string[] {
    let channels: string[] = [];
    if (!obj || typeof obj !== 'object') return channels;

    for (const key in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
            if (typeof obj[key] === 'object' && obj[key] !== null) {
                channels = channels.concat(getFlattenedChannels(obj[key]));
            } else if (typeof obj[key] === 'string') {
                channels.push(obj[key]);
            }
        }
    }
    return channels;
}

const ALLOWED_CHANNELS = new Set(getFlattenedChannels(IPC_CHANNELS));

/**
 * Security: IPCWhitelist
 * Rejects any IPC calls (send, invoke, on) that do not match the explicitly 
 * defined shared constants.
 */
export class IPCWhitelist {
    static isAllowed(channel: string): boolean {
        return ALLOWED_CHANNELS.has(channel);
    }

    static validate(channel: string): void {
        if (!this.isAllowed(channel)) {
            console.warn(`[SECURITY] Blocked unauthorized or unknown IPC channel: "${channel}"`);
            console.debug(`[SECURITY] Allowed channels:`, Array.from(ALLOWED_CHANNELS).sort());
            throw new Error(`Unauthorized IPC channel: ${channel}`);
        }
    }
}
