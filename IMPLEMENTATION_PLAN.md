# Cycy AI - Implementation Plan

> **Path**: `/Users/ajitprajapati/Documents/goingupdatecopy/IMPLEMENTATION_PLAN.md`
> **Created**: 2026-04-03
> **Status**: Active Development

---

## 1. Project Overview

**Cycy AI** is a multi-platform AI coding assistant with three main components:
1. **Python Terminal CLI** - Command-line interface supporting multiple AI providers
2. **VS Code Extension** - Integrated development environment plugin
3. **Electron Desktop App** - Standalone desktop application (in development)

### Key Characteristics
- **Languages**: Python (backend), TypeScript (frontend/extensions)
- **Architecture**: Modular with provider-agnostic AI backend
- **Purpose**: AI-powered code assistance with file operations, terminal commands, and chat
- **Current Providers**: Google Gemini, OpenAI, NVIDIA NIM, Groq, Ollama (local)

---

## 2. Current Architecture

```
/Users/ajitprajapati/Documents/goingupdatecopy/
├── main.py                           # CLI entry point (legacy, frozen)
├── backend/                          # Python backend modules
│   ├── agent_executor.py            # Agent execution logic
│   ├── core.py                      # Core chat functionality
│   └── constants.py                 # Configuration constants
├── devmind/                          # TypeScript monorepo
│   ├── packages/
│   │   ├── vscode-extension/      # VS Code extension
│   │   │   ├── src/
│   │   │   │   ├── extension.ts     # Extension entry
│   │   │   │   ├── webview/         # Chat UI components
│   │   │   │   │   └── CycyChatViewProvider.ts
│   │   │   │   ├── services/        # Business logic
│   │   │   │   │   ├── AIService.ts
│   │   │   │   │   └── SettingsManager.ts
│   │   │   │   └── tools/           # Tool implementations
│   │   │   │       ├── ToolExecutor.ts
│   │   │   │       ├── FileReadingTools.ts
│   │   │   │       ├── FileWritingTools.ts
│   │   │   │       ├── TerminalTools.ts
│   │   │   │       └── SearchTools.ts
│   │   │   └── package.json
│   │   ├── electron-app/            # Desktop app (WIP)
│   │   ├── cli-bridge/              # CLI integration bridge
│   │   └── shared/                  # Shared utilities
│   └── turbo.json                   # Monorepo configuration
├── chat_history/                     # Persistent chat logs
├── venv/                            # Python virtual environment
└── requirements.txt                 # Python dependencies
```

---

## 3. Current Feature Inventory

### 3.1 Python Backend (`main.py` + `backend/`)
**Existing Features**:
- Multi-provider AI support (Google, OpenAI, NVIDIA, Groq, Ollama)
- Persistent memory system (`/remember`, `/memory`, `/forget`)
- Chat history saving
- File scanning for context (`/scan`)
- Shell command execution (`/run`)
- External AI delegation (`/external`)
- Loading spinner for UX
- Environment-based configuration

**Key Files**:
- `main.py:1358` - Main CLI implementation
- `backend/agent_executor.py` - Agent orchestration
- `backend/core.py` - Chat abstractions
- `backend/constants.py` - Shared configuration

### 3.2 VS Code Extension (`devmind/packages/vscode-extension/`)
**Existing Features**:
- Webview-based chat panel
- Settings management service
- AIService for provider communication
- Tool execution framework
  - File reading
  - File writing  
  - Terminal execution
  - Search operations

**Key Files**:
- `src/extension.ts` - Extension activation
- `src/webview/CycyChatViewProvider.ts` - Chat UI
- `src/services/AIService.ts` - AI communication
- `src/tools/ToolExecutor.ts` - Tool orchestration

### 3.3 Electron App (`devmind/packages/electron-app/`)
**Existing Features**:
- Security layer (CommandGate, IPCWhitelist)
- Agent layer (TaskPlanner, ToolRegistry, TreeSitterParser)
- Main process services
  - ModelService
  - DatabaseService
  - LinterService
  - GitService
  - BrowserAutomationService
  - PlaywrightService
  - CIService

