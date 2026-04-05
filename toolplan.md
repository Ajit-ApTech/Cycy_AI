# Tool Plan: Claw Code Environment

This document details the available tools in the Claw Code environment, how they are called, and their interaction patterns.

---

## Overview

The Claw Code environment provides a set of tools that enable:
- **File Operations**: Read, write, and edit files
- **Code Search**: Find files and search code contents
- **Execution**: Run shell commands, PowerShell scripts, and REPL code
- **Web Access**: Fetch URLs and search the web
- **Project Management**: Task lists, agents, and specialized skills
- **Configuration**: Settings and structured output

---

## Tool Categories

### 1. File System Operations

| Tool | Purpose | Key Parameters |
|------|---------|----------------|
| `read_file` | Read text files from the workspace | `path`, `offset`, `limit` |
| `write_file` | Create or overwrite text files | `path`, `content` |
| `edit_file` | Modify existing files (replace text) | `path`, `old_string`, `new_string`, `replace_all` |

**Calling Pattern**:
```rust
// Read a file
read_file({
    "path": "/Users/ajitprajapati/Downloads/claw-code-main/rust/src/main.rs",
    "limit": 50  // Optional: limit number of lines
})

// Write a file
write_file({
    "path": "/Users/ajitprajapati/Downloads/claw-code-main/newfile.md",
    "content": "# Hello World"
})

// Edit a file
edit_file({
    "path": "/Users/ajitprajapati/Downloads/claw-code-main/file.rs",
    "old_string": "fn old() {}",
    "new_string": "fn new() {}",
    "replace_all": false  // Optional: replace all occurrences
})
```

---

### 2. Search Operations

| Tool | Purpose | Key Parameters |
|------|---------|----------------|
| `glob_search` | Find files matching glob patterns | `pattern`, `path` |
| `grep_search` | Search file contents using regex | `pattern`, `path`, `glob`, `-i`, `-n`, `context` |

**Calling Pattern**:
```rust
// Glob search - find all Cargo.toml files
glob_search({
    "pattern": "**/Cargo.toml",
    "path": "/Users/ajitprajapati/Downloads/claw-code-main"  // Optional: root path
})

// Grep search - find function definitions
grep_search({
    "pattern": "fn\\s+\\w+",
    "path": "/Users/ajitprajapati/Downloads/claw-code-main/rust/src",
    "glob": "*.rs",          // Optional: file filter
    "-i": false,              // Optional: case insensitive
    "-n": true,              // Optional: include line numbers
    "context": 2              // Optional: lines of context
})
```

---

### 3. Execution Tools

| Tool | Purpose | Key Parameters |
|------|---------|----------------|
| `bash` | Execute shell commands (Linux/Mac) | `command`, `description`, `timeout`, `run_in_background` |
| `PowerShell` | Execute PowerShell commands (Windows) | `command`, `description`, `timeout`, `run_in_background` |
| `REPL` | Execute code in REPL subprocess | `code`, `language`, `timeout_ms` |

**Calling Pattern**:
```rust
// Bash command execution
bash({
    "command": "cargo test --workspace",
    "description": "Run Rust tests",
    "timeout": 300,              // Optional: timeout in seconds
    "run_in_background": false    // Optional: run asynchronously
})

// REPL execution
REPL({
    "code": "let x = 5 + 10; println!(\"{}\", x);",
    "language": "rust",
    "timeout_ms": 30000
})
```

---

### 4. Web Access

| Tool | Purpose | Key Parameters |
|------|---------|----------------|
| `WebSearch` | Search the web for current information | `query`, `allowed_domains`, `blocked_domains` |
| `WebFetch` | Fetch URL content and answer prompts | `url`, `prompt` |

**Calling Pattern**:
```rust
// Web search
WebSearch({
    "query": "Rust async/await best practices",
    "allowed_domains": ["rust-lang.org", "docs.rs"],  // Optional
    "blocked_domains": ["example.com"]               // Optional
})

// Fetch and analyze URL
WebFetch({
    "url": "https://doc.rust-lang.org/book/",
    "prompt": "What are the main chapters in this book?"
})
```

---

### 5. Project Management

| Tool | Purpose | Key Parameters |
|------|---------|----------------|
| `TodoWrite` | Update task lists | `todos` (array of task objects) |
| `Agent` | Launch specialized sub-agents | `description`, `prompt`, `name`, `model` |
| `Skill` | Load local skill definitions | `skill`, `args` |

**Calling Pattern**:
```rust
// Update todo list
TodoWrite({
    "todos": [
        {"id": "1", "description": "Implement feature X", "status": "in_progress", "priority": "high"},
        {"id": "2", "description": "Write tests", "status": "pending", "priority": "medium"}
    ]
})

// Launch specialized agent
Agent({
    "name": "rust-expert",
    "description": "Rust code reviewer",
    "prompt": "Review this Rust code for safety issues...",
    "model": "claude-3-opus"  // Optional
})

// Load a skill
Skill({
    "skill": "rust-refactoring",
    "args": "--strict-mode"  // Optional
})
```

