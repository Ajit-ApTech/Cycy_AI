#!/usr/bin/env python3
# ⚠️ FROZEN — DO NOT MODIFY. This file is deprecated.
# All active development happens in backend/. 
# This file will be deleted after Stage 3 migration is complete.
"""
Cycy AI
======
A terminal-based AI assistant powered by multiple AI backends.

Supported Backends:
- Google Gemini (Cloud API)
- NVIDIA NIM (Cloud)
- OpenAI (Cloud)
- Groq (Cloud - Fast inference)
- Ollama (Local / Offline)
- Custom (Any OpenAI-compatible endpoint)

Features:
- Multi-provider backend selection
- Model selection per provider
- Persistent memory across sessions
- External AI delegation (when the AI can't answer)
- Command execution with user approval
- Local chat history saving
"""

import os
import sys
import json
import subprocess
import requests
import threading
import time
import itertools
import warnings
import re
import asyncio
from datetime import datetime
from dotenv import load_dotenv, set_key, find_dotenv
from backend.agent_executor import AgentExecutor
from backend.core import ChatHistory, OpenAIChat, OpenAIChatResponse

# Suppress annoying warnings
warnings.filterwarnings("ignore", category=FutureWarning)
warnings.filterwarnings("ignore", message="urllib3 v2 only supports OpenSSL 1.1.1+")

# Load existing environment variables
load_dotenv()

try:
    from google import genai
except ImportError:
    genai = None

try:
    from openai import OpenAI
except ImportError:
    OpenAI = None


# ─── Constants ────────────────────────────────────────────────────────────────

# Import centralized constants
from backend.constants import (
    HISTORY_DIR, MEMORY_FILE, BACKENDS, 
    BASE_SYSTEM_PROMPT
)


# ─── Helpers ──────────────────────────────────────────────────────────────────

def print_colored(text, color):
    """Print colored text to terminal."""
    colors = {
        "green": "\033[92m",
        "yellow": "\033[93m",
        "red": "\033[91m",
        "cyan": "\033[96m",
        "magenta": "\033[95m",
        "bold": "\033[1m",
        "dim": "\033[2m",
        "reset": "\033[0m",
    }
    print(f"{colors.get(color, '')}{text}{colors['reset']}")


class LoadingSpinner:
    """Animated loading spinner for terminal feedback."""

    FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"]

    def __init__(self, message="Thinking"):
        self.message = message
        self._stop_event = threading.Event()
        self._thread = None

    def _animate(self):
        for frame in itertools.cycle(self.FRAMES):
            if self._stop_event.is_set():
                break
            sys.stdout.write(f"\r\033[96m{frame} {self.message}...\033[0m")
            sys.stdout.flush()
            time.sleep(0.08)
        # Clear the spinner line
        sys.stdout.write("\r" + " " * (len(self.message) + 10) + "\r")
        sys.stdout.flush()

    def start(self):
        self._stop_event.clear()
        self._thread = threading.Thread(target=self._animate, daemon=True)
        self._thread.start()

    def stop(self):
        self._stop_event.set()
        if self._thread:
            self._thread.join()

    def __enter__(self):
        self.start()
        return self

    def __exit__(self, *args):
        self.stop()


# ─── Memory System ────────────────────────────────────────────────────────────

def load_memory():
    """Load memory from the memory file. Returns the content as a string."""
    if os.path.exists(MEMORY_FILE):
        try:
            with open(MEMORY_FILE, "r", encoding="utf-8") as f:
                content = f.read().strip()
            if content:
                return content
        except IOError as e:
            print_colored(f"⚠️  Could not read memory file: {e}", "yellow")
    return ""


def save_memory(content):
    """Save content to the memory file."""
    try:
        with open(MEMORY_FILE, "w", encoding="utf-8") as f:
            f.write(content)
        return True
    except IOError as e:
        print_colored(f"❌ Could not save memory: {e}", "red")
        return False


def append_memory(new_entry):
    """Append a new entry to the memory file."""
    existing = load_memory()
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M")
    entry = f"\n- [{timestamp}] {new_entry}"
    updated = existing + entry if existing else f"# Cycy Memory\n{entry}"
    return save_memory(updated)


def build_system_prompt():
    """Build the full system prompt with memory context."""
    memory = load_memory()
    if memory:
        return BASE_SYSTEM_PROMPT + f"\n\n--- YOUR MEMORY (things you know about the user) ---\n{memory}\n--- END MEMORY ---\n"
    return BASE_SYSTEM_PROMPT


# ─── UI ───────────────────────────────────────────────────────────────────────

def print_banner(backend_name="", model_name=""):
    """Print the startup banner."""
    print()
    print_colored("╔══════════════════════════════════════════╗", "magenta")
    print_colored("║            ✨ Cycy AI ✨                 ║", "magenta")
    if backend_name and model_name:
        info = f"  Backend: {backend_name} ({model_name})"
        padded = f"║{info:<42}║"
        print_colored(padded, "magenta")
    print_colored("╚══════════════════════════════════════════╝", "magenta")
    print()
    memory = load_memory()
    if memory:
        mem_lines = memory.count("\n")
        print_colored(f"  🧠 Memory loaded ({mem_lines + 1} lines)", "green")
    else:
        print_colored("  🧠 No memories yet. Use /remember to teach me!", "dim")
    print()
    print_colored("Commands:", "dim")
    print_colored("  /remember <fact>   — Teach Cycy something to remember", "dim")
    print_colored("  /memory            — View current memory", "dim")
    print_colored("  /forget            — Clear all memory", "dim")
    print_colored("  /scan <path>       — Add files to AI context", "dim")
    print_colored("  /external <query>  — Ask another AI for help", "dim")
    print_colored("  /run <command>     — Run a shell command", "dim")
    print_colored("  /help              — Show all commands", "dim")
    print_colored("  exit / quit        — End session", "dim")
    print()


