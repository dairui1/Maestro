import { Elysia } from 'elysia';
import { cors } from '@elysiajs/cors';
import { loadConfig } from './config';
import { ClaudeManager } from './claude/manager';
import { createApiRoutes } from './api/routes';

// Parse command line arguments
const args = process.argv.slice(2);
let port = '8080';
let configFile: string | undefined;

for (let i = 0; i < args.length; i++) {
  switch (args[i]) {
    case '--port':
    case '-p':
      port = args[++i] || '8080';
      break;
    case '--config':
    case '-c':
      configFile = args[++i];
      break;
    case '--debug':
    case '-d':
      // Debug mode can be implemented later if needed
      break;
  }
}

// Load configuration
const config = await loadConfig(configFile);

// Initialize Claude manager
const claudeManager = new ClaudeManager(config.claude);

// Create Elysia app
const app = new Elysia()
  .use(cors())
  .derive(() => ({
    start: Date.now()
  }))
  .onAfterHandle(({ request, start }) => {
    const duration = Date.now() - start;
    const method = request.method;
    const path = new URL(request.url).pathname;
    console.log(`${method} ${path} - ${duration}ms`);
  })
  .get('/', () => ({ message: 'Claude API Backend' }))
  .get('/health', () => ({ status: 'healthy', time: Date.now() }))
  .use(createApiRoutes(claudeManager))
  .onError(({ error, code }) => {
    console.error('Error:', error);
    const message = error instanceof Error ? error.message : String(error);
    return {
      error: message,
      code
    };
  });

// Start server
app.listen(parseInt(port));

console.log(`Starting server on port ${port}`);

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\nShutting down server...');
  claudeManager.cleanup();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\nShutting down server...');
  claudeManager.cleanup();
  process.exit(0);
});