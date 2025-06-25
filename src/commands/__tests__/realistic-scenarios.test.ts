import { Command } from 'commander';
import { createPromptCommand } from '../prompt';
import { createAutoCommand } from '../auto';
import { AgentManager } from '../../lib/agent/agent-manager';
import { ConfigManager } from '../../lib/config/config-manager';
import { StateManager } from '../../lib/state/state-manager';
import { TmuxManager } from '../../lib/tmux/tmux-manager';
import { WorktreeManager } from '../../lib/git/worktree-manager';
import { AgentSession, MaestroConfig } from '../../types';

jest.mock('../../lib/agent/agent-manager');
jest.mock('../../lib/config/config-manager');
jest.mock('../../lib/state/state-manager');
jest.mock('../../lib/tmux/tmux-manager');
jest.mock('../../lib/git/worktree-manager');
jest.mock('fs-extra');
jest.mock('execa');

describe('Realistic User Scenarios', () => {
  let mockAgentManager: jest.Mocked<AgentManager>;
  let mockConfigManager: jest.Mocked<ConfigManager>;
  let mockStateManager: jest.Mocked<StateManager>;
  let mockTmuxManager: jest.Mocked<TmuxManager>;
  let mockWorktreeManager: jest.Mocked<WorktreeManager>;
  let consoleLogSpy: jest.SpyInstance;
  let consoleErrorSpy: jest.SpyInstance;

  const mockConfig: MaestroConfig = {
    devCommand: 'pnpm run dev -- --port $PORT',
    portRange: { start: 3000, end: 4000 },
    autoConfirm: false,
    defaultModel: 'claude'
  };

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockStateManager = new StateManager() as jest.Mocked<StateManager>;
    mockConfigManager = new ConfigManager() as jest.Mocked<ConfigManager>;
    mockTmuxManager = new TmuxManager() as jest.Mocked<TmuxManager>;
    mockWorktreeManager = new WorktreeManager() as jest.Mocked<WorktreeManager>;
    mockAgentManager = new AgentManager(
      mockStateManager,
      mockTmuxManager,
      mockWorktreeManager,
      mockConfig
    ) as jest.Mocked<AgentManager>;
    
    (StateManager as jest.Mock).mockReturnValue(mockStateManager);
    (ConfigManager as jest.Mock).mockReturnValue(mockConfigManager);
    (TmuxManager as jest.Mock).mockReturnValue(mockTmuxManager);
    (WorktreeManager as jest.Mock).mockReturnValue(mockWorktreeManager);
    (AgentManager as jest.Mock).mockReturnValue(mockAgentManager);

    mockConfigManager.load.mockResolvedValue(mockConfig);

    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  describe('Scenario 1: Building a new feature with Claude', () => {
    it('should create a single Claude agent for implementing a login feature', async () => {
      const mockAgent: AgentSession = {
        id: 'feature-id',
        name: 'claude-1',
        model: 'claude',
        port: 3000,
        worktreePath: '/project/.maestro/worktrees/claude-1',
        tmuxSession: 'maestro-claude-1',
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockAgentManager.createAgent.mockResolvedValue(mockAgent);
      mockTmuxManager.switchToSession.mockResolvedValue(undefined);

      const command = createPromptCommand();
      await command.parseAsync([
        'node', 'test', 
        '-a', 'claude:1', 
        '-t', 'implement a user authentication system with JWT tokens, login/logout endpoints, and password hashing'
      ]);

      expect(mockAgentManager.createAgent).toHaveBeenCalledWith(
        'claude-1', 
        'claude', 
        'implement a user authentication system with JWT tokens, login/logout endpoints, and password hashing'
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Created agent claude-1 on port 3000')
      );
    });
  });

  describe('Scenario 2: Comparing implementations from multiple AI models', () => {
    it('should create agents from different models to compare solutions', async () => {
      const agents: AgentSession[] = [
        {
          id: 'id-1',
          name: 'claude-1',
          model: 'claude',
          port: 3000,
          worktreePath: '/project/.maestro/worktrees/claude-1',
          tmuxSession: 'maestro-claude-1',
          status: 'active',
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          id: 'id-2',
          name: 'gpt-4-1',
          model: 'gpt-4',
          port: 3001,
          worktreePath: '/project/.maestro/worktrees/gpt-4-1',
          tmuxSession: 'maestro-gpt-4-1',
          status: 'active',
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          id: 'id-3',
          name: 'deepseek-1',
          model: 'deepseek',
          port: 3002,
          worktreePath: '/project/.maestro/worktrees/deepseek-1',
          tmuxSession: 'maestro-deepseek-1',
          status: 'active',
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ];

      mockAgentManager.createAgent
        .mockResolvedValueOnce(agents[0])
        .mockResolvedValueOnce(agents[1])
        .mockResolvedValueOnce(agents[2]);

      mockTmuxManager.switchToSession.mockResolvedValue(undefined);

      const command = createPromptCommand();
      await command.parseAsync([
        'node', 'test',
        '-a', 'claude:1,gpt-4:1,deepseek:1',
        '-t', 'refactor the database access layer to use repository pattern with TypeScript generics'
      ]);

      expect(mockAgentManager.createAgent).toHaveBeenCalledTimes(3);
      
      // Verify each agent was created with the correct task
      const expectedTask = 'refactor the database access layer to use repository pattern with TypeScript generics';
      expect(mockAgentManager.createAgent).toHaveBeenCalledWith('claude-1', 'claude', expectedTask);
      expect(mockAgentManager.createAgent).toHaveBeenCalledWith('gpt-4-1', 'gpt-4', expectedTask);
      expect(mockAgentManager.createAgent).toHaveBeenCalledWith('deepseek-1', 'deepseek', expectedTask);
    });
  });

  describe('Scenario 3: Parallel development of multiple features', () => {
    it('should create multiple Claude agents for different features', async () => {
      const agents: AgentSession[] = [
        {
          id: 'id-1',
          name: 'claude-1',
          model: 'claude',
          port: 3000,
          worktreePath: '/project/.maestro/worktrees/claude-1',
          tmuxSession: 'maestro-claude-1',
          status: 'active',
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          id: 'id-2',
          name: 'claude-2',
          model: 'claude',
          port: 3001,
          worktreePath: '/project/.maestro/worktrees/claude-2',
          tmuxSession: 'maestro-claude-2',
          status: 'active',
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          id: 'id-3',
          name: 'claude-3',
          model: 'claude',
          port: 3002,
          worktreePath: '/project/.maestro/worktrees/claude-3',
          tmuxSession: 'maestro-claude-3',
          status: 'active',
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ];

      mockAgentManager.createAgent
        .mockResolvedValueOnce(agents[0])
        .mockResolvedValueOnce(agents[1])
        .mockResolvedValueOnce(agents[2]);

      mockTmuxManager.switchToSession.mockResolvedValue(undefined);

      const command = createPromptCommand();
      
      // Simulate creating agents for different tasks
      const task = 'work on different parts of the application: ' +
                   'agent-1 implements user profile page, ' +
                   'agent-2 creates API documentation, ' +
                   'agent-3 adds unit tests for the auth module';
      
      await command.parseAsync([
        'node', 'test',
        '-a', 'claude:3',
        '-t', task
      ]);

      expect(mockAgentManager.createAgent).toHaveBeenCalledTimes(3);
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Successfully created 3 agent(s)')
      );
    });
  });

  describe('Scenario 4: Auto-confirmation during long running tasks', () => {
    it('should handle various real-world prompts from AI tools', async () => {
      // Setup active Claude session
      const mockSession: AgentSession = {
        id: 'test-id',
        name: 'claude-1',
        model: 'claude',
        port: 3000,
        worktreePath: '/project/.maestro/worktrees/claude-1',
        tmuxSession: 'maestro-claude-1',
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockStateManager.getAllSessions.mockResolvedValue([mockSession]);

      // Simulate various prompts that Claude might show
      const claudePrompts = [
        'Would you like me to create this file? [Y/n]: ',
        'I need to install some dependencies. Proceed? [Y/n]: ',
        'This will modify 5 files. Continue? (y/n): ',
        'Should I run the tests now? [y/N]: ',
        'Create a new React component? Continue?',
        'I found some potential issues. Would you like me to fix them? [Y/n]:'
      ];

      let promptIndex = 0;
      mockTmuxManager.capturePane.mockImplementation(async () => {
        if (promptIndex < claudePrompts.length) {
          return `Claude is working...\n${claudePrompts[promptIndex++]}`;
        }
        return 'Claude is still working...';
      });

      jest.useFakeTimers();
      const command = createAutoCommand();
      const parsePromise = command.parseAsync(['node', 'test', '-i', '2']);
      
      // Wait for initial check
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();

      // Simulate multiple intervals
      for (let i = 0; i < claudePrompts.length; i++) {
        jest.advanceTimersByTime(2000);
        await Promise.resolve();
        await Promise.resolve();
      }

      // Verify auto-confirmations
      expect(mockTmuxManager.sendKeys).toHaveBeenCalledTimes(claudePrompts.length);
      expect(mockTmuxManager.sendKeys).toHaveBeenCalledWith('maestro-claude-1', 1, 'y');

      jest.useRealTimers();
    });
  });

  describe('Scenario 5: Handling errors and recovery', () => {
    it('should gracefully handle port exhaustion when creating many agents', async () => {
      mockAgentManager.createAgent
        .mockResolvedValueOnce({
          id: 'id-1',
          name: 'claude-1',
          model: 'claude',
          port: 3000,
          worktreePath: '/project/.maestro/worktrees/claude-1',
          tmuxSession: 'maestro-claude-1',
          status: 'active',
          createdAt: new Date(),
          updatedAt: new Date()
        })
        .mockRejectedValueOnce(new Error('No available ports in range 3000-4000'))
        .mockRejectedValueOnce(new Error('No available ports in range 3000-4000'));

      const command = createPromptCommand();
      await command.parseAsync([
        'node', 'test',
        '-a', 'claude:3',
        '-t', 'implement multiple microservices'
      ]);

      expect(mockAgentManager.createAgent).toHaveBeenCalledTimes(3);
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Successfully created 1 agent(s)')
      );
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to create agent claude-2')
      );
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to create agent claude-3')
      );
    });

    it('should handle tmux session crashes gracefully', async () => {
      const mockSession: AgentSession = {
        id: 'test-id',
        name: 'claude-1',
        model: 'claude',
        port: 3000,
        worktreePath: '/project/.maestro/worktrees/claude-1',
        tmuxSession: 'maestro-claude-1',
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockStateManager.getAllSessions.mockResolvedValue([mockSession]);
      mockTmuxManager.capturePane.mockRejectedValue(
        new Error('session not found: maestro-claude-1')
      );

      jest.useFakeTimers();
      const command = createAutoCommand();
      await command.parseAsync(['node', 'test']);
      
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to check claude-1')
      );

      jest.useRealTimers();
    });
  });

  describe('Scenario 6: Complex task distribution', () => {
    it('should handle a real-world scenario of building a full-stack feature', async () => {
      const task = `Build a complete task management system with the following requirements:
        1. REST API with CRUD operations for tasks
        2. PostgreSQL database with proper migrations
        3. React frontend with Material-UI
        4. Real-time updates using WebSockets
        5. User authentication and authorization
        6. Comprehensive test coverage
        Please implement this step by step, starting with the database schema.`;

      const mockAgent: AgentSession = {
        id: 'fullstack-id',
        name: 'claude-1',
        model: 'claude',
        port: 3000,
        worktreePath: '/project/.maestro/worktrees/claude-1',
        tmuxSession: 'maestro-claude-1',
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockAgentManager.createAgent.mockResolvedValue(mockAgent);
      mockTmuxManager.switchToSession.mockResolvedValue(undefined);

      const command = createPromptCommand();
      await command.parseAsync([
        'node', 'test',
        '-a', 'claude:1',
        '-t', task,
        '--auto'  // Enable auto-confirmation for this complex task
      ]);

      expect(mockAgentManager.createAgent).toHaveBeenCalledWith('claude-1', 'claude', task);
      expect(mockConfig.autoConfirm).toBe(true); // Auto-confirm was enabled
    });
  });

  describe('Scenario 7: Working with non-standard AI models', () => {
    it('should support custom AI model endpoints', async () => {
      const customModels = [
        'claude-3-opus',
        'claude-3-sonnet', 
        'gpt-4-turbo',
        'deepseek-coder',
        'qwen-coder',
        'local-llama-70b'
      ];

      const agents = customModels.map((model, index) => ({
        id: `id-${index}`,
        name: `${model}-1`,
        model: model,
        port: 3000 + index,
        worktreePath: `/project/.maestro/worktrees/${model}-1`,
        tmuxSession: `maestro-${model}-1`,
        status: 'active' as const,
        createdAt: new Date(),
        updatedAt: new Date()
      }));

      agents.forEach((agent, index) => {
        mockAgentManager.createAgent.mockResolvedValueOnce(agent);
      });

      const command = createPromptCommand();
      const agentSpec = customModels.map(model => `${model}:1`).join(',');
      
      await command.parseAsync([
        'node', 'test',
        '-a', agentSpec,
        '-t', 'optimize the database queries for better performance'
      ]);

      expect(mockAgentManager.createAgent).toHaveBeenCalledTimes(customModels.length);
      customModels.forEach((model, index) => {
        expect(mockAgentManager.createAgent).toHaveBeenNthCalledWith(
          index + 1,
          `${model}-1`,
          model,
          'optimize the database queries for better performance'
        );
      });
    });
  });

  describe('Scenario 8: Development workflow with branches', () => {
    it('should simulate a typical development workflow', async () => {
      // This test simulates creating agents for different branches/features
      const features = [
        { name: 'feature-auth', task: 'implement OAuth2 authentication with Google and GitHub' },
        { name: 'feature-api', task: 'create GraphQL API schema and resolvers' },
        { name: 'bugfix-memory', task: 'fix memory leak in WebSocket connections' }
      ];

      const agents = features.map((feature, index) => ({
        id: `id-${index}`,
        name: `claude-${index + 1}`,
        model: 'claude',
        port: 3000 + index,
        worktreePath: `/project/.maestro/worktrees/claude-${index + 1}`,
        tmuxSession: `maestro-claude-${index + 1}`,
        status: 'active' as const,
        createdAt: new Date(),
        updatedAt: new Date()
      }));

      agents.forEach((agent, index) => {
        mockAgentManager.createAgent.mockResolvedValueOnce(agent);
      });

      const command = createPromptCommand();
      
      // Create agents for parallel feature development
      await command.parseAsync([
        'node', 'test',
        '-a', 'claude:3',
        '-t', features.map(f => `${f.name}: ${f.task}`).join('; '),
        '--auto'
      ]);

      expect(mockAgentManager.createAgent).toHaveBeenCalledTimes(3);
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Agents are running in tmux sessions')
      );
    });
  });
});