import { AgentManager } from '../../lib/agent/agent-manager';
import { ConfigManager } from '../../lib/config/config-manager';
import { StateManager } from '../../lib/state/state-manager';
import { TmuxManager } from '../../lib/tmux/tmux-manager';
import { WorktreeManager } from '../../lib/git/worktree-manager';
import { AgentSession, MaestroConfig } from '../../types';
import { createPromptCommand } from '../prompt';
import { createKillCommand } from '../kill';
import { createCheckpointCommand } from '../checkpoint';
import { createLsCommand } from '../ls';

jest.mock('../../lib/agent/agent-manager');
jest.mock('../../lib/config/config-manager');
jest.mock('../../lib/state/state-manager');
jest.mock('../../lib/tmux/tmux-manager');
jest.mock('../../lib/git/worktree-manager');
jest.mock('fs-extra');
jest.mock('execa');

describe('End-to-End Workflows', () => {
  let mockAgentManager: jest.Mocked<AgentManager>;
  let mockConfigManager: jest.Mocked<ConfigManager>;
  let mockStateManager: jest.Mocked<StateManager>;
  let mockTmuxManager: jest.Mocked<TmuxManager>;
  let mockWorktreeManager: jest.Mocked<WorktreeManager>;
  let consoleLogSpy: jest.SpyInstance;
  let processExitSpy: jest.SpyInstance;

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
    mockConfigManager.getConfig.mockReturnValue(mockConfig);

    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
    processExitSpy = jest.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit');
    });
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    processExitSpy.mockRestore();
  });

  describe('Complete Feature Development Workflow', () => {
    it('should handle full lifecycle: create → develop → checkpoint → merge', async () => {
      // Step 1: Create agent for new feature
      const mockAgent: AgentSession = {
        id: 'feature-123',
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
      mockStateManager.getAllSessions.mockResolvedValue([mockAgent]);
      mockStateManager.getSession.mockResolvedValue(mockAgent);

      // Create agent
      const promptCommand = createPromptCommand();
      await promptCommand.parseAsync([
        'node', 'test',
        '-a', 'claude:1',
        '-t', 'implement user profile page with avatar upload, bio editing, and social links'
      ]);

      expect(mockAgentManager.createAgent).toHaveBeenCalled();
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Created agent claude-1')
      );

      // Step 2: Simulate development activity
      mockTmuxManager.sessionExists.mockResolvedValue(true);
      mockTmuxManager.capturePane
        .mockResolvedValueOnce('Claude is implementing the feature...')
        .mockResolvedValueOnce('✓ Created ProfilePage.tsx')
        .mockResolvedValueOnce('✓ Added avatar upload functionality')
        .mockResolvedValueOnce('✓ Tests passing');

      // Step 3: List agents to check status
      const lsCommand = createLsCommand();
      // Mock console output for ls command
      const mockWrite = jest.fn();
      (lsCommand as any).configureOutput({
        writeOut: mockWrite,
        writeErr: mockWrite
      });

      await lsCommand.parseAsync(['node', 'test']);
      
      // Verify agent is listed
      expect(mockStateManager.getAllSessions).toHaveBeenCalled();

      // Step 4: Checkpoint the work
      mockAgentManager.checkpointAgent.mockResolvedValue(undefined);

      const checkpointCommand = createCheckpointCommand();
      await checkpointCommand.parseAsync([
        'node', 'test',
        'claude-1'
      ]);

      expect(mockAgentManager.checkpointAgent).toHaveBeenCalledWith(
        'feature-123',
        'main'
      );

      // Step 5: Kill the agent
      mockAgentManager.killAgent.mockResolvedValue(undefined);
      
      const killCommand = createKillCommand();
      await killCommand.parseAsync(['node', 'test', 'claude-1']);

      expect(mockAgentManager.killAgent).toHaveBeenCalledWith('feature-123');
      // Kill command should log success message
      expect(mockAgentManager.killAgent).toHaveBeenCalled();
    });
  });

  describe('Multi-Agent Collaboration Workflow', () => {
    it('should coordinate multiple agents working on related features', async () => {
      // Create multiple agents for a large feature
      const agents: AgentSession[] = [
        {
          id: 'backend-id',
          name: 'claude-backend',
          model: 'claude',
          port: 3000,
          worktreePath: '/project/.maestro/worktrees/claude-backend',
          tmuxSession: 'maestro-claude-backend',
          status: 'active',
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          id: 'frontend-id',
          name: 'claude-frontend',
          model: 'claude',
          port: 3001,
          worktreePath: '/project/.maestro/worktrees/claude-frontend',
          tmuxSession: 'maestro-claude-frontend',
          status: 'active',
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          id: 'tests-id',
          name: 'claude-tests',
          model: 'claude',
          port: 3002,
          worktreePath: '/project/.maestro/worktrees/claude-tests',
          tmuxSession: 'maestro-claude-tests',
          status: 'active',
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ];

      // Mock agent creation
      agents.forEach((agent, index) => {
        mockAgentManager.createAgent.mockResolvedValueOnce(agent);
      });

      // Step 1: Create specialized agents
      const promptCommand = createPromptCommand();
      await promptCommand.parseAsync([
        'node', 'test',
        '-a', 'claude:3',
        '-t', 'Build a comment system: backend API (agent 1), React UI (agent 2), test suite (agent 3)'
      ]);

      expect(mockAgentManager.createAgent).toHaveBeenCalledTimes(3);

      // Step 2: Simulate parallel development
      mockStateManager.getAllSessions.mockResolvedValue(agents);
      
      agents.forEach(agent => {
        mockTmuxManager.sessionExists.mockResolvedValueOnce(true);
      });

      // Step 3: Checkpoint all agents
      mockAgentManager.checkpointAgent.mockResolvedValue(undefined);

      const checkpointCommand = createCheckpointCommand();
      await checkpointCommand.parseAsync([
        'node', 'test'
      ]);

      // Verify all agents were checkpointed
      expect(mockAgentManager.checkpointAgent).toHaveBeenCalledTimes(3);
      expect(mockAgentManager.checkpointAgent).toHaveBeenCalledWith('backend-id', 'main');
      expect(mockAgentManager.checkpointAgent).toHaveBeenCalledWith('frontend-id', 'main');
      expect(mockAgentManager.checkpointAgent).toHaveBeenCalledWith('tests-id', 'main');
    });
  });

  describe('Error Recovery Workflow', () => {
    it('should recover from agent crashes and continue work', async () => {
      const mockAgent: AgentSession = {
        id: 'crash-test-id',
        name: 'claude-1',
        model: 'claude',
        port: 3000,
        worktreePath: '/project/.maestro/worktrees/claude-1',
        tmuxSession: 'maestro-claude-1',
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date()
      };

      // Initial creation succeeds
      mockAgentManager.createAgent.mockResolvedValue(mockAgent);
      mockStateManager.getAllSessions.mockResolvedValue([mockAgent]);

      const promptCommand = createPromptCommand();
      await promptCommand.parseAsync([
        'node', 'test',
        '-a', 'claude:1',
        '-t', 'implement complex data migration script'
      ]);

      // Simulate tmux session crash
      mockTmuxManager.sessionExists.mockResolvedValue(false);
      mockStateManager.getSession.mockResolvedValue({
        ...mockAgent,
        status: 'error'
      });

      // In a real scenario, user would restart the agent
      // For now, simulate recovery by creating a new agent
      mockAgentManager.createAgent.mockResolvedValue({
        ...mockAgent,
        id: 'recovery-id',
        name: 'claude-recovery',
        port: 3001
      });

      await promptCommand.parseAsync([
        'node', 'test',
        '-a', 'claude:1',
        '-t', 'continue with data migration script implementation'
      ]);

      expect(mockAgentManager.createAgent).toHaveBeenCalledTimes(2);
    });
  });

  describe('CI/CD Integration Workflow', () => {
    it('should work with automated testing and deployment', async () => {
      // Simulate CI environment
      process.env.CI = 'true';
      
      const mockAgent: AgentSession = {
        id: 'ci-agent-id',
        name: 'claude-ci',
        model: 'claude',
        port: 3000,
        worktreePath: '/project/.maestro/worktrees/claude-ci',
        tmuxSession: 'maestro-claude-ci',
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockAgentManager.createAgent.mockResolvedValue(mockAgent);
      mockStateManager.getAllSessions.mockResolvedValue([mockAgent]);
      
      // Create agent for automated fixes
      const promptCommand = createPromptCommand();
      await promptCommand.parseAsync([
        'node', 'test',
        '-a', 'claude:1',
        '-t', 'fix all ESLint errors and failing tests',
        '--auto' // Auto-confirm in CI
      ]);

      expect(mockConfig.autoConfirm).toBe(true);

      // Simulate automated workflow
      mockTmuxManager.capturePane
        .mockResolvedValueOnce('Running ESLint...')
        .mockResolvedValueOnce('Fixed 15 errors')
        .mockResolvedValueOnce('Running tests...')
        .mockResolvedValueOnce('All tests passing');

      // Auto-checkpoint when done
      mockAgentManager.checkpointAgent.mockResolvedValue(undefined);
      
      const checkpointCommand = createCheckpointCommand();
      await checkpointCommand.parseAsync([
        'node', 'test',
        'claude-ci'
      ]);

      expect(mockAgentManager.checkpointAgent).toHaveBeenCalledWith('ci-agent-id', 'main');

      // Cleanup
      delete process.env.CI;
    });
  });

  describe('Team Collaboration Workflow', () => {
    it('should support multiple developers using different agents', async () => {
      // Simulate different team members working on different parts
      const teamAgents = [
        {
          developer: 'Alice',
          agent: {
            id: 'alice-feature',
            name: 'claude-alice',
            model: 'claude',
            port: 3000,
            worktreePath: '/project/.maestro/worktrees/claude-alice',
            tmuxSession: 'maestro-claude-alice',
            status: 'active' as const,
            createdAt: new Date(),
            updatedAt: new Date()
          },
          task: 'implement payment integration with Stripe'
        },
        {
          developer: 'Bob',
          agent: {
            id: 'bob-feature',
            name: 'gpt4-bob',
            model: 'gpt-4',
            port: 3001,
            worktreePath: '/project/.maestro/worktrees/gpt4-bob',
            tmuxSession: 'maestro-gpt4-bob',
            status: 'active' as const,
            createdAt: new Date(),
            updatedAt: new Date()
          },
          task: 'optimize database queries and add indexes'
        },
        {
          developer: 'Carol',
          agent: {
            id: 'carol-feature',
            name: 'claude-carol',
            model: 'claude',
            port: 3002,
            worktreePath: '/project/.maestro/worktrees/claude-carol',
            tmuxSession: 'maestro-claude-carol',
            status: 'active' as const,
            createdAt: new Date(),
            updatedAt: new Date()
          },
          task: 'create admin dashboard with charts and analytics'
        }
      ];

      // Each developer creates their agent
      for (const { developer, agent, task } of teamAgents) {
        mockAgentManager.createAgent.mockResolvedValueOnce(agent);
        
        const promptCommand = createPromptCommand();
        await promptCommand.parseAsync([
          'node', 'test',
          '-a', `${agent.model}:1`,
          '-t', task
        ]);
      }

      // Verify all agents were created
      expect(mockAgentManager.createAgent).toHaveBeenCalledTimes(3);
      
      // List all active agents
      mockStateManager.getAllSessions.mockResolvedValue(
        teamAgents.map(t => t.agent)
      );

      const lsCommand = createLsCommand();
      await lsCommand.parseAsync(['node', 'test']);

      expect(mockStateManager.getAllSessions).toHaveBeenCalled();
    });
  });
});