def print_help():
    """Print help text."""
    print()
    print_colored("📋 Available Commands:", "bold")
    print_colored("  /remember <fact>   — Teach Cycy something to remember", "yellow")
    print_colored("  /memory            — View current memory", "yellow")
    print_colored("  /forget            — Clear all memory", "yellow")
    print_colored("  /scan <path>       — Add files or directories to AI context", "yellow")
    print_colored("  /external <query>  — Manually trigger external AI delegation", "yellow")
    print_colored("  /run <command>     — Execute a shell command directly", "yellow")
    print_colored("  /help              — Show this help message", "yellow")
    print_colored("  exit / quit        — End the session and save history", "yellow")
    print()


# ─── Backend Selection ───────────────────────────────────────────────────────

def select_backend():
    """Let user choose which AI backend to use."""
    print()
    print_colored("🔧 Select AI Backend:", "bold")
    print()

    backend_keys = list(BACKENDS.keys())
    for i, key in enumerate(backend_keys, 1):
        b = BACKENDS[key]
        label = f"   {i}. {b['name']:<14} ({b['description']})"
        print_colored(label, "cyan")

    print()
    choice = input(f"Select (1-{len(backend_keys)}) or press Enter for Gemini: ").strip()

    if not choice:
        return "gemini"

    try:
        idx = int(choice) - 1
        if 0 <= idx < len(backend_keys):
            selected = backend_keys[idx]
        else:
            print_colored("⚠️  Invalid choice. Using Gemini.", "yellow")
            selected = "gemini"
    except ValueError:
        print_colored("⚠️  Invalid input. Using Gemini.", "yellow")
        selected = "gemini"

    print_colored(f"✅ Backend: {BACKENDS[selected]['name']}", "green")
    return selected


# ─── API Key ──────────────────────────────────────────────────────────────────

def get_api_key(backend_key):
    """Get API key for the selected backend."""
    backend = BACKENDS[backend_key]

    # Ollama doesn't need an API key
    if backend_key == "ollama":
        return "ollama"  # placeholder, Ollama doesn't need a real key

    # Custom — ask for key (optional)
    if backend_key == "custom":
        print_colored("🔑 Enter API key (or press Enter if not required):", "yellow")
        api_key = input("   API Key: ").strip()
        return api_key if api_key else "no-key-needed"

    # Check environment variable
    env_key = backend.get("env_key")
    saved_key = os.environ.get(env_key, "").strip() if env_key else None
    
    if saved_key:
        print_colored(f"✅ Found saved API key for {backend['name']}.", "green")
        if "CYCY_PROVIDER" in os.environ:
            # We are in Electron, skip the prompt
            return saved_key
            
        use_saved = input("   Use saved key? (Y/n): ").strip().lower()
        if use_saved in ["", "y", "yes"]:
            return saved_key

    # Prompt user for new key
    key_url = backend.get("key_url", "")
    url_hint = f" (get one at {key_url})" if key_url else ""
    print_colored(f"🔑 Enter your {backend['name']} API key{url_hint}:", "yellow")
    api_key = input("   API Key: ").strip()

    if not api_key:
        print_colored("❌ No API key provided. Exiting.", "red")
        sys.exit(1)
        
    # Offer to save key
    if env_key:
        save = input("   Save this key for future use? (y/N): ").strip().lower()
        if save in ["y", "yes"]:
            env_file = find_dotenv()
            if not env_file:
                env_file = ".env"
                with open(env_file, "w") as f:
                     pass # Create if not exists
            
            try:
                set_key(env_file, env_key, api_key)
                print_colored(f"✅ Key saved to {env_file}", "green")
                # Reload env to ensure it's available for this session if needed elsewhere
                load_dotenv(override=True)
            except Exception as e:
                print_colored(f"⚠️  Could not save key: {e}", "yellow")

    return api_key


# ─── Ollama Check ────────────────────────────────────────────────────────────

def check_ollama_running():
    """Check if Ollama is running locally."""
    try:
        r = requests.get("http://localhost:11434/api/tags", timeout=3)
        if r.status_code == 200:
            print_colored("✅ Ollama is running.", "green")
            return True
    except requests.ConnectionError:
        pass
    except Exception:
        pass

    print_colored("❌ Ollama is not running!", "red")
    print_colored("   Start it with: ollama serve", "yellow")
    print_colored("   Install from:  https://ollama.com/download", "yellow")
    print()

    retry = input("Retry? (y/n): ").strip().lower()
    if retry == "y":
        return check_ollama_running()

    sys.exit(1)


# ─── Model Selection ─────────────────────────────────────────────────────────

def select_gemini_model(api_key):
    """List available Gemini models and let user choose."""
    genai.configure(api_key=api_key)

    print_colored("\n📡 Fetching available models...", "cyan")
    try:
        models = []
        for m in genai.list_models():
            if "generateContent" in m.supported_generation_methods:
                models.append(m.name)
    except Exception as e:
        print_colored(f"❌ Failed to fetch models: {e}", "red")
        print_colored("⚠️  Using default model: gemini-2.0-flash", "yellow")
        return "gemini-2.0-flash"

    if not models:
        print_colored("⚠️  No models found. Using default: gemini-2.0-flash", "yellow")
        return "gemini-2.0-flash"

    clean_names = [m.replace("models/", "") for m in models]

    print_colored("\n📋 Available Models:", "bold")
    for i, name in enumerate(clean_names, 1):
        print(f"   {i}. {name}")

    print()
    default = BACKENDS["gemini"]["default_model"]
    choice = input(f"Select model (1-{len(clean_names)}) or press Enter for default [{default}]: ").strip()

    if not choice:
        selected = default
    else:
        try:
            idx = int(choice) - 1
            if 0 <= idx < len(clean_names):
                selected = clean_names[idx]
            else:
                print_colored("⚠️  Invalid choice. Using default.", "yellow")
                selected = default
        except ValueError:
            print_colored("⚠️  Invalid input. Using default.", "yellow")
            selected = default

    print_colored(f"✅ Using model: {selected}", "green")
    return selected


