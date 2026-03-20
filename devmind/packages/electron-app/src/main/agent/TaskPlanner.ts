import { ToolRegistry } from './ToolRegistry';

export interface TaskStatus {
    id: string;
    description: string;
    state: 'pending' | 'in_progress' | 'completed' | 'failed';
    error?: string;
}

export interface AgentPlan {
    intent: string;
    subtasks: TaskStatus[];
}

export class TaskPlanner {
    private registry: ToolRegistry;
    private currentPlan: AgentPlan | null = null;

    constructor(registry: ToolRegistry) {
        this.registry = registry;
    }

    /**
     * Parse an intent from the user and break it down into executable subtasks.
     * In a full implementation, this sends the intent to the Python LLM router.
     */
    public async generatePlan(intent: string): Promise<AgentPlan> {
        console.log(`[TaskPlanner] Generating plan for intent: "${intent}"`);

        // Mock plan generation for now
        this.currentPlan = {
            intent,
            subtasks: [
                { id: '1', description: 'Analyze current codebase via Tree-sitter AST', state: 'pending' },
                { id: '2', description: 'Formulate file edit boundaries', state: 'pending' },
                { id: '3', description: 'Apply edits to filesystem', state: 'pending' },
                { id: '4', description: 'Run linter to verify syntax', state: 'pending' }
            ]
        };

        return this.currentPlan;
    }

    /**
     * Executes the tasks in the current plan iteratively.
     */
    public async executePlan(onProgress: (plan: AgentPlan) => void) {
        if (!this.currentPlan) throw new Error('No active plan to execute.');

        for (const task of this.currentPlan.subtasks) {
            task.state = 'in_progress';
            onProgress({ ...this.currentPlan });

            try {
                // Mock task execution delay
                await new Promise(resolve => setTimeout(resolve, 1500));

                // Real implementation would invoke the ToolRegistry based on the LLM's next action decision
                // const result = await this.registry.executeTool(actionName, params);

                task.state = 'completed';
            } catch (err: any) {
                task.state = 'failed';
                task.error = err.message;
                onProgress({ ...this.currentPlan });
                break; // Stop execution on failure
            }

            onProgress({ ...this.currentPlan });
        }
    }

    public getCurrentPlan(): AgentPlan | null {
        return this.currentPlan;
    }
}