---

## 4. Improvement Roadmap

### Phase 1: Backend Modernization (Priority: Critical)
**Goal**: Improve Python backend architecture and capabilities

| ID | Feature | Description | Current Status | Target Implementation |
|----|---------|-------------|----------------|----------------------|
| 1.1 | **FastAPI Server** | Replace direct Python calls with REST API | ❌ Not started | `backend/server.py` |
| 1.2 | **WebSocket Support** | Add real-time streaming for chat responses | ❌ Not started | `backend/websocket.py` |
| 1.3 | **Structured Logging** | Replace print statements with `logging` + `structlog` | ⚠️ Partial | `backend/logger.py` |
| 1.4 | **Configuration Management** | Migrate from `.env` to Pydantic Settings | ⚠️ Partial | `backend/config.py` |
| 1.5 | **Error Handling** | Implement centralized exception handling | ❌ Not started | `backend/exceptions.py` |
| 1.6 | **Type Hints** | Add full type annotations to backend | ⚠️ Partial | All backend files |
| 1.7 | **Async Support** | Convert blocking I/O to async/await | ⚠️ Partial | `backend/async_utils.py` |
| 1.8 | **Database Persistence** | Replace file-based storage with SQLite/PostgreSQL | ❌ Not started | `backend/db/` |

**Dependencies to Add**:
```python
fastapi>=0.111.0
uvicorn[standard]>=0.30.0
websockets>=12.0
structlog>=24.0.0
pydantic-settings>=2.0.0
sqlalchemy>=2.0.0
alembic>=1.13.0
pytest>=8.0.0
pytest-asyncio>=0.23.0
httpx>=0.27.0  # For async HTTP
```

---

### Phase 2: VS Code Extension Enhancement (Priority: Critical)
**Goal**: Improve IDE integration and user experience

| ID | Feature | Description | Current Status | Target Implementation |
|----|---------|-------------|----------------|----------------------|
| 2.1 | **Inline Completions** | Add ghost text suggestions like Copilot | ❌ Not started | `src/features/InlineCompletionProvider.ts` |
| 2.2 | **Code Actions** | Provide AI-powered quick fixes | ❌ Not started | `src/features/CodeActionProvider.ts` |
| 2.3 | **Hover Information** | Show AI-generated documentation on hover | ❌ Not started | `src/features/HoverProvider.ts` |
| 2.4 | **Semantic Highlighting** | Intelligent syntax highlighting | ❌ Not started | `src/features/SemanticProvider.ts` |
| 2.5 | **Diff Viewer** | Side-by-side code comparison for changes | ❌ Not started | `src/webview/DiffViewer.ts` |
| 2.6 | **File Tree Context** | Add "Ask AI about this file" to explorer | ❌ Not started | `src/menus/FileTreeMenus.ts` |
| 2.7 | **Editor Context Menu** | Right-click "Explain code" / "Refactor" | ❌ Not started | `src/menus/EditorMenus.ts` |
| 2.8 | **Status Bar Integration** | Show model status and quick actions | ❌ Not started | `src/features/StatusBarManager.ts` |
| 2.9 | **Command Palette** | Full command palette integration | ⚠️ Partial | `src/commands/` |
| 2.10 | **Keybindings** | Customizable keyboard shortcuts | ⚠️ Partial | `package.json` contributions |

---

### Phase 3: Tool Framework Expansion (Priority: High)
**Goal**: Add more development tools and capabilities

