import { spawn, type Subprocess } from 'bun';
import { v4 as uuidv4 } from 'uuid';
import type { ClaudeConfig } from '../config';
import { SessionStatus, StreamMessageType, type ExecuteRequest, type Session, type StreamMessage } from '../models';

interface InternalSession {
  id: string;
  projectPath: string;
  model: string;
  status: SessionStatus;
  process?: Subprocess;
  startedAt: Date;
  updatedAt: Date;
  error?: Error;
  abortController?: AbortController;
}

export class ClaudeManager {
  private config: ClaudeConfig;
  private sessions: Map<string, InternalSession> = new Map();
  private listeners: Map<string, Set<(msg: StreamMessage) => void>> = new Map();

  constructor(config: ClaudeConfig) {
    this.config = config;
  }

  async execute(req: ExecuteRequest): Promise<string> {
    const sessionId = req.sessionId || `claude-${Date.now()}-${uuidv4()}`;
    
    console.log(`Starting Claude session: ${sessionId}`);

    // Check concurrent session limit
    const activeSessions = Array.from(this.sessions.values()).filter(
      s => s.status === SessionStatus.Running
    ).length;

    if (activeSessions >= this.config.maxConcurrentSessions) {
      throw new Error(`Maximum concurrent sessions (${this.config.maxConcurrentSessions}) reached`);
    }

    // Build command arguments
    const args = this.buildCommandArgs(req);
    
    // Create abort controller for cancellation
    const abortController = new AbortController();

    // Create session
    const session: InternalSession = {
      id: sessionId,
      projectPath: req.projectPath,
      model: req.model || this.config.defaultModel,
      status: SessionStatus.Pending,
      startedAt: new Date(),
      updatedAt: new Date(),
      abortController
    };

    this.sessions.set(sessionId, session);

    try {
      // Spawn Claude process
      const proc = spawn({
        cmd: [this.config.binaryPath, ...args],
        cwd: req.projectPath,
        stdout: 'pipe',
        stderr: 'pipe',
        stdin: 'pipe',
        env: process.env
      });

      session.process = proc;
      this.updateSessionStatus(sessionId, SessionStatus.Running);

      // Stream output
      this.streamOutput(sessionId, proc.stdout, 'stdout');
      this.streamOutput(sessionId, proc.stderr, 'stderr');

      // Monitor process completion
      this.monitorProcess(sessionId, proc);

      return sessionId;
    } catch (error) {
      this.sessions.delete(sessionId);
      throw error;
    }
  }

  private buildCommandArgs(req: ExecuteRequest): string[] {
    const args: string[] = [];

    if (req.continue) {
      args.push('-c');
    } else if (req.sessionId) {
      args.push('--resume', req.sessionId);
    }

    args.push('-p', req.prompt);
    args.push('--model', req.model || this.config.defaultModel);
    args.push(...this.config.defaultArgs);

    return args;
  }