def select_ollama_model():
    """List locally available Ollama models and let user choose."""
    print_colored("\n📡 Fetching local Ollama models...", "cyan")

    try:
        r = requests.get("http://localhost:11434/api/tags", timeout=5)
        data = r.json()
        models = [m["name"] for m in data.get("models", [])]
    except Exception as e:
        print_colored(f"❌ Failed to list Ollama models: {e}", "red")
        default = BACKENDS["ollama"]["default_model"]
        print_colored(f"⚠️  Using default: {default}", "yellow")
        return default

    if not models:
        print_colored("❌ No models found! Pull one first:", "red")
        print_colored("   ollama pull llama3.2", "yellow")
        print_colored("   ollama pull mistral", "yellow")
        print_colored("   ollama pull gemma2:2b", "yellow")
        sys.exit(1)

    print_colored("\n📋 Available Local Models:", "bold")
    for i, name in enumerate(models, 1):
        print(f"   {i}. {name}")

    print()
    choice = input(f"Select model (1-{len(models)}) or press Enter for [{models[0]}]: ").strip()

    if not choice:
        selected = models[0]
    else:
        try:
            idx = int(choice) - 1
            if 0 <= idx < len(models):
                selected = models[idx]
            else:
                print_colored("⚠️  Invalid choice. Using first model.", "yellow")
                selected = models[0]
        except ValueError:
            print_colored("⚠️  Invalid input. Using first model.", "yellow")
            selected = models[0]

    print_colored(f"✅ Using model: {selected}", "green")
    return selected


def _display_model_page(models, page, page_size, default):
    """Display a single page of models."""
    total_pages = (len(models) + page_size - 1) // page_size
    start = page * page_size
    end = min(start + page_size, len(models))
    page_models = models[start:end]

    print_colored(f"\n📋 Available Models ({len(models)} total) — Page {page + 1}/{total_pages}:", "bold")
    for i, name in enumerate(page_models, start + 1):
        marker = " ⭐" if name == default else ""
        print(f"   {i}. {name}{marker}")

    print()
    print_colored("  Navigation:", "dim")
    if page > 0:
        print_colored("    /prev          — Previous page", "dim")
    if page < total_pages - 1:
        print_colored("    /next          — Next page", "dim")
    print_colored("    /all           — Show all models", "dim")
    print_colored("    /search <text> — Filter models by name", "dim")

    return page_models, start


def select_openai_model(client, backend_key):
    """List models from an OpenAI-compatible API and let user choose."""
    backend = BACKENDS[backend_key]
    default = backend.get("default_model", "")

    print_colored("\n📡 Fetching available models...", "cyan")

    try:
        response = client.models.list()
        models = sorted([m.id for m in response.data])
    except Exception as e:
        print_colored(f"⚠️  Could not fetch model list: {e}", "yellow")
        if default:
            print_colored(f"   Using default: {default}", "yellow")
            return default
        model_name = input("   Enter model name manually: ").strip()
        return model_name if model_name else "gpt-4o-mini"

    if not models:
        if default:
            print_colored(f"⚠️  No models listed. Using default: {default}", "yellow")
            return default
        model_name = input("   Enter model name manually: ").strip()
        return model_name if model_name else "gpt-4o-mini"

    PAGE_SIZE = 30
    current_page = 0
    display_list = models  # the active list (full or filtered)

    _display_model_page(display_list, current_page, PAGE_SIZE, default)

    while True:
        print()
        default_hint = f" [{default}]" if default else ""
        choice = input(f"Select (number/name), or command (/next /prev /all /search){default_hint}: ").strip()

        if not choice:
            selected = default if default else display_list[0]
            print_colored(f"✅ Using model: {selected}", "green")
            return selected

        # ── Navigation commands ──
        if choice.lower() == "/next":
            total_pages = (len(display_list) + PAGE_SIZE - 1) // PAGE_SIZE
            if current_page < total_pages - 1:
                current_page += 1
                _display_model_page(display_list, current_page, PAGE_SIZE, default)
            else:
                print_colored("⚠️  Already on the last page.", "yellow")
            continue

        if choice.lower() == "/prev":
            if current_page > 0:
                current_page -= 1
                _display_model_page(display_list, current_page, PAGE_SIZE, default)
            else:
                print_colored("⚠️  Already on the first page.", "yellow")
            continue

        if choice.lower() == "/all":
            print_colored(f"\n📋 All Available Models ({len(models)} total):", "bold")
            for i, name in enumerate(models, 1):
                marker = " ⭐" if name == default else ""
                print(f"   {i}. {name}{marker}")
            display_list = models
            current_page = 0
            continue

        if choice.lower().startswith("/search"):
            keyword = choice[7:].strip().lower()
            if not keyword:
                print_colored("⚠️  Usage: /search <keyword>  (e.g. /search gpt)", "yellow")
                continue
            filtered = [m for m in models if keyword in m.lower()]
            if not filtered:
                print_colored(f"⚠️  No models matching '{keyword}'.", "yellow")
                continue
            display_list = filtered
            current_page = 0
            _display_model_page(display_list, current_page, PAGE_SIZE, default)
            continue

        # ── Number selection ──
        if choice.isdigit():
            idx = int(choice) - 1
            if 0 <= idx < len(display_list):
                selected = display_list[idx]
            else:
                print_colored(f"⚠️  Invalid number. Enter 1-{len(display_list)}.", "yellow")
                continue
        else:
            # User typed a model name directly
            selected = choice

        print_colored(f"✅ Using model: {selected}", "green")
        return selected