| ID | Feature | Description | Category |
|----|---------|-------------|----------|
| 3.1 | **LSP Integration** | Connect to Language Servers for code intelligence | Code |
| 3.2 | **Git Operations** | Commit, branch, diff analysis | Version Control |
| 3.3 | **Test Runner** | Run tests and analyze failures | Testing |
| 3.4 | **Debugger Integration** | Inspect variables, set breakpoints | Debugging |
| 3.5 | **Package Manager** | npm/pip/cargo install assistance | Dependencies |
| 3.6 | **Code Formatter** | Auto-format with prettier/black/rustfmt | Code |
| 3.7 | **Linting** | ESLint/pylint/clippy integration | Code Quality |
| 3.8 | **Documentation** | Generate docstrings/comments | Documentation |
| 3.9 | **Refactoring** | Rename, extract method, etc. | Code |
| 3.10 | **Project Templates** | Scaffold new projects from templates | Project |
| 3.11 | **Docker Support** | Container management | DevOps |
| 3.12 | **CI/CD Integration** | GitHub Actions pipeline generation | DevOps |

**Implementation Pattern** (per tool):
```typescript
// src/tools/ToolInterface.ts
export interface Tool {
    readonly name: string;
    readonly description: string;
    readonly parameters: JSONSchema;
    execute(args: unknown): Promise<ToolResult>;
}

// src/tools/LinterTool.ts
export class LinterTool implements Tool {
    readonly name = "lint_code";
    readonly description = "Run linter on code and fix issues";
    readonly parameters = { ... };
    
    async execute(args: { file: string; fix: boolean }): Promise<ToolResult> {
        // Implementation
    }
}
```

---

### Phase 4: AI Provider Improvements (Priority: High)
**Goal**: Better AI model management and capabilities

| ID | Feature | Description |
|----|---------|-------------|
| 4.1 | **Model Router** | Automatically select best model for task |
| 4.2 | **Context Management** | Smart context window optimization |
| 4.3 | **RAG Support** | Retrieval-Augmented Generation with codebase |
| 4.4 | **Embeddings** | Code similarity search |
| 4.5 | **Function Calling** | Native tool use for all providers |
| 4.6 | **Vision Support** | Image understanding for diagrams/UI |
| 4.7 | **Multi-Agent** | Specialized agents for different tasks |
| 4.8 | **Local Models** | Better Ollama/LM Studio integration |

---

### Phase 5: User Experience (Priority: Medium)
**Goal**: Polish and professional features

| ID | Feature | Description |
|----|---------|-------------|
| 5.1 | **Welcome Page** | Onboarding for new users |
| 5.2 | **Tutorials** | Interactive walkthroughs |
| 5.3 | **Themes** | Customizable UI themes |
| 5.4 | **Keyboard Shortcuts** | Vim/Emacs mode support |
| 5.5 | **Chat Organization** | Folders, search, pinning |
| 5.6 | **Export/Import** | Share conversations |
| 5.7 | **Offline Mode** | Work without internet |
| 5.8 | **Performance** | Lazy loading, caching |

---

### Phase 6: Enterprise Features (Priority: Medium)
**Goal**: Business/team capabilities

| ID | Feature | Description |
|----|---------|-------------|
| 6.1 | **SSO Integration** | SAML/OAuth for organizations |
| 6.2 | **Team Sharing** | Shared prompts and snippets |
| 6.3 | **Audit Logging** | Compliance and monitoring |
| 6.4 | **Custom Models** | Bring your own model endpoint |
| 6.5 | **Rate Limiting** | Usage quotas per team |
| 6.6 | **Analytics** | Usage insights dashboard |

---

## 5. Technical Specifications

### 5.1 API Design (FastAPI Backend)

