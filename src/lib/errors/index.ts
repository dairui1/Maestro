export class UziError extends Error {
  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class AgentNotFoundError extends UziError {
  constructor(agentName: string) {
    super(`Agent "${agentName}" not found`);
  }
}

export class PortAllocationError extends UziError {
  constructor(message: string = 'No available ports in configured range') {
    super(message);
  }
}

export class WorktreeConflictError extends UziError {
  constructor(path: string) {
    super(`Worktree conflict at path: ${path}`);
  }
}

export class TmuxSessionError extends UziError {
  constructor(sessionName: string, operation: string) {
    super(`Failed to ${operation} tmux session: ${sessionName}`);
  }
}

export class ConfigurationError extends UziError {
  constructor(message: string) {
    super(`Configuration error: ${message}`);
  }
}

export class StateManagementError extends UziError {
  constructor(operation: string) {
    super(`State management error during ${operation}`);
  }
}