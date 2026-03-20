import { create } from 'zustand';

export interface PendingCommand {
    id: string;
    command: string;
    status: 'pending' | 'approved' | 'rejected' | 'executed';
}

interface AgentStore {
    currentPlan: string | null;
    pendingCommands: PendingCommand[];
    setPlan: (plan: string) => void;
    addPendingCommand: (cmd: PendingCommand) => void;
    updateCommandStatus: (id: string, status: PendingCommand['status']) => void;
}

export const useAgentStore = create<AgentStore>((set) => ({
    currentPlan: null,
    pendingCommands: [],
    setPlan: (plan) => set({ currentPlan: plan }),
    addPendingCommand: (cmd) => set((state) => ({
        pendingCommands: [...state.pendingCommands, cmd]
    })),
    updateCommandStatus: (id, status) => set((state) => ({
        pendingCommands: state.pendingCommands.map(cmd =>
            cmd.id === id ? { ...cmd, status } : cmd
        )
    }))
}));