```python
# backend/api/routes.py
from fastapi import FastAPI, WebSocket
from pydantic import BaseModel

app = FastAPI(title="Cycy AI API", version="2.0.0")

class ChatRequest(BaseModel):
    message: str
    context: list[Message]
    model: str = "gemini-pro"
    tools: list[str] | None = None

class ChatResponse(BaseModel):
    content: str
    tool_calls: list[ToolCall] | None = None
    usage: TokenUsage

@app.post("/v1/chat", response_model=ChatResponse)
async def chat(request: ChatRequest):
    """Process chat message and return AI response."""
    ...

@app.websocket("/v1/stream")
async def stream(websocket: WebSocket):
    """WebSocket endpoint for streaming responses."""
    ...

@app.get("/v1/models")
async def list_models():
    """Available AI models and their status."""
    ...

@app.post("/v1/tools/{tool_name}")
async def execute_tool(tool_name: str, params: dict):
    """Execute a specific tool."""
    ...
```

### 5.2 VS Code Extension Architecture

```
devmind/packages/vscode-extension/src/
├── extension.ts                    # Entry point
├── api/                          # Backend API client
│   ├── Client.ts                # HTTP/WebSocket client
│   ├── Types.ts                 # API type definitions
│   └── Streaming.ts             # Stream handling
├── features/                     # VS Code feature providers
│   ├── CompletionProvider.ts
│   ├── HoverProvider.ts
│   ├── CodeActionProvider.ts
│   └── DiagnosticProvider.ts
├── commands/                     # Command implementations
│   ├── index.ts
│   ├── chat.ts
│   ├── refactor.ts
│   └── explain.ts
├── tools/                        # Tool implementations
│   ├── registry.ts
│   ├── base.ts
│   ├── filesystem.ts
│   ├── terminal.ts
│   ├── git.ts
│   └── lsp.ts
├── webview/                      # UI components
│   ├── ChatPanel.ts
│   ├── DiffViewer.ts
│   ├── components/
│   │   ├── MessageList.tsx
│   │   ├── InputBox.tsx
│   │   └── ToolCall.tsx
│   └── styles/
├── services/                     # Business logic
│   ├── SettingsManager.ts
│   ├── ChatHistory.ts
│   └── ContextManager.ts
├── menus/                        # Context menus
│   ├── fileTree.ts
│   └── editor.ts
└── utils/                        # Utilities
    ├── logger.ts
    ├── errors.ts
    └── constants.ts
```

---

## 6. Implementation Checklist

### Phase 1: Backend Modernization
- [ ] Set up FastAPI application structure
- [ ] Implement WebSocket endpoint for streaming
- [ ] Add Pydantic models for all requests/responses
- [ ] Set up SQLAlchemy with migrations
- [ ] Implement structured logging
- [ ] Add comprehensive error handling
- [ ] Write unit tests with pytest
- [ ] Set up CI/CD for backend

### Phase 2: VS Code Extension
- [ ] Refactor to new folder structure
- [ ] Implement API client with streaming support
- [ ] Add inline completion provider
- [ ] Add code action provider
- [ ] Add hover provider
- [ ] Implement file tree context menus
- [ ] Add status bar integration
- [ ] Write integration tests

### Phase 3: Tools
- [ ] Define Tool interface
- [ ] Create tool registry
- [ ] Implement LSP tool
- [ ] Implement Git tool
- [ ] Implement test runner tool
- [ ] Implement debugger tool
- [ ] Implement documentation tool
- [ ] Add tool permission system

### Phase 4: AI Providers
- [ ] Add model routing logic
- [ ] Implement context compression
- [ ] Add RAG with vector database
- [ ] Implement embeddings endpoint
- [ ] Add vision support
- [ ] Create multi-agent orchestration

---

## 7. Development Workflow

### Commands

```bash
# Python Backend
cd /Users/ajitprajapati/Documents/goingupdatecopy
source venv/bin/activate
python -m backend.server          # Start API server
pytest backend/tests/            # Run tests
black backend/                   # Format code
mypy backend/                    # Type check
ruff check backend/              # Lint

# VS Code Extension
cd devmind/packages/vscode-extension
npm install
npm run compile                   # Build TypeScript
npm run watch                    # Watch mode
npm run test                     # Run tests
vsce package                     # Create .vsix

# Electron App
cd devmind/packages/electron-app
npm install
npm run dev                      # Development mode
npm run build                    # Production build
npm run test                     # Run tests

# Monorepo (Turbo)
cd devmind
npm install                      # Install all dependencies
npm run build --workspace=vscode-extension
npm run dev --workspace=electron-app
```