  private async streamOutput(sessionId: string, stream: ReadableStream<Uint8Array> | null, streamType: 'stdout' | 'stderr') {
    if (!stream) return;

    const reader = stream.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.trim()) {
            this.broadcast(sessionId, {
              type: StreamMessageType.Output,
              data: {
                content: line,
                stream: streamType
              },
              sessionId,
              timestamp: new Date()
            });
          }
        }
      }

      // Process any remaining buffer
      if (buffer.trim()) {
        this.broadcast(sessionId, {
          type: StreamMessageType.Output,
          data: {
            content: buffer,
            stream: streamType
          },
          sessionId,
          timestamp: new Date()
        });
      }
    } catch (error) {
      console.error(`Error reading ${streamType}:`, error);
      this.broadcast(sessionId, {
        type: StreamMessageType.Error,
        data: error instanceof Error ? error.message : String(error),
        sessionId,
        timestamp: new Date()
      });
    }
  }

  private async monitorProcess(sessionId: string, proc: Subprocess) {
    try {
      const exitCode = await proc.exited;
      
      const session = this.sessions.get(sessionId);
      if (!session) return;

      if (exitCode === 0) {
        this.updateSessionStatus(sessionId, SessionStatus.Completed);
      } else if (session.abortController?.signal.aborted) {
        this.updateSessionStatus(sessionId, SessionStatus.Cancelled);
      } else {
        session.error = new Error(`Process exited with code ${exitCode}`);
        this.updateSessionStatus(sessionId, SessionStatus.Failed);
        this.broadcast(sessionId, {
          type: StreamMessageType.Error,
          data: session.error.message,
          sessionId,
          timestamp: new Date()
        });
      }

      this.broadcast(sessionId, {
        type: StreamMessageType.Complete,
        data: session.status,
        sessionId,
        timestamp: new Date()
      });

      // Clean up listeners after 5 minutes
      setTimeout(() => {
        this.cleanupListeners(sessionId);
      }, 5 * 60 * 1000);
    } catch (error) {
      console.error('Error monitoring process:', error);
    }
  }

  cancel(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    if (session.status !== SessionStatus.Running) {
      throw new Error(`Session is not running: ${session.status}`);
    }

    console.log(`Cancelling session: ${sessionId}`);
    
    // Kill the process
    if (session.process) {
      session.process.kill();
    }
    
    // Abort the controller
    session.abortController?.abort();
  }

  getSession(sessionId: string): Session | null {
    const session = this.sessions.get(sessionId);
    if (!session) return null;

    return {
      id: session.id,
      projectPath: session.projectPath,
      status: session.status,
      model: session.model,
      createdAt: session.startedAt,
      updatedAt: session.updatedAt,
      processId: session.process?.pid,
      error: session.error?.message
    };
  }

  listSessions(): Session[] {
    return Array.from(this.sessions.values()).map(session => ({
      id: session.id,
      projectPath: session.projectPath,
      status: session.status,
      model: session.model,
      createdAt: session.startedAt,
      updatedAt: session.updatedAt,
      processId: session.process?.pid,
      error: session.error?.message
    }));
  }

  subscribe(sessionId: string): {
    stream: ReadableStream<StreamMessage>;
    unsubscribe: () => void;
  } {
    const listeners = this.listeners.get(sessionId) || new Set();
    let controller: ReadableStreamDefaultController<StreamMessage>;
    
    const listener = (msg: StreamMessage) => {
      try {
        if (controller) {
          controller.enqueue(msg);
        }
      } catch (error) {
        // Stream might be closed
        console.error('Error enqueueing message:', error);
      }
    };

    const stream = new ReadableStream<StreamMessage>({
      start(c) {
        controller = c;
        
        // Add listener before sending initial message
        listeners.add(listener);
        
        // Send initial connection message
        controller.enqueue({
          type: StreamMessageType.Connected,
          sessionId,
          timestamp: new Date()
        });
      }
    });

    this.listeners.set(sessionId, listeners);

    const unsubscribe = () => {
      const currentListeners = this.listeners.get(sessionId);
      if (currentListeners) {
        currentListeners.delete(listener);
        if (currentListeners.size === 0) {
          this.listeners.delete(sessionId);
        }
      }
      try {
        controller.close();
      } catch {
        // Already closed
      }
    };

    return { stream, unsubscribe };
  }

  private broadcast(sessionId: string, msg: StreamMessage) {
    const listeners = this.listeners.get(sessionId);
    if (!listeners) return;

    for (const listener of listeners) {
      try {
        listener(msg);
      } catch (error) {
        console.error('Error broadcasting message:', error);
      }
    }
  }

  private updateSessionStatus(sessionId: string, status: SessionStatus) {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    session.status = status;
    session.updatedAt = new Date();

    this.broadcast(sessionId, {
      type: StreamMessageType.Status,
      data: status,
      sessionId,
      timestamp: new Date()
    });
  }

  private cleanupListeners(sessionId: string) {
    this.listeners.delete(sessionId);
  }

  cleanup() {
    console.log('Cleaning up all sessions');
    
    for (const [sessionId, session] of this.sessions) {
      if (session.status === SessionStatus.Running) {
        this.cancel(sessionId);
      }
    }
  }
}