# ─── Chat Classes imported from backend.core ─────────────────────────────────


# ─── Chat History imported from backend.core ──────────────────────────────────


# ─── Command Safety Classification ───────────────────────────────────────────

# Commands that are safe to auto-run (read-only, no side effects)
SAFE_COMMAND_PREFIXES = [
    # File/directory reading
    "ls", "cat", "head", "tail", "less", "more", "wc", "file", "stat",
    "find", "locate", "tree", "du", "df", "readlink", "realpath",
    # Text search/processing (read-only)
    "grep", "egrep", "fgrep", "rg", "ag", "awk", "sed -n", "sort",
    "uniq", "cut", "tr", "diff", "comm", "fold", "fmt", "nl",
    # System info
    "pwd", "echo", "printf", "whoami", "hostname", "uname", "uptime",
    "date", "cal", "env", "printenv", "which", "where", "type",
    "id", "groups", "arch", "sw_vers", "system_profiler",
    # Process info
    "ps", "top -l", "htop", "pgrep", "lsof",
    # Network info (read-only)
    "ping", "traceroute", "nslookup", "dig", "host", "ifconfig",
    "ip addr", "ip route", "netstat", "ss", "curl -s", "curl --silent",
    "wget -q", "wget --spider",
    # Version checks
    "python --version", "python3 --version", "node --version",
    "npm --version", "java --version", "javac --version",
    "ruby --version", "go version", "rustc --version", "cargo --version",
    "git --version", "docker --version", "gcc --version", "g++ --version",
    "swift --version", "pip --version", "pip3 --version",
    # Git (read-only)
    "git status", "git log", "git diff", "git show", "git branch",
    "git tag", "git remote", "git stash list", "git blame",
    "git shortlog", "git rev-parse", "git ls-files", "git ls-tree",
    # Package info (read-only)
    "pip list", "pip show", "pip3 list", "pip3 show", "pip freeze",
    "npm list", "npm ls", "npm view", "npm info", "npm outdated",
    "brew list", "brew info", "brew search",
    # Docker (read-only)
    "docker ps", "docker images", "docker logs", "docker inspect",
    "docker stats", "docker info",
]

# Commands/patterns that are ALWAYS destructive (never auto-run)
DESTRUCTIVE_PATTERNS = [
    "rm ", "rm\t", "rmdir", "mv ", "cp ", "chmod", "chown", "chgrp",
    "mkdir", "touch", "ln ", "install", "uninstall",
    "sudo", "su ", "doas",
    "kill", "killall", "pkill",
    "dd ", "mkfs", "fdisk", "mount", "umount",
    "apt", "yum", "dnf", "pacman", "snap",
    "pip install", "pip3 install", "pip uninstall", "pip3 uninstall",
    "npm install", "npm uninstall", "npm update", "npm ci",
    "npx", "yarn add", "yarn remove",
    "brew install", "brew uninstall", "brew upgrade", "brew remove",
    "docker run", "docker rm", "docker rmi", "docker stop", "docker kill",
    "git push", "git commit", "git merge", "git rebase", "git reset",
    "git checkout", "git switch", "git restore", "git clean", "git stash drop",
    "sed -i", "truncate", "shred",
    "systemctl", "service", "launchctl",
    "reboot", "shutdown", "halt", "poweroff",
    "crontab -e", "crontab -r",
]


def is_safe_command(command):
    """
    Classify a command as safe (read-only) or destructive.
    Returns True if the command is safe to auto-run.
    Uses a conservative approach: only whitelisted commands auto-run.
    """
    cmd = command.strip()

    # Never auto-run commands with output redirects or pipes to destructive cmds
    if ">" in cmd or ">>" in cmd:
        return False

    # Check for explicit destructive patterns first
    cmd_lower = cmd.lower()
    for pattern in DESTRUCTIVE_PATTERNS:
        if cmd_lower.startswith(pattern) or f"| {pattern}" in cmd_lower or f"|{pattern}" in cmd_lower:
            return False

    # Check if command matches a known safe prefix
    for safe_prefix in SAFE_COMMAND_PREFIXES:
        if cmd_lower == safe_prefix or cmd_lower.startswith(safe_prefix + " ") or cmd_lower.startswith(safe_prefix + "\t"):
            return True

    # Default: not safe, require confirmation
    return False


# ─── Command Execution ───────────────────────────────────────────────────────

def execute_command(command):
    """Run a shell command with smart approval and real-time output streaming."""
    print()

    safe = is_safe_command(command)

    if safe:
        # Auto-run safe commands
        print_colored("⚡ Auto-running (safe command):", "green")
        print_colored(f"   $ {command}", "bold")
    else:
        # Prompt for destructive commands
        print_colored("⚠️  This command may modify your system:", "yellow")
        print_colored(f"   $ {command}", "bold")
        print()
        sys.stdout.flush() # CRITICAL: Ensure prompt is visible in Electron PTY
        confirm = input("Run this command? (y/n): ").strip().lower()
        if confirm != "y":
            print_colored("⏭️  Skipped.", "dim")
            return "[Command skipped by user]"

    print(f"\n[STATUS: RUNNING_COMMAND] {command}")
    sys.stdout.flush()
    print_colored(f"\n⚡ Executing command (output forwarded to terminal)...", "cyan")

    try:
        process = subprocess.Popen(
            command,
            shell=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            bufsize=1,
        )

        sys.stderr.write(f"\r\n\033[1;36m$ {command}\033[0m\r\n")
        sys.stderr.flush()

        output_lines = []
        for line in process.stdout:
            line_stripped = line.rstrip("\n")
            sys.stderr.write(line_stripped + "\r\n")
            sys.stderr.flush()
            output_lines.append(line_stripped)

        process.wait(timeout=120)

        output = "\n".join(output_lines)
        if process.returncode != 0:
            output += f"\n[exit code: {process.returncode}]"
            sys.stderr.write(f"\033[1;33m⚠️ Exit code: {process.returncode}\033[0m\r\n")
            sys.stderr.flush()

        else:
            sys.stderr.write("\033[1;32m✓ Done\033[0m\r\n")
            sys.stderr.flush()

        print("\n[STATUS: COMMAND_FINISHED]")
        sys.stdout.flush()
        return output.strip()
    except subprocess.TimeoutExpired:
        process.kill()
        msg = "[Command timed out after 120 seconds]"
        print_colored(msg, "red")
        return msg
    except Exception as e:
        msg = f"[Command failed: {e}]"
        print_colored(msg, "red")
        return msg


