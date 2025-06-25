# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Maestro is a TypeScript CLI tool that orchestrates multiple AI coding agents as a distributed system, solving the bottleneck of traditional AI-coding pipelines where context switches multiply and agents collide over shared state. It reframes multi-agent coordination as a distributed orchestration problem, spinning up independent "sections" for every task—each a self-contained Git worktree with its own terminal session, dependency graph, and runtime environment.

Key capabilities:
- **Distributed Orchestration**: Each agent operates in an isolated worktree with dedicated resources, preventing state collisions
- **Adaptive Scheduling**: Balances CPU, memory, and I/O across the entire ensemble of agents
- **Policy-Driven Mapping**: Fine-grained rules allow teams to map issue trackers or roadmap epics directly to agent pods
- **Live Telemetry**: Real-time monitoring of agent activity and resource utilization
- **Automatic Conflict Resolution**: Keeps diverging branches synchronized while maintaining isolation
- **Scalable Concurrency**: Enables project-aware parallelism with minimal overhead

## Build and Development Commands

```bash
# Install dependencies
pnpm install

# Build TypeScript to JavaScript
pnpm run build

# Development mode (runs TypeScript directly)
pnpm run dev

# Type checking only (no emit)
pnpm run lint

# Run tests (Jest)
pnpm test

# Run tests in watch mode
pnpm run test:watch
```

## Architecture

Maestro treats AI assistants as coordinated instruments in a symphony rather than isolated prompts, turning multi-repo chaos into coherent continuous delivery through its distributed orchestration architecture.

### Core Manager Pattern
The codebase uses a manager pattern where each subsystem has a dedicated manager:

- **AgentManager** (`src/lib/agent/agent-manager.ts`): Orchestrates agent lifecycle, creates worktrees, manages tmux sessions
- **StateManager** (`src/lib/state/state-manager.ts`): Persists state to `~/.local/share/maestro/state.json` with Zod validation
- **ConfigManager** (`src/lib/config/config-manager.ts`): Handles YAML configuration from `maestro.yaml`
- **TmuxManager** (`src/lib/tmux/tmux-manager.ts`): Controls tmux sessions (create, kill, send commands)
- **WorktreeManager** (`src/lib/git/worktree-manager.ts`): Manages Git worktrees for agent isolation

### Command Structure
Each command is a separate module in `src/commands/` that exports a Commander.js Command instance:
- Commands handle their own argument parsing and validation
- Global options (config path) are handled at the root level
- Pre-action hooks validate configuration before command execution

### State Management
- Centralized state in `~/.local/share/maestro/state.json`
- State includes: sessions array, allocatedPorts object, worktreePaths object
- All state mutations go through StateManager with Zod schema validation
- State survives process restarts, enabling persistent agent management

### Port Allocation
- Ports allocated from configured range (default: 3000-4000)
- StateManager tracks allocated ports to prevent conflicts
- Port templating in devCommand via `$PORT` placeholder

### Error Handling
Custom error classes in `src/lib/errors/index.ts`:
- `AgentNotFoundError`: When agent doesn't exist
- `PortAllocationError`: When no ports available
- `ConfigValidationError`: Invalid configuration
- `TmuxError`: Tmux operation failures
- `GitError`: Git operation failures

## Key Implementation Details

### Agent Creation Flow (prompt command)
1. Parse agent names and optional model
2. Create Git worktree for each agent (isolated "section" in the orchestra)
3. Allocate unique port from managed pool
4. Create tmux session with two windows (agent, dev)
5. Start AI tool in agent window with full context isolation
6. Update centralized state with session info
7. Enable resource tracking for adaptive scheduling

### Git Worktree Strategy
- Branch naming: `maestro/{agent-name}-{uuid}`
- Worktrees created in `.maestro-worktrees/` directory
- Each agent works in isolated branch
- Checkpoint command enables rebasing onto main

### Tmux Session Structure
- Session name: `maestro-{agent-name}`
- Window 0 "agent": Runs AI coding tool
- Window 1 "dev": Runs development server
- Commands can be broadcast to specific windows

### UI Components
- Uses Ink (React for CLI) for interactive displays
- `AgentTable.tsx` renders agent list with status
- Real-time tmux session status checking

## Testing Considerations

When adding tests:
- Mock external dependencies (Git, tmux, file system)
- Test manager classes independently
- Verify state persistence and recovery
- Test concurrent operations (multiple agents)
- Validate error handling paths

## Common Modifications

### Adding a New Command
1. Create new file in `src/commands/`
2. Export a function returning a Commander Command
3. Import and add to `src/cli.ts`
4. Follow existing command patterns for consistency

## New Commands for Multi-Agent Workflow

### merge command
Intelligently merges work from multiple agents with three strategies:
- `auto`: Automatically merge non-conflicting changes
- `manual`: Interactive selection of files and changes
- `best`: Analyze and merge the best implementation based on tests, linting, and code quality

### diff command
Compare implementations between two agents:
- Shows file-by-file differences
- Highlights unique vs common changes
- Provides statistics on implementation size

### monitor command
Real-time monitoring dashboard for all active agents:
- Shows current activity and progress
- Displays Git statistics
- Optional CPU/memory metrics
- Interactive navigation

### Modifying Agent Behavior
- Agent lifecycle logic is in `AgentManager`
- Tmux interactions in `TmuxManager`
- Git operations in `WorktreeManager`

### Changing State Schema
1. Update Zod schema in `src/types/index.ts`
2. Handle migration in `StateManager.loadState()`
3. Update any dependent code

## Important Notes

- The project currently has no tests despite Jest being configured
- All async operations use async/await (no callbacks)
- Heavy use of `execa` for process execution
- Strict TypeScript with runtime validation via Zod
- React/JSX used only for CLI UI components (Ink)
- When running commands across agents, use `Promise.all()` for parallelism

## Design Philosophy

Maestro addresses the fundamental challenges of multi-agent AI development:
- **Context Switch Overhead**: Traditional pipelines suffer when switching between projects; Maestro maintains persistent isolated contexts
- **Resource Contention**: Agents no longer compete for shared resources; each gets dedicated allocation
- **State Collision**: Isolated worktrees prevent agents from stepping on each other's changes
- **Heterogeneous Workflows**: Different feature branches can advance in parallel with different toolchains
- **Scalable Coordination**: From single-repo to multi-repo scenarios without architectural changes