---

### 6. Utility Tools

| Tool | Purpose | Key Parameters |
|------|---------|----------------|
| `Sleep` | Wait without blocking | `duration_ms` |
| `SendUserMessage` | Send status messages to user | `message`, `status`, `attachments` |
| `Config` | Get/set settings | `setting`, `value` |
| `StructuredOutput` | Return structured data | (varies by request) |
| `NotebookEdit` | Edit Jupyter notebooks | `notebook_path`, `cell_id`, `edit_mode`, `new_source` |
| `ToolSearch` | Find tools by keywords | `query`, `max_results` |

**Calling Pattern**:
```rust
// Configuration
Config({"setting": "theme", "value": "dark"})

// Send message to user
SendUserMessage({
    "message": "Task completed successfully",
    "status": "success",
    "attachments": ["/path/to/log.txt"]  // Optional
})

// Notebook editing
NotebookEdit({
    "notebook_path": "/path/to/notebook.ipynb",
    "cell_id": "cell-123",
    "edit_mode": "replace",
    "new_source": "print('hello')"
})
```

---

## Tool Calling Mechanism

### Execution Flow

```
User Request
    ↓
Tool Selection (AI decides which tool(s) to call)
    ↓
Tool Invocation (parallel where possible)
    ↓
Tool Execution (external system runs the tool)
    ↓
Result Return (JSON response with data or errors)
    ↓
AI Processes Results
    ↓
Next Action or Final Response
```

### Key Characteristics

1. **Asynchronous Execution**: Tools execute independently; the AI can call multiple tools simultaneously
2. **Permission-Based**: Some tools require user approval based on permission settings
3. **Timeout Handling**: Long-running commands can specify timeouts
4. **Error Handling**: Tools return structured errors that the AI can process
5. **Sandboxed**: Execution is sandboxed for security

### Response Structure

Tool results typically return:
```json
{
    "success": true/false,
    "data": { ... },           // Tool-specific data
    "error": "error message",  // If failed
    "durationMs": 42           // Execution time
}
```

---

## Best Practices

### File Operations
- **Read before write**: Always read existing files before modifying
- **Use offsets/limits**: For large files, read in chunks
- **Preserve formatting**: Match existing indentation and style

### Search Operations
- **Start broad, then narrow**: Use glob patterns first, then grep for specifics
- **Use context**: Include context lines (2-3) to understand search results
- **Case sensitivity**: Use `-i` flag when case doesn't matter

### Execution
- **Set timeouts**: Always set reasonable timeouts for commands
- **Check results**: Verify command success before assuming it worked
- **Use descriptions**: Add descriptions to commands for clarity

### Web Access
- **Be specific**: Narrow search queries for better results
- **Verify sources**: Check returned information reliability
- **Rate limiting**: Respect rate limits when making requests

---

## Common Patterns

### Pattern 1: Explore then Modify
```rust
// 1. Find relevant files
glob_search({"pattern": "**/*.rs"})

// 2. Read the target file
read_file({"path": "src/main.rs"})

// 3. Make precise edits
edit_file({
    "path": "src/main.rs",
    "old_string": "fn main() {}",
    "new_string": "fn main() { println!(\"Hello\"); }"
})

// 4. Verify changes
read_file({"path": "src/main.rs"})
```

### Pattern 2: Search and Replace Across Files
```rust
// Find all occurrences
grep_search({
    "pattern": "old_function_name",
    "path": ".",
    "glob": "*.rs"
})

// Edit each file (individual calls)
edit_file({...})
edit_file({...})
```

### Pattern 3: Run and Verify
```rust
// Run tests
bash({"command": "cargo test", "description": "Run test suite"})

// Check formatting
bash({"command": "cargo fmt --check", "description": "Check formatting"})

// Run linter
bash({"command": "cargo clippy", "description": "Run clippy"})
```

---

## Security Considerations

### Allowed Operations
- File operations within workspace
- Shell commands with user approval
- Web searches and fetches
- Code execution in sandboxed REPL

### Restricted Operations
- No arbitrary file system access outside workspace
- No network access without explicit tools
- No accessing sensitive user data
- Code injection prevention through input sanitization

---

## Error Handling

### Common Error Types
1. **File Not Found**: Path doesn't exist or insufficient permissions
2. **Timeout**: Command took longer than specified timeout
3. **Invalid Pattern**: Regex or glob pattern syntax error
4. **Network Error**: Web request failures
5. **Tool Not Found**: Requested tool doesn't exist

### Recovery Strategies
- Verify paths before operations
- Check file existence before reading
- Use try-catch logic in scripts
- Provide fallback options for web requests

---

*Document generated for Claw Code environment*
*Repository: /Users/ajitprajapati/Downloads/claw-code-main*
*Last updated: 2026-03-31*
