import { Command } from 'commander';
import { createAutoCommand } from '../auto';
import { StateManager } from '../../lib/state/state-manager';
import { TmuxManager } from '../../lib/tmux/tmux-manager';
import { AgentSession } from '../../types';

jest.mock('../../lib/state/state-manager');
jest.mock('../../lib/tmux/tmux-manager');

// Mock timers
jest.useFakeTimers();

describe('auto command', () => {
  let command: Command;
  let mockStateManager: jest.Mocked<StateManager>;
  let mockTmuxManager: jest.Mocked<TmuxManager>;
  let consoleLogSpy: jest.SpyInstance;
  let consoleErrorSpy: jest.SpyInstance;
  let setIntervalSpy: jest.SpyInstance;
  let clearIntervalSpy: jest.SpyInstance;
  let processExitSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockStateManager = new StateManager() as jest.Mocked<StateManager>;
    mockTmuxManager = new TmuxManager() as jest.Mocked<TmuxManager>;
    
    (StateManager as jest.Mock).mockReturnValue(mockStateManager);
    (TmuxManager as jest.Mock).mockReturnValue(mockTmuxManager);

    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
    setIntervalSpy = jest.spyOn(global, 'setInterval');
    clearIntervalSpy = jest.spyOn(global, 'clearInterval');
    processExitSpy = jest.spyOn(process, 'exit').mockImplementation((code?: string | number | null | undefined) => {
      throw new Error(`process.exit: ${code}`);
    });

    command = createAutoCommand();
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    setIntervalSpy.mockRestore();
    clearIntervalSpy.mockRestore();
    processExitSpy.mockRestore();
    jest.clearAllTimers();
  });

  describe('prompt detection and response', () => {
    it('should respond to Y/n prompts with y', async () => {
      const mockSession: AgentSession = {
        id: 'test-id',
        name: 'test-agent',
        model: 'claude',
        port: 3000,
        worktreePath: '/test/worktree',
        tmuxSession: 'maestro-test-agent',
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockStateManager.getAllSessions.mockResolvedValue([mockSession]);
      mockTmuxManager.capturePane
        .mockResolvedValueOnce('Some output\nContinue? [Y/n]: ');

      // Start the command
      const parsePromise = command.parseAsync(['node', 'test']);

      // Wait for initial check to complete
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();

      expect(mockTmuxManager.sendKeys).toHaveBeenCalledWith('maestro-test-agent', 1, 'y');
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Auto-confirming prompt for test-agent')
      );
    });

    it('should handle various confirmation prompt formats', async () => {
      const mockSession: AgentSession = {
        id: 'test-id',
        name: 'test-agent',
        model: 'claude',
        port: 3000,
        worktreePath: '/test/worktree',
        tmuxSession: 'maestro-test-agent',
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockStateManager.getAllSessions.mockResolvedValue([mockSession]);

      const prompts = [
        'Continue?',
        'Proceed?',
        'Are you sure? [Y/n]',
        'Confirm deletion [y/N]:',
        'Do you want to continue (y/n)?'
      ];

      for (const prompt of prompts) {
        jest.clearAllMocks();
        mockStateManager.getAllSessions.mockResolvedValue([mockSession]);
        mockTmuxManager.capturePane.mockResolvedValueOnce(`Some output\n${prompt}`);

        const parsePromise = command.parseAsync(['node', 'test']);
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();

        expect(mockTmuxManager.sendKeys).toHaveBeenCalledWith('maestro-test-agent', 1, 'y');
      }
    });

    it('should handle input prompts by pressing Enter', async () => {
      const mockSession: AgentSession = {
        id: 'test-id',
        name: 'test-agent',
        model: 'claude',
        port: 3000,
        worktreePath: '/test/worktree',
        tmuxSession: 'maestro-test-agent',
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockStateManager.getAllSessions.mockResolvedValue([mockSession]);
      mockTmuxManager.capturePane
        .mockResolvedValueOnce('Enter the project name:');

      const parsePromise = command.parseAsync(['node', 'test']);
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();

      expect(mockTmuxManager.sendKeys).toHaveBeenCalledWith('maestro-test-agent', 1, '');
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Auto-responding to input prompt for test-agent')
      );
    });
  });

  describe('multiple agents', () => {
    it('should check all agents', async () => {
      const sessions: AgentSession[] = [
        {
          id: 'agent-1',
          name: 'agent-1',
          model: 'claude',
          port: 3000,
          worktreePath: '/test/worktree-1',
          tmuxSession: 'maestro-agent-1',
          status: 'active',
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          id: 'agent-2',
          name: 'agent-2',
          model: 'gpt-4',
          port: 3001,
          worktreePath: '/test/worktree-2',
          tmuxSession: 'maestro-agent-2',
          status: 'active',
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ];

      mockStateManager.getAllSessions.mockResolvedValue(sessions);
      mockTmuxManager.capturePane
        .mockResolvedValueOnce('Normal output') // agent-1
        .mockResolvedValueOnce('Continue? [Y/n]: '); // agent-2

      const parsePromise = command.parseAsync(['node', 'test']);
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();

      expect(mockTmuxManager.capturePane).toHaveBeenCalledTimes(2);
      expect(mockTmuxManager.capturePane).toHaveBeenCalledWith('maestro-agent-1', 1);
      expect(mockTmuxManager.capturePane).toHaveBeenCalledWith('maestro-agent-2', 1);
      expect(mockTmuxManager.sendKeys).toHaveBeenCalledWith('maestro-agent-2', 1, 'y');
    });
  });

  describe('error handling', () => {
    it('should handle tmux errors gracefully', async () => {
      const mockSession: AgentSession = {
        id: 'test-id',
        name: 'test-agent',
        model: 'claude',
        port: 3000,
        worktreePath: '/test/worktree',
        tmuxSession: 'maestro-test-agent',
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockStateManager.getAllSessions.mockResolvedValue([mockSession]);
      mockTmuxManager.capturePane.mockRejectedValue(new Error('Tmux session not found'));

      const parsePromise = command.parseAsync(['node', 'test']);
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to check test-agent')
      );
    });

    it('should continue checking other agents after error', async () => {
      const sessions: AgentSession[] = [
        {
          id: 'agent-1',
          name: 'agent-1',
          model: 'claude',
          port: 3000,
          worktreePath: '/test/worktree-1',
          tmuxSession: 'maestro-agent-1',
          status: 'active',
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          id: 'agent-2',
          name: 'agent-2',
          model: 'gpt-4',
          port: 3001,
          worktreePath: '/test/worktree-2',
          tmuxSession: 'maestro-agent-2',
          status: 'active',
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ];

      mockStateManager.getAllSessions.mockResolvedValue(sessions);
      mockTmuxManager.capturePane
        .mockRejectedValueOnce(new Error('Session not found')) // agent-1 fails
        .mockResolvedValueOnce('Continue? [Y/n]: '); // agent-2 succeeds

      const parsePromise = command.parseAsync(['node', 'test']);
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();

      expect(mockTmuxManager.sendKeys).toHaveBeenCalledWith('maestro-agent-2', 1, 'y');
    });

    it('should handle invalid interval', async () => {
      await expect(async () => {
        await command.parseAsync(['node', 'test', '-i', '0']);
      }).rejects.toThrow('process.exit: 1');

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Invalid interval. Must be at least 1 second.')
      );
    });
  });

  describe('interval management', () => {
    it('should use default interval when not specified', async () => {
      mockStateManager.getAllSessions.mockResolvedValue([]);

      const parsePromise = command.parseAsync(['node', 'test']);
      await Promise.resolve();
      await Promise.resolve();

      expect(setIntervalSpy).toHaveBeenCalledWith(expect.any(Function), 5000);
    });

    it('should use custom interval when specified', async () => {
      mockStateManager.getAllSessions.mockResolvedValue([]);

      const parsePromise = command.parseAsync(['node', 'test', '-i', '10']);
      await Promise.resolve();
      await Promise.resolve();

      expect(setIntervalSpy).toHaveBeenCalledWith(expect.any(Function), 10000);
    });

    it('should run check immediately before starting interval', async () => {
      mockStateManager.getAllSessions.mockResolvedValue([]);

      const parsePromise = command.parseAsync(['node', 'test']);
      await Promise.resolve();
      await Promise.resolve();

      // Should have called getAllSessions once for immediate check
      expect(mockStateManager.getAllSessions).toHaveBeenCalledTimes(1);

      // Advance timer to trigger interval
      jest.advanceTimersByTime(5000);
      await Promise.resolve();

      // Should have called again from interval
      expect(mockStateManager.getAllSessions).toHaveBeenCalledTimes(2);
    });
  });

  describe('signal handling', () => {
    it('should setup SIGINT handler', async () => {
      mockStateManager.getAllSessions.mockResolvedValue([]);
      
      // Mock process.on to capture the handler
      const processOnSpy = jest.spyOn(process, 'on');

      const parsePromise = command.parseAsync(['node', 'test']);
      await Promise.resolve();
      await Promise.resolve();

      // Verify SIGINT handler was registered
      expect(processOnSpy).toHaveBeenCalledWith('SIGINT', expect.any(Function));
      
      processOnSpy.mockRestore();
    });

    it('should log message when stopping', async () => {
      mockStateManager.getAllSessions.mockResolvedValue([]);
      
      // Mock process.on to capture and test the handler
      let sigintHandler: Function;
      const processOnSpy = jest.spyOn(process, 'on').mockImplementation((event: string | symbol, handler: any) => {
        if (event === 'SIGINT') {
          sigintHandler = handler;
        }
        return process;
      });

      const parsePromise = command.parseAsync(['node', 'test']);
      await Promise.resolve();
      await Promise.resolve();

      const intervalId = (setIntervalSpy.mock.results[0] as any).value;

      // The handler will call process.exit, which we're mocking to throw
      expect(() => sigintHandler!()).toThrow('process.exit: 0');

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Stopping auto mode...')
      );
      expect(clearIntervalSpy).toHaveBeenCalledWith(intervalId);
      
      processOnSpy.mockRestore();
    });
  });
});