import { Elysia, t } from 'elysia';
import { Stream } from '@elysiajs/stream';
import { ClaudeManager } from '../claude/manager';
import { ExecuteRequestSchema } from '../models';

export function createApiRoutes(claudeManager: ClaudeManager) {
  return new Elysia({ prefix: '/api/v1' })
    .get('/health', () => ({
      status: 'healthy',
      time: Date.now()
    }))
    
    .post('/sessions/execute', async ({ body }) => {
      const request = ExecuteRequestSchema.parse(body);
      
      try {
        const sessionId = await claudeManager.execute(request);
        return {
          sessionId,
          streamUrl: `/api/v1/sessions/${sessionId}/stream`
        };
      } catch (error) {
        throw new Error(`Failed to start session: ${error}`);
      }
    }, {
      body: t.Object({
        sessionId: t.Optional(t.String()),
        projectPath: t.String(),
        prompt: t.String(),
        model: t.Optional(t.String()),
        continue: t.Optional(t.Boolean())
      })
    })
    
    .post('/sessions/:id/cancel', ({ params: { id } }) => {
      try {
        claudeManager.cancel(id);
        return { message: 'Session cancelled successfully' };
      } catch (error) {
        throw new Error(`Failed to cancel session: ${error}`);
      }
    })
    
    .get('/sessions/:id', ({ params: { id } }) => {
      const session = claudeManager.getSession(id);
      if (!session) {
        throw new Error(`Session not found: ${id}`);
      }
      return session;
    })
    
    .get('/sessions', () => {
      const sessions = claudeManager.listSessions();
      return {
        sessions,
        total: sessions.length
      };
    })
    
    .get('/sessions/:id/stream', ({ params: { id }, set }) => {
      const session = claudeManager.getSession(id);
      if (!session) {
        set.status = 404;
        return { error: `Session not found: ${id}` };
      }

      // Set SSE headers
      set.headers['Content-Type'] = 'text/event-stream';
      set.headers['Cache-Control'] = 'no-cache';
      set.headers['Connection'] = 'keep-alive';

      const { stream: messageStream, unsubscribe } = claudeManager.subscribe(id);
      
      return new Stream(async function* () {
        const reader = messageStream.getReader();
        
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            
            // Format as SSE
            yield `data: ${JSON.stringify(value)}\n\n`;
          }
        } catch (error) {
          console.error('Stream error:', error);
          yield `data: ${JSON.stringify({ type: 'error', data: String(error), sessionId: id, timestamp: new Date() })}\n\n`;
        } finally {
          unsubscribe();
        }
      });
    });
}