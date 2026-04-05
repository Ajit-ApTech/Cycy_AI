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
exports.ProjectTools = void 0;
const vscode = __importStar(require("vscode"));
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
class ProjectTools {
    async todoWrite(todos) {
        try {
            const workspaceFolders = vscode.workspace.workspaceFolders;
            if (!workspaceFolders || workspaceFolders.length === 0) {
                return 'ProjectTools Error: No workspace found to save todos.';
            }
            const cycyDir = path.join(workspaceFolders[0].uri.fsPath, '.cycy');
            if (!fs.existsSync(cycyDir)) {
                fs.mkdirSync(cycyDir, { recursive: true });
            }
            const todoPath = path.join(cycyDir, 'todo.json');
            let existingTodos = [];
            if (fs.existsSync(todoPath)) {
                existingTodos = JSON.parse(fs.readFileSync(todoPath, 'utf-8'));
            }
            // Merge items based on ID
            const todoMap = new Map(existingTodos.map(t => [t.id, t]));
            for (const item of todos) {
                todoMap.set(item.id, { ...todoMap.get(item.id), ...item });
            }
            const mergedTodos = Array.from(todoMap.values());
            fs.writeFileSync(todoPath, JSON.stringify(mergedTodos, null, 2), 'utf-8');
            return `TodoWrite Success: Updated ${todos.length} todo items. Location: .cycy/todo.json`;
        }
        catch (error) {
            return `TodoWrite Error: ${error.message}`;
        }
    }
    async agentRun(name, description, prompt, model) {
        // This is a placeholder that simulates delegating to a specialized Agent.
        // In a full implementation, this might call the core AI engine with a specific system prompt.
        return `Agent Run Success: Agent '${name}' has been scheduled to process prompt:\n"${prompt}"\n(This is a framework stub, full multi-agent orchestration will be implemented in Phase 4).`;
    }
    async skillLoad(skillName, args) {
        // Simulates loading a specific skill or plugin context for the agent.
        return `Skill Load Success: Loaded skill context for '${skillName}'.`;
    }
}
exports.ProjectTools = ProjectTools;
//# sourceMappingURL=ProjectTools.js.map