import { v4 as uuidv4 } from 'uuid';
import * as path from 'path';
import { AgentSession, MaestroConfig } from '../../types';
import { StateManager } from '../state/state-manager';
import { TmuxManager } from '../tmux/tmux-manager';
import { WorktreeManager } from '../git/worktree-manager';
import { AgentNotFoundError, PortAllocationError } from '../errors';
import execa = require('execa');

export class AgentManager {
  constructor(
    private stateManager: StateManager,
    private tmuxManager: TmuxManager,
    private worktreeManager: WorktreeManager,
    private config: MaestroConfig
  ) {}

  async createAgent(name: string, model: string, prompt: string): Promise<AgentSession> {
    // Find available port
    const port = await this.stateManager.getNextAvailablePort(
      this.config.portRange.start,
      this.config.portRange.end
    );

    if (!port) {
      throw new PortAllocationError();
    }

    // Generate unique identifiers
    const id = uuidv4();
    const branchName = `maestro/${name}-${id.slice(0, 8)}`;
    const worktreePath = path.join(process.cwd(), '.maestro', 'worktrees', name);
    const tmuxSession = `maestro-${name}`;

    // Create worktree
    await this.worktreeManager.createWorktree(branchName, worktreePath);

    // Create tmux session
    await this.tmuxManager.createSession(tmuxSession);

    // The first window is created automatically and has index 1
    await this.tmuxManager.sendKeys(tmuxSession, 1, `cd ${worktreePath}`);
    await this.tmuxManager.renameWindow(tmuxSession, 1, 'agent');
    
    // Send the prompt to the agent window if provided
    if (prompt) {
      await this.tmuxManager.sendKeys(tmuxSession, 1, `# Task: ${prompt}`);
    }

    // Create dev server window (will be index 2)
    await this.tmuxManager.createWindow(tmuxSession, 'dev');
    await this.tmuxManager.sendKeys(tmuxSession, 2, `cd ${worktreePath}`);
    
    // Start dev server with port
    const devCommand = this.config.devCommand.replace('$PORT', port.toString());
    await this.tmuxManager.sendKeys(tmuxSession, 2, `PORT=${port} ${devCommand}`);

    // Create agent session
    const session: AgentSession = {
      id,
      name,
      model,
      port,
      worktreePath,
      tmuxSession,
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date(),
      prompt,
    };

    // Save to state
    await this.stateManager.addSession(session);

    return session;
  }

  async killAgent(sessionId: string): Promise<void> {
    const session = await this.stateManager.getSession(sessionId);
    if (!session) {
      throw new AgentNotFoundError(sessionId);
    }

    // Kill tmux session
    await this.tmuxManager.killSession(session.tmuxSession);

    // Remove worktree
    try {
      await this.worktreeManager.removeWorktree(session.worktreePath, true);
    } catch (error) {
      console.error(`Failed to remove worktree: ${error}`);
    }

    // Remove from state
    await this.stateManager.removeSession(sessionId);
  }

  async killAllAgents(): Promise<void> {
    const sessions = await this.stateManager.getAllSessions();
    
    await Promise.all(
      sessions.map(session => this.killAgent(session.id).catch(err => 
        console.error(`Failed to kill agent ${session.name}: ${err}`)
      ))
    );
  }

  async runCommandOnAgent(sessionId: string, command: string): Promise<string> {
    const session = await this.stateManager.getSession(sessionId);
    if (!session) {
      throw new AgentNotFoundError(sessionId);
    }

    try {
      const result = await execa('sh', ['-c', command], {
        cwd: session.worktreePath,
        reject: false,
      });

      return result.stdout || result.stderr || '';
    } catch (error) {
      throw new Error(`Failed to run command: ${error}`);
    }
  }

  async runCommandOnAllAgents(command: string): Promise<Map<string, string>> {
    const sessions = await this.stateManager.getAllSessions();
    const results = new Map<string, string>();

    await Promise.all(
      sessions.map(async session => {
        try {
          const output = await this.runCommandOnAgent(session.id, command);
          results.set(session.name, output);
        } catch (error) {
          results.set(session.name, `Error: ${error}`);
        }
      })
    );

    return results;
  }

  async broadcastMessage(message: string): Promise<void> {
    const sessions = await this.stateManager.getAllSessions();

    await Promise.all(
      sessions.map(session => 
        this.tmuxManager.sendKeys(session.tmuxSession, 1, message)
      )
    );
  }

  async checkpointAgent(sessionId: string, mainBranch: string = 'main'): Promise<void> {
    const session = await this.stateManager.getSession(sessionId);
    if (!session) {
      throw new AgentNotFoundError(sessionId);
    }

    // Commit changes in worktree
    try {
      await this.worktreeManager.commitChanges(
        `Checkpoint: ${session.name} - ${new Date().toISOString()}`,
        session.worktreePath
      );
    } catch (error) {
      if (!(error as Error).message.includes('No changes to commit')) {
        throw error;
      }
    }

    // Rebase onto main branch
    await this.worktreeManager.rebase(mainBranch, session.worktreePath);
  }
}