### Verification Requirements
- Python: `black`, `mypy`, `ruff`, `pytest` all pass
- TypeScript: ESLint, TypeScript compiler, tests pass
- Extension: Packaging succeeds, no warnings

---

## 8. File Mapping (Target Structure)

### Backend Python
```
backend/
├── __init__.py
├── server.py                      # FastAPI app entry
├── config.py                      # Pydantic settings
├── logger.py                      # Structured logging
├── exceptions.py                  # Custom exceptions
├── db/                           # Database layer
│   ├── __init__.py
│   ├── models.py                 # SQLAlchemy models
│   ├── migrations/               # Alembic migrations
│   └── repositories.py           # Data access layer
├── api/                          # API routes
│   ├── __init__.py
│   ├── routes/
│   │   ├── chat.py
│   │   ├── tools.py
│   │   ├── models.py
│   │   └── health.py
│   ├── dependencies.py
│   └── middleware.py
├── services/                     # Business logic
│   ├── __init__.py
│   ├── chat.py
│   ├── streaming.py
│   ├── tools.py
│   ├── memory.py
│   └── context.py
├── providers/                    # AI providers
│   ├── __init__.py
│   ├── base.py
│   ├── gemini.py
│   ├── openai.py
│   ├── ollama.py
│   └── router.py
├── models/                       # Pydantic schemas
│   ├── __init__.py
│   ├── chat.py
│   ├── tool.py
│   └── common.py
└── utils/                        # Utilities
    ├── __init__.py
    ├── file_utils.py
    ├── async_utils.py
    └── security.py
```

### VS Code Extension
```
devmind/packages/vscode-extension/src/
├── extension.ts
├── constants.ts
├── api/
│   ├── Client.ts
│   ├── Types.ts
│   └── Streaming.ts
├── features/
│   ├── CompletionProvider.ts
│   ├── HoverProvider.ts
│   ├── CodeActionProvider.ts
│   └── DiagnosticProvider.ts
├── commands/
│   ├── index.ts
│   ├── chat.ts
│   ├── refactor.ts
│   └── explain.ts
├── tools/
│   ├── base.ts
│   ├── registry.ts
│   ├── filesystem.ts
│   ├── terminal.ts
│   ├── git.ts
│   └── lsp.ts
├── webview/
│   ├── ChatPanel.ts
│   ├── DiffViewer.ts
│   ├── components/
│   │   ├── App.tsx
│   │   ├── MessageList.tsx
│   │   ├── InputBox.tsx
│   │   ├── ToolCall.tsx
│   │   └── Settings.tsx
│   └── styles/
│       └── chat.css
├── services/
│   ├── ChatHistory.ts
│   ├── ContextManager.ts
│   └── SettingsManager.ts
├── menus/
│   ├── fileTree.ts
│   └── editor.ts
└── utils/
    ├── logger.ts
    ├── errors.ts
    └── validators.ts
```

---

## 9. Dependencies Reference

### Python Backend
| Crate | Purpose |
|-------|---------|
| `fastapi` | Web framework |
| `uvicorn` | ASGI server |
| `websockets` | WebSocket support |
| `pydantic-settings` | Configuration management |
| `sqlalchemy` | ORM |
| `alembic` | Database migrations |
| `structlog` | Structured logging |
| `httpx` | Async HTTP client |
| `pytest` | Testing framework |
| `pytest-asyncio` | Async test support |
| `redis` | Caching (optional) |
| `chromadb` | Vector database for RAG (optional) |

### TypeScript Extension
| Package | Purpose |
|---------|---------|
| `vscode` | Extension API |
| `react` | Webview UI |
| `ws` | WebSocket client |
| `zod` | Runtime validation |
| `axios` | HTTP client |
| `diff-match-patch` | Diff visualization |

