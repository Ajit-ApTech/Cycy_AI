import { IPC_CHANNELS } from '@devmind/shared';
import { ipcMain, BrowserWindow } from 'electron';

export interface PendingCommand {
    id: string;
    command: string;
    timestamp: number;
}

/**
 * Security: CommandGate
 * Holds terminal commands requested by the agent until explicit user approval
 * from the Renderer process. Prevents autonomous destructive actions.
 */
export class CommandGate {
    private pendingCommands: Map<string, PendingCommand> = new Map();

    constructor(private window: BrowserWindow) {
        this.setupListeners();
    }

    /**
     * Called by the Agent / Core to request a command execution.
     */
    public requestCommandExecution(command: string): string {
        const id = Date.now().toString() + Math.random().toString(36).substr(2, 5);
        const pending: PendingCommand = { id, command, timestamp: Date.now() };

        this.pendingCommands.set(id, pending);

        // Notify Renderer of new pending command
        this.window.webContents.send(IPC_CHANNELS.AGENT.RUN, pending);

        return id;
    }

    private setupListeners() {
        ipcMain.handle(IPC_CHANNELS.AGENT.APPROVE, (event, id: string) => {
            const pending = this.pendingCommands.get(id);
            if (pending) {
                this.pendingCommands.delete(id);
                // Execute the command here securely via node-pty or child_process
                console.log(`[CommandGate] Executing approved command: ${pending.command}`);
                return { success: true, message: 'Command queued for execution' };
            }
            throw new Error('Command not found or already processed');
        });

        ipcMain.handle(IPC_CHANNELS.AGENT.CANCEL, (event, id: string) => {
            if (this.pendingCommands.has(id)) {
                this.pendingCommands.delete(id);
                console.log(`[CommandGate] Command ${id} cancelled by user`);
                return { success: true };
            }
            return { success: false };
        });
    }
}
