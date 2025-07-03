import { z } from 'zod';

export enum SessionStatus {
  Pending = 'pending',
  Running = 'running',
  Completed = 'completed',
  Failed = 'failed',
  Cancelled = 'cancelled'
}

export enum StreamMessageType {
  Connected = 'connected',
  Output = 'output',
  Error = 'error',
  Status = 'status',
  Complete = 'complete'
}

export const ExecuteRequestSchema = z.object({
  sessionId: z.string().optional(),
  projectPath: z.string(),
  prompt: z.string(),
  model: z.string().optional(),
  continue: z.boolean().optional()
});

export type ExecuteRequest = z.infer<typeof ExecuteRequestSchema>;

export interface ClaudeOutput {
  content: string;
  stream: 'stdout' | 'stderr';
}

export interface StreamMessage {
  type: StreamMessageType;
  sessionId: string;
  timestamp: Date;
  data?: any;
}

export interface Session {
  id: string;
  projectPath: string;
  status: SessionStatus;
  model: string;
  createdAt: Date;
  updatedAt: Date;
  processId?: number;
  error?: string;
}