export interface AgentSession {
  id: string;
  name: string;
  model: string;
  port: number;
  worktreePath: string;
  tmuxSession: string;
  status: 'active' | 'inactive' | 'error' | 'paused';
  createdAt: Date;
  updatedAt: Date;
  prompt?: string;
  pid?: number;
}

export interface GlobalState {
  version: string;
  sessions: AgentSession[];
  allocatedPorts: number[];
  baseDirectory: string;
  lastUpdated: Date;
}

export interface MaestroConfig {
  devCommand: string;
  portRange: {
    start: number;
    end: number;
  };
  autoConfirm?: boolean;
  defaultModel?: string;
}

export interface CommandResult<T = any> {
  success: boolean;
  data?: T;
  error?: Error;
}

export type AgentModel = 'claude' | 'codex' | 'gpt4' | string;

export interface PromptOptions {
  agents: string;
  task: string;
  autoConfirm?: boolean;
}

export interface ListOptions {
  watch?: boolean;
  json?: boolean;
}

export interface KillOptions {
  all?: boolean;
}

export interface RunOptions {
  command: string;
}