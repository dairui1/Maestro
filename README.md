# Maestro

A TypeScript implementation of the Maestro CLI tool for managing multiple AI coding agents in parallel using Git worktrees and tmux sessions.

## Features

- **Multi-agent management**: Create and manage multiple AI coding agents running in parallel
- **Git worktree isolation**: Each agent works in its own Git worktree to prevent conflicts
- **Tmux integration**: Agents run in dedicated tmux sessions with separate windows for agent and development server
- **Port management**: Automatic allocation and tracking of development server ports
- **State persistence**: JSON-based state management to track active sessions
- **Interactive UI**: Beautiful terminal UI using Ink for the `ls` command

## Installation

```bash
pnpm install
pnpm run build
pnpm link  # To make 'maestro' command available globally
```

## Configuration

Create a `maestro.yaml` file in your project root:

```yaml
devCommand: pnpm run dev
portRange:
  start: 3000
  end: 4000
autoConfirm: false
defaultModel: claude
```

## Commands

### `maestro prompt`
Create new agent sessions with specified AI models.

```bash
maestro prompt -a "claude:2,gpt4:1" -t "Implement user authentication"
```

Options:
- `-a, --agents <agents>`: Agent specification (e.g., "claude:2,codex:1")
- `-t, --task <task>`: Task description for agents
- `--auto`: Enable auto-confirm mode

### `maestro ls`
List all active agent sessions.

```bash
maestro ls          # Show current sessions
maestro ls --watch  # Watch mode with auto-refresh
maestro ls --json   # Output as JSON
```

### `maestro kill`
Terminate agent sessions.

```bash
maestro kill agent-name  # Kill specific agent
maestro kill --all       # Kill all agents
```

### `maestro run`
Execute commands across all active agents in parallel.

```bash
maestro run "pnpm test"
maestro run "git status"
```

### `maestro broadcast`
Send a message to all active agent sessions.

```bash
maestro broadcast "Please run the test suite"
```

### `maestro checkpoint`
Commit and rebase agent changes into the main branch.

```bash
maestro checkpoint              # Checkpoint all agents
maestro checkpoint agent-name   # Checkpoint specific agent
maestro checkpoint -b develop   # Rebase onto 'develop' branch
```

### `maestro auto`
Run as a background process to automatically handle agent prompts.

```bash
maestro auto              # Default 5-second interval
maestro auto -i 10        # Check every 10 seconds
```

### `maestro reset`
Reset Maestro completely - removes all data and configuration.

```bash
maestro reset         # Will prompt for confirmation
maestro reset --force # Skip confirmation
```

## Architecture

The TypeScript implementation follows a modular architecture:

- **State Management**: Centralized state tracking using JSON persistence
- **Configuration**: YAML-based configuration with Zod validation
- **Tmux Integration**: Full tmux session management via execa
- **Git Integration**: Worktree management for isolated development environments
- **CLI Framework**: Commander.js for robust command-line interface
- **UI Components**: React-based terminal UI using Ink

## Development

```bash
pnpm run dev     # Run in development mode
pnpm test        # Run tests
pnpm run lint    # Type checking
```

## Requirements

- Node.js 16+
- Git
- tmux
- A Git repository (for worktree functionality)

## License

ISC