---

## 10. Testing Strategy

| Level | Approach | Tools |
|-------|----------|-------|
| Unit | `pytest` for Python, `jest` for TypeScript | pytest, jest |
| Integration | Test API endpoints with `httpx` | pytest-asyncio |
| E2E | VS Code extension testing | @vscode/test-electron |

---

## 11. Migration Strategy

### Step 1: Parallel Development
1. Keep `main.py` functional (frozen)
2. Develop new FastAPI backend in `backend/server.py`
3. Create new VS Code extension version with feature flags

### Step 2: Gradual Cutover
1. Route VS Code extension to new backend
2. Keep CLI on old backend temporarily
3. Test thoroughly with both versions

### Step 3: CLI Migration
1. Update CLI to use HTTP API instead of direct calls
2. Add offline mode that falls back to direct calls
3. Deprecate direct imports from `main.py`

### Step 4: Cleanup
1. Remove `main.py` (after full migration)
2. Archive old extension version
3. Document breaking changes

---

## 12. How to Use This Plan

### For New Features
1. Identify which Phase the feature belongs to
2. Check the Implementation Checklist for prerequisites
3. Follow the File Mapping for where to add code
4. Update the checklist when complete

### For Bug Fixes
1. Check existing implementations in current files
2. Reference the target structure for where to move the fix
3. Ensure tests are added for the fix

### For Refactoring
1. Follow the Migration Strategy steps
2. Maintain backward compatibility during transition
3. Document any breaking changes

---

## 13. Common Patterns

### 12.1 Adding a New Tool

```typescript
// 1. Define in src/tools/base.ts
export interface Tool {
    name: string;
    description: string;
    parameters: JSONSchema;
    execute(args: unknown): Promise<ToolResult>;
}

// 2. Implement in src/tools/MyNewTool.ts
export class MyNewTool implements Tool {
    name = "my_new_tool";
    description = "Does something useful";
    parameters = { ... };
    
    async execute(args: any): Promise<ToolResult> {
        // Implementation
        return { success: true, output: "result" };
    }
}

// 3. Register in src/tools/registry.ts
export const TOOLS: Tool[] = [
    // ... existing tools
    new MyNewTool(),
];
```

### 12.2 Adding a New AI Provider

```python
# backend/providers/my_provider.py
from .base import AIProvider

class MyProvider(AIProvider):
    async def chat(self, messages: list[Message]) -> Response:
        # Implementation
        pass
    
    async def stream(self, messages: list[Message]) -> AsyncIterator[Chunk]:
        # Implementation
        pass
```

---

## 14. References

### Project Files
| Component | Path |
|-----------|------|
| Python CLI | `/Users/ajitprajapati/Documents/goingupdatecopy/main.py` |
| Python Backend | `/Users/ajitprajapati/Documents/goingupdatecopy/backend/` |
| VS Code Extension | `/Users/ajitprajapati/Documents/goingupdatecopy/devmind/packages/vscode-extension/` |
| Electron App | `/Users/ajitprajapati/Documents/goingupdatecopy/devmind/packages/electron-app/` |

### Documentation
- [VS Code Extension API](https://code.visualstudio.com/api)
- [FastAPI Documentation](https://fastapi.tiangolo.com/)
- [Pydantic Settings](https://docs.pydantic.dev/latest/concepts/pydantic_settings/)

---

## 15. Final Checklist

Before marking this implementation complete:

- [ ] All Phase 1 features implemented
- [ ] All Phase 2 features implemented
- [ ] Tool registry has 10+ tools
- [ ] Supports 5+ AI providers
- [ ] VS Code extension published
- [ ] Documentation complete
- [ ] Tests cover 80%+ of code
- [ ] CI/CD pipeline green

---

*Last Updated: 2026-04-03*
*Version: 1.0*
*Status: Ready for Development*