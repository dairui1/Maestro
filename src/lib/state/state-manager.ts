import * as fs from 'fs-extra';
import * as path from 'path';
import * as os from 'os';
import { z } from 'zod';
import { GlobalState, AgentSession } from '../../types';

const AgentSessionSchema = z.object({
  id: z.string(),
  name: z.string(),
  model: z.string(),
  port: z.number(),
  worktreePath: z.string(),
  tmuxSession: z.string(),
  status: z.enum(['active', 'inactive', 'error']),
  createdAt: z.string().transform(str => new Date(str)),
  updatedAt: z.string().transform(str => new Date(str)),
  prompt: z.string().optional(),
  pid: z.number().optional(),
});

const GlobalStateSchema = z.object({
  version: z.string(),
  sessions: z.array(AgentSessionSchema),
  allocatedPorts: z.array(z.number()),
  baseDirectory: z.string(),
  lastUpdated: z.string().transform(str => new Date(str)),
});

export class StateManager {
  private statePath: string;
  private state: GlobalState | null = null;

  constructor() {
    const dataDir = path.join(os.homedir(), '.local', 'share', 'maestro');
    fs.ensureDirSync(dataDir);
    this.statePath = path.join(dataDir, 'state.json');
  }

  async load(): Promise<GlobalState> {
    try {
      if (await fs.pathExists(this.statePath)) {
        const data = await fs.readJson(this.statePath);
        this.state = GlobalStateSchema.parse(data);
        return this.state;
      }
    } catch (error) {
      console.error('Failed to load state:', error);
    }

    // Initialize with default state
    this.state = {
      version: '1.0.0',
      sessions: [],
      allocatedPorts: [],
      baseDirectory: process.cwd(),
      lastUpdated: new Date(),
    };

    await this.save();
    return this.state;
  }

  async save(): Promise<void> {
    if (!this.state) {
      throw new Error('State not initialized');
    }

    const stateToSave = {
      ...this.state,
      createdAt: this.state.lastUpdated.toISOString(),
      lastUpdated: new Date().toISOString(),
      sessions: this.state.sessions.map(session => ({
        ...session,
        createdAt: session.createdAt.toISOString(),
        updatedAt: session.updatedAt.toISOString(),
      })),
    };

    await fs.writeJson(this.statePath, stateToSave, { spaces: 2 });
  }

  async addSession(session: AgentSession): Promise<void> {
    if (!this.state) await this.load();
    
    this.state!.sessions.push(session);
    this.state!.allocatedPorts.push(session.port);
    await this.save();
  }

  async removeSession(sessionId: string): Promise<void> {
    if (!this.state) await this.load();

    const session = this.state!.sessions.find(s => s.id === sessionId);
    if (session) {
      this.state!.sessions = this.state!.sessions.filter(s => s.id !== sessionId);
      this.state!.allocatedPorts = this.state!.allocatedPorts.filter(p => p !== session.port);
      await this.save();
    }
  }

  async updateSession(sessionId: string, updates: Partial<AgentSession>): Promise<void> {
    if (!this.state) await this.load();

    const sessionIndex = this.state!.sessions.findIndex(s => s.id === sessionId);
    if (sessionIndex >= 0) {
      this.state!.sessions[sessionIndex] = {
        ...this.state!.sessions[sessionIndex],
        ...updates,
        updatedAt: new Date(),
      };
      await this.save();
    }
  }

  async getAllSessions(): Promise<AgentSession[]> {
    if (!this.state) await this.load();
    return this.state!.sessions;
  }

  async getSession(sessionId: string): Promise<AgentSession | undefined> {
    if (!this.state) await this.load();
    return this.state!.sessions.find(s => s.id === sessionId);
  }

  async getNextAvailablePort(startPort: number, endPort: number): Promise<number | null> {
    if (!this.state) await this.load();

    for (let port = startPort; port <= endPort; port++) {
      if (!this.state!.allocatedPorts.includes(port)) {
        return port;
      }
    }
    return null;
  }

  async reset(): Promise<void> {
    this.state = {
      version: '1.0.0',
      sessions: [],
      allocatedPorts: [],
      baseDirectory: process.cwd(),
      lastUpdated: new Date(),
    };
    await this.save();
  }
}