# ─── File Scanning & Context ──────────────────────────────────────────────────

def process_scanned_files(files_to_read):
    """Read files and format them for context injection."""
    context_blocks = []
    for filepath in files_to_read:
        try:
            with open(filepath, "r", encoding="utf-8") as f:
                content = f.read()
            formatted = f"--- START FILE: {os.path.basename(filepath)} ({filepath}) ---\n{content}\n--- END FILE: {os.path.basename(filepath)} ---\n"
            context_blocks.append(formatted)
        except Exception as e:
            print_colored(f"⚠️  Could not read {filepath}: {e}", "yellow")
    return "\n".join(context_blocks)

def handle_scan_command(target_path):
    """Scans path, applies filters, previews list, returns compiled contents."""
    target_path = os.path.abspath(target_path)
    
    if not os.path.exists(target_path):
        print_colored(f"❌ Path not found: {target_path}", "red")
        return None

    files_to_process = []
    skipped_files = [] 
    
    if os.path.isfile(target_path):
        size = os.path.getsize(target_path)
        if size > MAX_FILE_SIZE:
            skipped_files.append((target_path, f"Size {size/1024:.1f}KB exceeds 100KB limit"))
        else:
            files_to_process.append(target_path)
    else:
        for root, dirs, files in os.walk(target_path):
            dirs[:] = [d for d in dirs if d not in IGNORE_DIRS]
            for file in files:
                ext = os.path.splitext(file)[1].lower()
                if ext not in ALLOWED_EXTENSIONS:
                    continue
                filepath = os.path.join(root, file)
                size = os.path.getsize(filepath)
                if size > MAX_FILE_SIZE:
                    skipped_files.append((filepath, f"Size {size/1024:.1f}KB exceeds 100KB limit"))
                else:
                    files_to_process.append(filepath)

    if not files_to_process:
        print_colored("⚠️  No suitable text/code files found or all skipped.", "yellow")
        if skipped_files:
            print_colored(f"   (Skipped {len(skipped_files)} files due to size limits)", "dim")
        return None

    print()
    print_colored(f"🔍 Discovered {len(files_to_process)} files to include:", "bold")
    for f in files_to_process[:20]:
        size = os.path.getsize(f)
        rel_path = os.path.relpath(f, target_path) if os.path.isdir(target_path) else os.path.basename(f)
        print_colored(f"   - {rel_path} ({size/1024:.1f} KB)", "cyan")
    
    if len(files_to_process) > 20:
        print_colored(f"   ... and {len(files_to_process) - 20} more.", "cyan")

    if skipped_files:
        print_colored(f"\n🚫 Skipped {len(skipped_files)} oversized files:", "yellow")
        for f, reason in skipped_files[:5]:
            rel_path = os.path.relpath(f, target_path) if os.path.isdir(target_path) else os.path.basename(f)
            print_colored(f"   - {rel_path} ({reason})", "dim")
        if len(skipped_files) > 5:
            print_colored(f"   ... and {len(skipped_files) - 5} more.", "dim")

    print()
    confirm = input("Add these files to the AI's context? (y/n): ").strip().lower()
    if confirm != "y":
        print_colored("⏭️  Scan aborted. No files added.", "dim")
        return None

    print_colored("\n⏳ Reading and processing files...", "cyan")
    return process_scanned_files(files_to_process)


def handle_search_code(query):
    """Search for code using grep or Python."""
    print_colored(f"🔍 Searching for: {query}", "cyan")
    try:
        # Use grep -r to search recursively
        # -I ignore binary files, -n show line numbers, -i case insensitive
        # Exclude common ignore dirs
        exclude_args = " ".join([f'--exclude-dir="{d}"' for d in IGNORE_DIRS])
        command = f'grep -rIn {exclude_args} "{query}" .'
        
        process = subprocess.Popen(
            command,
            shell=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True
        )
        stdout, stderr = process.communicate(timeout=30)
        
        if not stdout.strip():
            return f"No matches found for '{query}'."
        
        # Limit output to first 50 matches to avoid token explosion
        lines = stdout.strip().split("\n")
        result = "\n".join(lines[:50])
        if len(lines) > 50:
            result += f"\n... and {len(lines) - 50} more matches."
        return result
    except Exception as e:
        return f"Search failed: {e}"


def handle_find_file(pattern):
    """Find files by name pattern."""
    print_colored(f"🔍 Finding files matching: {pattern}", "cyan")
    try:
        # Use find to locate files
        # Exclude common ignore dirs
        prune_args = " -o ".join([f'-path "./{d}" -prune' for d in IGNORE_DIRS])
        if prune_args:
            command = f'find . \( {prune_args} \) -o -name "{pattern}" -print'
        else:
            command = f'find . -name "{pattern}"'
            
        process = subprocess.Popen(
            command,
            shell=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True
        )
        stdout, stderr = process.communicate(timeout=30)
        
        if not stdout.strip():
            return f"No files found matching '{pattern}'."
            
        lines = [line for line in stdout.strip().split("\n") if not any(d in line for d in IGNORE_DIRS)]
        result = "\n".join(lines[:50])
        if len(lines) > 50:
            result += f"\n... and {len(lines) - 50} more files."
        return result
    except Exception as e:
        return f"Find failed: {e}"


