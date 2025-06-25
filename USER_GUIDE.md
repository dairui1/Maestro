# Maestro User Guide

## Table of Contents
1. [Introduction](#introduction)
2. [Installation](#installation)
3. [Prerequisites](#prerequisites)
4. [Configuration](#configuration)
5. [Core Concepts](#core-concepts)
6. [Command Reference](#command-reference)
7. [Workflows](#workflows)
8. [Best Practices](#best-practices)
9. [Troubleshooting](#troubleshooting)

## Introduction

Maestro is a powerful CLI tool designed to manage multiple AI coding agents in parallel. It enables developers to leverage multiple AI assistants simultaneously, each working in isolated Git worktrees with their own development environments. This approach maximizes productivity by allowing different agents to work on different aspects of a project without conflicts.

### Key Benefits
- **Parallel Development**: Run multiple AI agents simultaneously on different tasks
- **Isolation**: Each agent works in its own Git worktree, preventing conflicts
- **Automatic Environment Setup**: Each agent gets its own development server with automatic port allocation
- **Session Management**: Easy monitoring and control of all active agents through tmux
- **Seamless Integration**: Simple commands to merge completed work back into your main branch

## Installation

### From Source

```bash
# Clone the repository
git clone https://github.com/your-repo/maestro-ts.git
cd maestro-ts

# Install dependencies
npm install

# Build the project
npm run build

# Link globally (optional)
npm link
```

### Prerequisites Check

Before using Maestro, ensure you have the following installed:

```bash
# Check Node.js (v16+ required)
node --version

# Check Git
git --version

# Check tmux
tmux -V
```

## Prerequisites

### Required Software

1. **Node.js** (v16 or higher)
   - Required for running the TypeScript implementation
   - Install from [nodejs.org](https://nodejs.org/)

2. **Git**
   - Essential for version control and worktree management
   - Install via your package manager or from [git-scm.com](https://git-scm.com/)

3. **tmux**
   - Terminal multiplexer for session management
   - Install:
     - macOS: `brew install tmux`
     - Ubuntu/Debian: `sudo apt-get install tmux`
     - Other: Check your package manager

4. **AI CLI Tools** (at least one)
   - Examples: `claude`, `aider`, `cursor`, or any AI coding assistant with CLI support
   - These tools should be installed and accessible from your PATH

### Project Requirements

- Your project must be a Git repository
- You should have at least one commit in your repository
- Sufficient disk space for multiple worktrees (each is a full copy of your project)

## Configuration

### Creating maestro.yaml

Maestro uses a YAML configuration file to customize its behavior. Create a `maestro.yaml` file in your project root:

```yaml
# Development server command
# Use $PORT as a placeholder for the port number
devCommand: npm install && npm run dev -- --port $PORT

# Port range for development servers
portRange:
  start: 3000
  end: 4000

# Optional: Auto-confirm prompts
autoConfirm: false

# Optional: Default AI model
defaultModel: claude
```

### Configuration Examples

#### Next.js Project
```yaml
devCommand: npm install && npm run dev -- --port $PORT
portRange:
  start: 3000
  end: 3010
```

#### Vite Project
```yaml
devCommand: npm install && npm run dev -- --port $PORT --host
portRange:
  start: 5173
  end: 5180
```

#### Python/Django Project
```yaml
devCommand: pip install -r requirements.txt && python manage.py runserver 0.0.0.0:$PORT
portRange:
  start: 8000
  end: 8010
```

#### Multiple Setup Commands
```yaml
# For projects requiring database setup
devCommand: |
  npm install &&
  npm run db:migrate &&
  npm run dev -- --port $PORT
portRange:
  start: 3000
  end: 3010
```

### Global Options

Maestro supports global options that can be used with any command:

- `-v, --verbose`: Enable verbose output for debugging
- `-c, --config <path>`: Specify a custom config file location

## Core Concepts

### Agents
An agent is an instance of an AI coding assistant (like Claude, GPT-4, etc.) running in its own isolated environment. Each agent:
- Has a unique name (e.g., `claude-1`, `gpt4-2`)
- Works in its own Git worktree
- Runs in a dedicated tmux session
- Has its own development server on a unique port

### Git Worktrees
Git worktrees allow multiple working directories for the same repository. Maestro leverages this to:
- Isolate each agent's changes
- Prevent merge conflicts during parallel development
- Enable easy integration of completed work

### Tmux Sessions
Each agent runs in a tmux session with two windows:
1. **agent**: Where the AI tool runs and interacts
2. **dev**: Where the development server runs

### State Management
Maestro maintains a global state file that tracks:
- Active sessions and their configurations
- Port allocations
- Worktree locations
- Agent status and metadata

## Command Reference

### `maestro prompt`
Creates new agent sessions with specified AI models and tasks.

```bash
# Basic usage
maestro prompt -a "claude:2" -t "Implement user authentication"

# Multiple agent types
maestro prompt -a "claude:2,gpt4:1" -t "Build a REST API"

# With auto-confirm
maestro prompt -a "claude:1" -t "Fix all TypeScript errors" --auto
```

**Options:**
- `-a, --agents <spec>`: Agent specification (format: `model:count`)
- `-t, --task <task>`: Task description for agents
- `--auto`: Enable auto-confirm mode

**Agent Specification Format:**
- `claude:2` - Create 2 Claude agents
- `gpt4:1,claude:2` - Create 1 GPT-4 and 2 Claude agents

### `maestro ls`
Lists all active agent sessions.

```bash
# List sessions
maestro ls

# Watch mode (auto-refresh)
maestro ls --watch
maestro ls -w

# JSON output
maestro ls --json
```

**Output columns:**
- Name: Agent identifier
- Model: AI model being used
- Status: Current status (active/inactive/error)
- Port: Development server port
- Tmux Session: tmux session name

### `maestro kill`
Terminates agent sessions and cleans up resources.

```bash
# Kill specific agent
maestro kill claude-1

# Kill all agents
maestro kill --all
```

**Cleanup actions:**
- Terminates tmux session
- Removes Git worktree
- Frees allocated port
- Updates state file

### `maestro run`
Executes commands across all active agents in parallel.

```bash
# Run command in all agents
maestro run "npm test"

# Check git status
maestro run "git status"

# Install new dependency
maestro run "npm install axios"
```

**Features:**
- Parallel execution using Promise.all()
- Captures both stdout and stderr
- Displays results grouped by agent

### `maestro broadcast`
Sends a message to all active agent sessions.

```bash
# Send instruction
maestro broadcast "Please add error handling to all API endpoints"

# Send reminder
maestro broadcast "Remember to follow the coding standards"
```

### `maestro checkpoint`
Commits and rebases agent changes into your branch.

```bash
# Checkpoint specific agent
maestro checkpoint claude-1

# Checkpoint all agents
maestro checkpoint

# Checkpoint to specific branch
maestro checkpoint claude-1 -b develop
```

**Options:**
- `-b, --branch <branch>`: Target branch for rebase (default: main)

**Process:**
1. Commits all changes in agent's worktree
2. Rebases onto target branch
3. Prepares changes for integration

### `maestro auto`
Runs as a background process to automatically handle agent prompts.

```bash
# Default interval (5 seconds)
maestro auto

# Custom interval
maestro auto -i 10
```

**Options:**
- `-i, --interval <seconds>`: Check interval (default: 5)

**Auto-handles:**
- Confirmation prompts (Continue?, Proceed?, [Y/n])
- Trust prompts
- Empty input prompts (presses Enter)

### `maestro reset`
Completely resets Maestro, removing all data and sessions.

```bash
# With confirmation prompt
maestro reset

# Skip confirmation
maestro reset --force
```

**Warning**: This action:
- Kills all active sessions
- Removes all worktrees
- Deletes state file
- Removes `.maestro` directory

## Workflows

### Basic Development Workflow

1. **Initialize your project**
   ```bash
   # Ensure you're in a git repository
   git init
   git add .
   git commit -m "Initial commit"
   
   # Create maestro.yaml
   echo "devCommand: npm run dev -- --port \$PORT
   portRange:
     start: 3000
     end: 4000" > maestro.yaml
   ```

2. **Start agents with a task**
   ```bash
   maestro prompt -a "claude:2" -t "Implement user registration with email verification"
   ```

3. **Run auto mode in another terminal**
   ```bash
   maestro auto
   ```

4. **Monitor progress**
   ```bash
   # In another terminal
   maestro ls --watch
   ```

5. **Send additional instructions if needed**
   ```bash
   maestro broadcast "Use bcrypt for password hashing"
   ```

6. **Check implementation**
   ```bash
   # Run tests
   maestro run "npm test"
   
   # Check changes
   maestro run "git diff"
   ```

7. **Integrate completed work**
   ```bash
   # Review changes first
   cd .maestro/worktrees/claude-1
   git diff
   
   # If satisfied, checkpoint
   maestro checkpoint claude-1
   ```

### Parallel Feature Development

When working on multiple features simultaneously:

```bash
# Start agents for different features
maestro prompt -a "claude:1" -t "Implement user authentication"
maestro prompt -a "gpt4:1" -t "Create admin dashboard"
maestro prompt -a "claude:1" -t "Add API rate limiting"

# Monitor all agents
maestro ls --watch

# Run tests periodically
maestro run "npm test"

# Checkpoint features as they complete
maestro checkpoint claude-1  # Auth complete
maestro checkpoint gpt4-1    # Dashboard complete
maestro checkpoint claude-2  # Rate limiting complete
```

### Debugging Workflow

When agents encounter issues:

```bash
# Check agent output
tmux attach -t maestro-claude-1

# Check dev server logs
# Navigate to dev window: Ctrl+b, then 2

# Send debugging instructions
maestro broadcast "Check the console for errors"

# Run diagnostic commands
maestro run "npm run lint"
maestro run "npm run typecheck"
```

### Code Review Workflow

Before integrating agent changes:

```bash
# List all agents
maestro ls

# For each agent, review changes
cd .maestro/worktrees/claude-1
git diff
npm test

# If changes look good
maestro checkpoint claude-1

# If changes need work
maestro broadcast "Please fix the failing tests in claude-1"
```

## Best Practices

### 1. Task Specification
- Be specific and detailed in your task descriptions
- Break large tasks into smaller, focused pieces
- Include acceptance criteria in the task

**Good:**
```bash
maestro prompt -a "claude:1" -t "Implement user registration with:
- Email/password authentication
- Email verification
- Password strength requirements (min 8 chars, 1 uppercase, 1 number)
- Rate limiting (max 5 attempts per hour)
- Proper error messages
- Unit tests with >80% coverage"
```

**Less Effective:**
```bash
maestro prompt -a "claude:1" -t "Add user registration"
```

### 2. Agent Allocation
- Use multiple agents for independent features
- Avoid too many agents on interdependent tasks
- Consider your machine's resources (CPU, memory)

```bash
# Good: Independent features
maestro prompt -a "claude:1" -t "User auth module"
maestro prompt -a "gpt4:1" -t "Email service module"

# Problematic: Dependent features
maestro prompt -a "claude:3" -t "Refactor the same authentication module"
```

### 3. Regular Checkpoints
- Checkpoint working features frequently
- Don't wait until everything is perfect
- Use descriptive commit messages

```bash
# Regular checkpoints
maestro checkpoint claude-1  # After auth implementation
maestro checkpoint claude-1  # After adding tests
maestro checkpoint claude-1  # After documentation
```

### 4. Resource Management
- Monitor system resources when running multiple agents
- Kill idle agents to free resources
- Use `maestro ls` regularly to track active sessions

```bash
# Check active agents
maestro ls

# Kill idle agents
maestro kill claude-2
```

### 5. Auto Mode Usage
- Always run `maestro auto` when using Claude or similar tools
- Run in a dedicated terminal for easy monitoring
- Check the auto mode output for any issues

### 6. Git Hygiene
- Ensure clean git state before starting agents
- Commit or stash your changes first
- Use meaningful branch names in checkpoint

```bash
# Clean state before starting
git status
git stash

# Start agents
maestro prompt -a "claude:2" -t "New feature"
```

## Troubleshooting

### Common Issues and Solutions

#### 1. "No available ports in configured range"
**Problem**: All ports in the configured range are in use.

**Solution**:
```bash
# Check current port usage
maestro ls

# Kill unused agents
maestro kill --all

# Or expand port range in maestro.yaml
portRange:
  start: 3000
  end: 5000
```

#### 2. "Failed to create worktree"
**Problem**: Git worktree creation failed.

**Solutions**:
```bash
# Prune invalid worktrees
git worktree prune

# Check for existing worktrees
git worktree list

# Clean up and retry
rm -rf .maestro
maestro reset --force
```

#### 3. "tmux session not found"
**Problem**: tmux session doesn't exist or was killed externally.

**Solution**:
```bash
# Check tmux sessions
tmux ls

# Clean up Maestro state
maestro kill agent-name
```

#### 4. Agent not responding to prompts
**Problem**: Auto mode not running or not detecting prompts.

**Solutions**:
```bash
# Ensure auto mode is running
maestro auto

# Manually attach to check
tmux attach -t maestro-agent-name

# Send manual response
maestro broadcast "y"
```

#### 5. Development server not starting
**Problem**: Dev server fails to start or wrong port.

**Solutions**:
- Check `devCommand` in maestro.yaml
- Ensure `$PORT` placeholder is used correctly
- Verify dependencies are installed
- Check for port conflicts

```bash
# Debug dev server
tmux attach -t maestro-agent-name
# Switch to dev window: Ctrl+b, then 2
```

### Debug Mode

For detailed debugging information:

```bash
# Run commands with verbose flag
maestro -v prompt -a "claude:1" -t "Debug task"

# Check state file
cat ~/.local/share/maestro/state.json

# Check Maestro logs (if any)
ls -la ~/.local/share/maestro/
```

### Getting Help

1. **Check command help**:
   ```bash
   maestro --help
   maestro prompt --help
   ```

2. **View active configuration**:
   ```bash
   cat maestro.yaml
   ```

3. **Inspect state**:
   ```bash
   maestro ls --json | jq .
   ```

### Clean Slate

If all else fails, start fresh:

```bash
# Complete reset
maestro reset --force

# Remove git worktrees manually if needed
git worktree list
git worktree remove .maestro/worktrees/agent-name

# Reinstall if necessary
npm install
npm run build
```

## Advanced Tips

### 1. Custom Agent Names
While the TypeScript version doesn't support random names yet, you can create custom naming schemes:

```bash
# Numbered schemes
maestro prompt -a "claude:3" -t "Task"  # Creates claude-1, claude-2, claude-3

# Different models
maestro prompt -a "claude:1,gpt4:1,codex:1" -t "Compare implementations"
```

### 2. Tmux Integration
Learn tmux basics for better control:

```bash
# Attach to agent session
tmux attach -t maestro-claude-1

# Switch windows
Ctrl+b, then 1  # Agent window
Ctrl+b, then 2  # Dev window

# Detach
Ctrl+b, then d
```

### 3. Git Worktree Management
Understand the worktree structure:

```bash
# List all worktrees
git worktree list

# Manually access agent work
cd .maestro/worktrees/claude-1
git log
git diff main
```

### 4. Port Forwarding
For remote development:

```bash
# Forward agent dev ports
ssh -L 3000:localhost:3000 -L 3001:localhost:3001 user@host
```

### 5. Integration with CI/CD
Run tests on all agents before integration:

```bash
# Create test script
echo '#!/bin/bash
maestro run "npm test" || exit 1
maestro run "npm run lint" || exit 1
maestro run "npm run build" || exit 1
' > test-all-agents.sh

chmod +x test-all-agents.sh
./test-all-agents.sh
```

## Conclusion

Maestro transforms how developers work with AI coding assistants by enabling true parallel development. By leveraging Git worktrees and tmux sessions, it provides a robust framework for managing multiple AI agents working on your codebase simultaneously.

Key takeaways:
- Start with clear, specific tasks
- Use auto mode for smooth operation
- Checkpoint frequently
- Monitor resource usage
- Keep your main branch clean

With Maestro, you can significantly accelerate development by having multiple AI assistants work on different aspects of your project in parallel, all while maintaining code quality and preventing conflicts.