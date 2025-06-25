import { createMergeCommand } from '../merge';
import { createDiffCommand } from '../diff';
import { StateManager } from '../../lib/state/state-manager';
import { AgentManager } from '../../lib/agent/agent-manager';
import { WorktreeManager } from '../../lib/git/worktree-manager';
import { TmuxManager } from '../../lib/tmux/tmux-manager';
import { ConfigManager } from '../../lib/config/config-manager';
import { AgentSession } from '../../types';
import execa from 'execa';

jest.mock('../../lib/state/state-manager');
jest.mock('../../lib/agent/agent-manager');
jest.mock('../../lib/config/config-manager');
jest.mock('../../lib/tmux/tmux-manager');
jest.mock('../../lib/git/worktree-manager');
jest.mock('execa');
jest.mock('inquirer');

describe('Multi-Agent Merge Scenarios', () => {
  let mockStateManager: jest.Mocked<StateManager>;
  let mockAgentManager: jest.Mocked<AgentManager>;
  let mockConfigManager: jest.Mocked<ConfigManager>;
  let mockTmuxManager: jest.Mocked<TmuxManager>;
  let mockWorktreeManager: jest.Mocked<WorktreeManager>;
  let consoleLogSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockStateManager = new StateManager() as jest.Mocked<StateManager>;
    mockConfigManager = new ConfigManager() as jest.Mocked<ConfigManager>;
    mockTmuxManager = new TmuxManager() as jest.Mocked<TmuxManager>;
    mockWorktreeManager = new WorktreeManager() as jest.Mocked<WorktreeManager>;
    
    (StateManager as jest.Mock).mockReturnValue(mockStateManager);
    (ConfigManager as jest.Mock).mockReturnValue(mockConfigManager);
    (TmuxManager as jest.Mock).mockReturnValue(mockTmuxManager);
    (WorktreeManager as jest.Mock).mockReturnValue(mockWorktreeManager);

    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
  });

  describe('Scenario: Multiple agents implementing the same feature', () => {
    it('should identify overlapping files and merge conflicts', async () => {
      const agents: AgentSession[] = [
        {
          id: 'claude-1-id',
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
          id: 'gpt4-1-id',
          name: 'gpt4-1',
          model: 'gpt-4',
          port: 3001,
          worktreePath: '/project/.maestro/worktrees/gpt4-1',
          tmuxSession: 'maestro-gpt4-1',
          status: 'active',
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          id: 'deepseek-1-id',
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

      mockStateManager.getAllSessions.mockResolvedValue(agents);

      // Mock git diff --name-only for each agent
      (execa as jest.MockedFunction<typeof execa>)
        // claude-1 file list
        .mockResolvedValueOnce({
          stdout: 'src/auth.ts\nsrc/utils.ts\nsrc/api.ts',
          stderr: '',
          exitCode: 0
        } as any)
        // gpt4-1 file list
        .mockResolvedValueOnce({
          stdout: 'src/auth.ts\nsrc/database.ts\nsrc/api.ts\nsrc/models.ts',
          stderr: '',
          exitCode: 0
        } as any)
        // deepseek-1 file list
        .mockResolvedValueOnce({
          stdout: 'src/auth.ts\nsrc/utils.ts\nsrc/helpers.ts',
          stderr: '',
          exitCode: 0
        } as any);

      const command = createMergeCommand();
      await command.parseAsync(['node', 'test', '--compare-only']);

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Preparing to merge 3 agents')
      );
    });
  });

  describe('Scenario: Best-of merge with quality metrics', () => {
    it('should select the best implementation based on tests and linting', async () => {
      const agents: AgentSession[] = [
        {
          id: 'claude-1-id',
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
          id: 'claude-2-id',
          name: 'claude-2',
          model: 'claude',
          port: 3001,
          worktreePath: '/project/.maestro/worktrees/claude-2',
          tmuxSession: 'maestro-claude-2',
          status: 'active',
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ];

      mockStateManager.getAllSessions.mockResolvedValue(agents);

      // Mock quality checks
      (execa as jest.MockedFunction<typeof execa>)
        // git diff --name-only for claude-1
        .mockResolvedValueOnce({ stdout: 'src/auth.ts\nsrc/utils.ts\nsrc/api.ts', stderr: '', exitCode: 0 } as any)
        // git diff --name-only for claude-2
        .mockResolvedValueOnce({ stdout: 'src/auth.ts\nsrc/database.ts\nsrc/api.ts\nsrc/models.ts', stderr: '', exitCode: 0 } as any)
        // Tests for claude-1 (passing)
        .mockResolvedValueOnce({ stdout: 'All tests pass', stderr: '', exitCode: 0 } as any)
        // Tests for claude-2 (failing)
        .mockResolvedValueOnce({ stdout: 'Tests failed', stderr: '', exitCode: 1 } as any)
        // Linting for claude-1 (clean)
        .mockResolvedValueOnce({ stdout: 'No lint errors', stderr: '', exitCode: 0 } as any)
        // Linting for claude-2 (errors)
        .mockResolvedValueOnce({ stdout: 'Lint errors', stderr: '', exitCode: 1 } as any)
        // git diff --stat for claude-1
        .mockResolvedValueOnce({ stdout: '3 files changed, 150 insertions(+), 10 deletions(-)', stderr: '', exitCode: 0 } as any)
        // git diff --stat for claude-2
        .mockResolvedValueOnce({ stdout: '4 files changed, 300 insertions(+), 50 deletions(-)', stderr: '', exitCode: 0 } as any)
        // git checkout -b for merge branch
        .mockResolvedValueOnce({ stdout: '', stderr: '', exitCode: 0 } as any)
        // git merge for claude-1
        .mockResolvedValueOnce({ stdout: 'Merge successful', stderr: '', exitCode: 0 } as any);

      const command = createMergeCommand();
      await command.parseAsync(['node', 'test', '--strategy', 'best']);

      // Should select claude-1 as the best implementation
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('claude-1: All tests passing')
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Merging best implementation from claude-1')
      );
    });
  });

  describe('Scenario: Comparing implementations with diff command', () => {
    it('should show detailed differences between two agents', async () => {
      const agents: AgentSession[] = [
        {
          id: 'claude-1-id',
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
          id: 'gpt4-1-id',
          name: 'gpt4-1',
          model: 'gpt-4',
          port: 3001,
          worktreePath: '/project/.maestro/worktrees/gpt4-1',
          tmuxSession: 'maestro-gpt4-1',
          status: 'active',
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ];

      mockStateManager.getAllSessions.mockResolvedValue(agents);

      // Mock file lists
      (execa as jest.MockedFunction<typeof execa>)
        // Files changed for claude-1
        .mockResolvedValueOnce({
          stdout: 'src/auth.ts\nsrc/utils.ts\nsrc/api.ts',
          stderr: '',
          exitCode: 0
        } as any)
        // Files changed for gpt4-1
        .mockResolvedValueOnce({
          stdout: 'src/auth.ts\nsrc/database.ts\nsrc/api.ts',
          stderr: '',
          exitCode: 0
        } as any);

      const command = createDiffCommand();
      await command.parseAsync(['node', 'test', 'claude-1', 'gpt4-1']);

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Comparing claude-1 vs gpt4-1')
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Common files: 2')
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Unique to claude-1: 1')
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Unique to gpt4-1: 1')
      );
    });
  });

  describe('Scenario: Automatic conflict resolution', () => {
    it('should handle non-conflicting merges automatically', async () => {
      const agents: AgentSession[] = [
        {
          id: 'claude-backend-id',
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
          id: 'claude-frontend-id',
          name: 'claude-frontend',
          model: 'claude',
          port: 3001,
          worktreePath: '/project/.maestro/worktrees/claude-frontend',
          tmuxSession: 'maestro-claude-frontend',
          status: 'active',
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ];

      mockStateManager.getAllSessions.mockResolvedValue(agents);

      // Mock successful merges
      (execa as jest.MockedFunction<typeof execa>)
        // git diff --name-only for backend
        .mockResolvedValueOnce({ stdout: 'backend/api.ts\nbackend/models.ts', stderr: '', exitCode: 0 } as any)
        // git diff --name-only for frontend
        .mockResolvedValueOnce({ stdout: 'frontend/components.tsx\nfrontend/styles.css', stderr: '', exitCode: 0 } as any)
        // Create merge branch
        .mockResolvedValueOnce({ stdout: '', stderr: '', exitCode: 0 } as any)
        // Merge backend (success)
        .mockResolvedValueOnce({ stdout: 'Merge successful', stderr: '', exitCode: 0 } as any)
        // Merge frontend (success)
        .mockResolvedValueOnce({ stdout: 'Merge successful', stderr: '', exitCode: 0 } as any);

      const command = createMergeCommand();
      await command.parseAsync(['node', 'test', '--strategy', 'auto']);

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('✓ Merged claude-backend')
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('✓ Merged claude-frontend')
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Successfully merged 2 agents')
      );
    });
  });
});