# ─── External AI Delegation ──────────────────────────────────────────────────

def handle_external_delegation(prompt_for_external):
    """Handle the external AI delegation flow."""
    print()
    print_colored("🌐 Needs external help. Copy this prompt into another AI:", "yellow")
    print_colored("─" * 50, "dim")
    print(prompt_for_external.strip())
    print_colored("─" * 50, "dim")
    print()

    print_colored("Paste the response below (type END on a new line when done):", "cyan")
    lines = []
    while True:
        try:
            line = input()
            if line.strip().upper() == "END":
                break
            lines.append(line)
        except EOFError:
            break

    response = "\n".join(lines)
    if not response.strip():
        return "[No external response provided]"
    return response


# ─── Response Processing ─────────────────────────────────────────────────────

def get_streaming_response(chat, prompt, attachments=None):
    """Handles streaming tokens from chat, detects thoughts, and returns full text."""
    full_text = []
    in_thought = False
    
    # Check if chat is Gemini (google.generativeai) or OpenAIChat
    is_gemini = hasattr(chat, "model") and not hasattr(chat, "client") 
    
    try:
        if is_gemini:
            # For Gemini, attachments are passed as parts
            content = [prompt]
            if attachments:
                for att in attachments:
                    if att.get("type", "").startswith("image/"):
                        content.append({
                            "mime_type": att["type"],
                            "data": att["base64"]
                        })
            response_stream = chat.send_message(content, stream=True)
        else:
            # For OpenAI-compatible
            response_stream = chat.send_message_stream(prompt, attachments=attachments)

        print(f"\n{TURN_START_TAG}", end="", flush=True)
        print("\n🤖 ", end="", flush=True)
        
        for chunk in response_stream:
            token = chunk.text if is_gemini else chunk
            if token:
                # Detect tags like <thought> or [THOUGHT] 
                # Some models use <thought>...</thought>
                if "<thought>" in token.lower():
                    token = token.replace("<thought>", "[THOUGHT]")
                    in_thought = True
                if "</thought>" in token.lower():
                    token = token.replace("</thought>", "[/THOUGHT]")
                    in_thought = False
                
                print(token, end="", flush=True)
                full_text.append(token)
        
        print() 
        return "".join(full_text)
    except Exception as e:
        error_msg = f"[API Error: {e}]"
        print_colored(f"\n❌ {error_msg}", "red")
        return error_msg

def process_response(response_text, chat, history):
    """Check response for special tags and handle them."""

    # Check for [NEED_EXTERNAL]
    if NEED_EXTERNAL_TAG in response_text:
        parts = response_text.split(NEED_EXTERNAL_TAG, 1)
        before_tag = parts[0].strip()
        prompt_for_external = parts[1].strip() if len(parts) > 1 else ""

        if prompt_for_external:
            external_response = handle_external_delegation(prompt_for_external)
            history.add_message("external_ai", external_response)

            prompt = f"Here is the response from the external AI:\n\n{external_response}\n\nPlease use this information to answer the original question."
            followup_text = get_streaming_response(chat, prompt)
            
            history.add_message("assistant", followup_text)
            process_response(followup_text, chat, history)
        return True

    # Check for [RUN_CMD] dynamically using regex to catch (RUN_CMD), <RUN_CMD>, etc.
    run_cmd_match = re.search(r"[[<({]?RUN_CMD[]>})]?\s*(.*)", response_text, re.IGNORECASE | re.DOTALL)
    if run_cmd_match:
        before_tag = response_text[:run_cmd_match.start()].strip()
        command = run_cmd_match.group(1).strip()

        if command:
            command = command.split("\n")[0].strip().strip("`")
            cmd_output = execute_command(command)
            history.add_message("command_output", f"$ {command}\n{cmd_output}")

            prompt = f"Command executed: `{command}`\n\nOutput:\n```\n{cmd_output}\n```\n\nPlease analyze this output and continue."
            followup_text = get_streaming_response(chat, prompt)
            
            history.add_message("assistant", followup_text)
            process_response(followup_text, chat, history)
        return True

    # Check for [SEARCH_CODE]
    search_code_match = re.search(r"\[SEARCH_CODE\]\s*(.*)", response_text, re.IGNORECASE)
    if search_code_match:
        query = search_code_match.group(1).strip().strip("`").strip('"')
        if query:
            results = handle_search_code(query)
            history.add_message("search_results", f"Search results for '{query}':\n{results}")

            prompt = f"Search results for `{query}`:\n```\n{results}\n```\n\nPlease analyze these results and continue."
            followup_text = get_streaming_response(chat, prompt)
            
            history.add_message("assistant", followup_text)
            process_response(followup_text, chat, history)
        return True

    # Check for [FIND_FILE]
    find_file_match = re.search(r"\[FIND_FILE\]\s*(.*)", response_text, re.IGNORECASE)
    if find_file_match:
        pattern = find_file_match.group(1).strip().strip("`").strip('"')
        if pattern:
            results = handle_find_file(pattern)
            history.add_message("find_results", f"Files found matching '{pattern}':\n{results}")

            prompt = f"Files found matching `{pattern}`:\n```\n{results}\n```\n\nPlease analyze these results and continue."
            followup_text = get_streaming_response(chat, prompt)
            
            history.add_message("assistant", followup_text)
            process_response(followup_text, chat, history)
        return True

    # Normal response - should be handled by caller usually, but as fallback:
    # print(f"\n🤖 {response_text}") 
    return False


# ─── Setup Backend ───────────────────────────────────────────────────────────

def setup_backend(backend_key):
    """Set up the selected backend. Returns (chat, model_name, backend_display_name)."""

    backend = BACKENDS[backend_key]
    # Check if launched from Electron with a pre-selected model
    preset_model = os.environ.get("CYCY_MODEL", "").strip()

    # ── Gemini ──
    if backend_key == "gemini":
        if genai is None:
            print_colored("❌ google-generativeai is not installed.", "red")
            print_colored("   Run: pip install google-generativeai", "yellow")
            sys.exit(1)

        api_key = get_api_key(backend_key)
        model_name = preset_model if preset_model else select_gemini_model(api_key)

        system_prompt = build_system_prompt()
        model = genai.GenerativeModel(
            model_name=model_name,
            system_instruction=system_prompt,
        )
        chat = model.start_chat()
        return chat, model_name, backend["name"]

    # ── All OpenAI-compatible backends ──
    if OpenAI is None:
        print_colored("❌ openai package is not installed.", "red")
        print_colored("   Run: pip install openai", "yellow")
        sys.exit(1)

    # Ollama — check if running first
    if backend_key == "ollama":
        check_ollama_running()

    # Custom — ask for URL
    if backend_key == "custom":
        custom_url = os.environ.get("CYCY_CUSTOM_URL", "").strip()
        if not custom_url:
            print_colored("\n🔗 Enter the API base URL (e.g., http://localhost:1234/v1):", "yellow")
            custom_url = input("   URL: ").strip()
        if not custom_url:
            print_colored("❌ No URL provided. Exiting.", "red")
            sys.exit(1)
        backend["base_url"] = custom_url

    api_key = get_api_key(backend_key)

    client = OpenAI(
        base_url=backend["base_url"],
        api_key=api_key,
    )

    # Select model
    if preset_model:
        model_name = preset_model
    elif backend_key == "ollama":
        model_name = select_ollama_model()
    else:
        model_name = select_openai_model(client, backend_key)

    system_prompt = build_system_prompt()
    chat = OpenAIChat(client, model_name, system_prompt)
    return chat, model_name, backend["name"]


# ─── Main Loop ────────────────────────────────────────────────────────────────

async def main():
    if not os.environ.get("CYCY_SILENT_START"):
        print()
        print_colored("╔══════════════════════════════════════════╗", "magenta")
        print_colored("║            ✨ Cycy AI ✨                 ║", "magenta")
        print_colored("╚══════════════════════════════════════════╝", "magenta")

    # Detect if we are running non-interactively (e.g. from Electron)
    is_electron = (
        os.environ.get("CYCY_PROVIDER") or
        os.environ.get("CYCY_SILENT_START") or
        not sys.stdin.isatty()
    )

    # If launched with --provider (from Electron UI), skip interactive select
    if os.environ.get("CYCY_PROVIDER"):
        backend_key = os.environ["CYCY_PROVIDER"].lower()
        if backend_key not in BACKENDS:
            print_colored(f"Unknown provider '{backend_key}', falling back to gemini.", "yellow")
            backend_key = "gemini"
        # Inject the API key into the env so get_api_key() picks it up
        api_key = os.environ.get("CYCY_API_KEY", "")
        env_key = BACKENDS[backend_key].get("env_key")
        if api_key and env_key:
            os.environ[env_key] = api_key
    elif is_electron:
        # Launched from Electron but no provider set yet — default to gemini silently
        backend_key = "gemini"
    else:
        # Interactive terminal mode
        backend_key = select_backend()
    chat, model_name, backend_display = setup_backend(backend_key)
    history = ChatHistory(model_name, backend_display)

    # Show full banner with backend info
    input_queue = asyncio.Queue()
    async def input_reader():
        loop = asyncio.get_event_loop()
        while True:
            # Real-time stdin reading without blocking the event loop
            line = await loop.run_in_executor(None, sys.stdin.readline)
            if not line: 
                await input_queue.put(None)
                break
            text = line.strip()
            
            # CRITICAL: Intercept /answer commands immediately to resolve HITL futures
            if text.lower().startswith("/answer "):
                parts = text.split(" ", 2)
                if len(parts) >= 3:
                    req_id = parts[1]
                    answer = parts[2]
                    from backend.agent_executor import user_bridge
                    user_bridge.resolve(req_id, answer)
                continue
                
            await input_queue.put(text)

    asyncio.create_task(input_reader())

    # Main Chat Lifecycle
    while True:
        user_input = await input_queue.get()
        if user_input is None: break
        if not user_input: continue
        
        # /exit or /quit
        if user_input.lower() in ["exit", "quit"]:
            print_colored("\n👋 Session ended.", "cyan")
            break

        if not user_input:
            continue

        # ── Built-in commands ──
        if user_input.lower() in ("exit", "quit"):
            print_colored("\n👋 Session ended. Chat saved!", "cyan")
            break

        if user_input.lower() == "/help":
            print_help()
            continue

        # /remember <fact> — save to memory
        if user_input.lower().startswith("/remember "):
            fact = user_input[10:].strip()
            if fact:
                if append_memory(fact):
                    print_colored(f"🧠 Got it! I'll remember: {fact}", "green")
                else:
                    print_colored("❌ Failed to save memory.", "red")
            else:
                print_colored("⚠️  Usage: /remember <something to remember>", "yellow")
            continue

        # /memory — view memory
        if user_input.lower() == "/memory":
            memory = load_memory()
            if memory:
                print()
                print_colored("🧠 Cycy's Memory:", "bold")
                print_colored("─" * 40, "dim")
                print(memory)
                print_colored("─" * 40, "dim")
            else:
                print_colored("🧠 No memories yet. Use /remember to teach me!", "dim")
            continue

        # /forget — clear memory
        if user_input.lower() == "/forget":
            if is_electron:
                # In Electron/Non-interactive, just clear it or ask via bridge
                if save_memory(""):
                    print_colored("🧠 Memory cleared.", "green")
                continue
            confirm = input("⚠️  Clear all of Cycy's memory? (y/n): ").strip().lower()
            if confirm == "y":
                if save_memory(""):
                    print_colored("🧠 Memory cleared.", "green")
                else:
                    print_colored("❌ Failed to clear memory.", "red")
            else:
                print_colored("⏭️  Cancelled.", "dim")
            continue

        if user_input.lower().startswith("/search "):
            query = user_input[8:].strip()
            if query:
                results = handle_search_code(query)
                print_colored(f"\n🔍 Search Results:\n{results}", "cyan")
                history.add_message("user", f"/search {query}")
                history.add_message("search_results", results)
            continue

        # /find <pattern> — direct file finding
        if user_input.lower().startswith("/find "):
            pattern = user_input[6:].strip()
            if pattern:
                results = handle_find_file(pattern)
                print_colored(f"\n🔍 Files Found:\n{results}", "cyan")
                history.add_message("user", f"/find {pattern}")
                history.add_message("find_results", results)
                
                try:
                    find_context = f"Analyze file find results for '{pattern}':\n{results}"
                    executor = AgentExecutor(chat, model_name, build_system_prompt())
                    await executor.execute_task(find_context)
                except Exception as e:
                    print_colored(f"❌ AI error: {e}", "red")
            continue

        # Attempt to parse JSON (from Electron bridge)
        attachments = []
        raw_user_input = user_input
        try:
            data = json.loads(user_input)
            if isinstance(data, dict) and "text" in data:
                user_input = data["text"]
                attachments = data.get("attachments", [])
        except json.JSONDecodeError:
            pass

        # /scan <dir> — file scanning
        if user_input.lower().startswith("/scan"):
            path = user_input[6:].strip()
            if not path:
                print_colored("⚠️  Usage: /scan <directory or file path>", "yellow")
                continue
                
            file_context = handle_scan_command(path)
            if file_context:
                history.add_message("user", f"/scan {path} (Context provided directly to AI)")
                try:
                    scan_context = f"New file context injected for scanning path '{path}':\n{file_context}\nAcknowledge this context."
                    executor = AgentExecutor(chat, model_name, build_system_prompt())
                    await executor.execute_task(scan_context)
                except Exception as e:
                    print_colored(f"❌ AI error: {e}", "red")
            continue

        # /run <cmd> — manual command execution
        if user_input.lower().startswith("/run "):
            command = user_input[5:].strip()
            if command:
                cmd_output = execute_command(command)
                history.add_message("user", f"/run {command}")
                history.add_message("command_output", cmd_output)

                try:
                    with LoadingSpinner("Analyzing output"):
                        response = chat.send_message(
                            f"The user manually ran this command:\n`{command}`\n\nOutput:\n```\n{cmd_output}\n```\n\nAcknowledge and help if needed."
                        )
                    history.add_message("assistant", response.text)
                    print(f"\n🤖 {response.text}")
                except Exception as e:
                    print_colored(f"❌ AI error: {e}", "red")
            continue

        # /external <query> — manual external delegation
        if user_input.lower().startswith("/external "):
            query = user_input[10:].strip()
            if query:
                external_response = handle_external_delegation(query)
                history.add_message("user", f"/external {query}")
                history.add_message("external_ai", external_response)

                try:
                    with LoadingSpinner("Processing"):
                        response = chat.send_message(
                            f"The user got this response from an external AI about: {query}\n\nResponse:\n{external_response}\n\nPlease analyze and help."
                        )
                    history.add_message("assistant", response.text)
                    print(f"\n🤖 {response.text}")
                except Exception as e:
                    print_colored(f"❌ AI error: {e}", "red")
            continue

        # ── Normal chat ──
        history.add_message("user", user_input)

        try:
            context_injected_prompt = f"[System Context: Current Working Directory is {os.getcwd()}]\n\n{user_input}"
            
            # ACIB: Initialize AgentExecutor for current turn
            executor = AgentExecutor(chat, model_name, build_system_prompt())
            
            # We run the task in the same loop but the loop's 'input' is async now
            # so user_bridge.ask() can be resolved by a concurrent /answer command 
            # if we were to allow multiple tasks. 
            # For now, we await it, but since read_stdin is a generator, 
            # we need to be careful.
            
            # FIX: Execute task. While this is awaiting, the loop is blocked.
            # We actually need a separate task for reading stdin if we want to resolve HITL
            # during an active await.
            
            await executor.execute_task(context_injected_prompt)
            
        except Exception as e:
            print_colored(f"\n❌ Error: {e}", "red")
            print_colored("   Try again or type 'exit' to quit.\n", "dim")

    print_colored(f"\n📁 Chat history saved to: {history.filepath}", "green")
    print()


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="Cycy AI Assistant")
    parser.add_argument("--web", action="store_true", help="Launch the Web Dashboard")
    parser.add_argument("--provider", type=str, help="AI provider key (gemini, nvidia_nim, openai, groq, ollama, glm, custom)")
    parser.add_argument("--model", type=str, help="Model name to use")
    parser.add_argument("--api-key", type=str, dest="api_key", help="API key for the selected provider")
    args = parser.parse_args()

    # Inject Electron-supplied config into env vars so main() can pick them up
    if args.provider:
        os.environ["CYCY_PROVIDER"] = args.provider
    if args.model:
        os.environ["CYCY_MODEL"] = args.model
    if args.api_key:
        os.environ["CYCY_API_KEY"] = args.api_key

    if args.web:
        import uvicorn
        print("🚀 Launching Cycy Web Dashboard...")
        uvicorn.run("backend.server:app", host="0.0.0.0", port=8000, reload=True)
    else:
        asyncio.run(main())
