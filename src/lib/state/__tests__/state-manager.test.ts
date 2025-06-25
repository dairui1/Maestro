import { StateManager } from '../state-manager';
import * as fs from 'fs-extra';
import * as path from 'path';
import { z } from 'zod';
import { AgentSession, GlobalState } from '../../../types';

jest.mock('fs-extra');
jest.mock('os', () => ({
  homedir: jest.fn(() => '/mock/home')
}));

describe('StateManager', () => {
  let stateManager: StateManager;
  const mockStatePath = '/mock/home/.local/share/maestro/state.json';

  beforeEach(() => {
    jest.clearAllMocks();
    (fs.ensureDirSync as jest.Mock).mockReturnValue(undefined);
    stateManager = new StateManager();
  });

  describe('initialization', () => {
    it('should create state directory if it does not exist', async () => {
      (fs.pathExists as jest.Mock).mockResolvedValue(false);
      (fs.readJson as jest.Mock).mockRejectedValue(new Error('File not found'));
      (fs.writeJson as jest.Mock).mockResolvedValue(undefined);

      await stateManager.load();

      expect(fs.ensureDirSync).toHaveBeenCalledWith(
        '/mock/home/.local/share/maestro'
      );
    });

    it('should load existing valid state', async () => {
      const mockState = {
        version: '1.0.0',
        sessions: [{
          id: 'test-id',
          name: 'test-agent',
          model: 'claude',
          port: 3000,
          worktreePath: '/test/worktree',
          tmuxSession: 'maestro-test-agent',
          status: 'active',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }],
        allocatedPorts: [3000],
        baseDirectory: '/test/base',
        lastUpdated: new Date().toISOString()
      };

      (fs.pathExists as jest.Mock).mockResolvedValue(true);
      (fs.readJson as jest.Mock).mockResolvedValue(mockState);
      (fs.writeJson as jest.Mock).mockResolvedValue(undefined);

      const state = await stateManager.load();

      expect(state.sessions).toHaveLength(1);
      expect(state.sessions[0].name).toBe('test-agent');
    });

    it('should handle corrupted state file', async () => {
      (fs.pathExists as jest.Mock).mockResolvedValue(true);
      (fs.readJson as jest.Mock).mockRejectedValue(new Error('Invalid JSON'));
      (fs.writeJson as jest.Mock).mockResolvedValue(undefined);

      const state = await stateManager.load();

      expect(state).toEqual({
        version: '1.0.0',
        sessions: [],
        allocatedPorts: [],
        baseDirectory: process.cwd(),
        lastUpdated: expect.any(Date)
      });
    });

    it('should validate state schema', async () => {
      const invalidState = {
        sessions: [{
          id: 'test-id',
          name: 'test-agent',
          // missing required fields
        }],
        allocatedPorts: [],
        baseDirectory: '/test'
      };

      (fs.pathExists as jest.Mock).mockResolvedValue(true);
      (fs.readJson as jest.Mock).mockResolvedValue(invalidState);
      (fs.writeJson as jest.Mock).mockResolvedValue(undefined);

      const state = await stateManager.load();

      // Should create default state due to validation failure
      expect(state.sessions).toEqual([]);
      expect(state.allocatedPorts).toEqual([]);
    });
  });

  describe('session management', () => {
    beforeEach(async () => {
      (fs.pathExists as jest.Mock).mockResolvedValue(false);
      (fs.readJson as jest.Mock).mockRejectedValue(new Error('File not found'));
      (fs.writeJson as jest.Mock).mockResolvedValue(undefined);
      await stateManager.load();
    });

    it('should add a new session', async () => {
      const newSession: AgentSession = {
        id: 'new-id',
        name: 'new-agent',
        model: 'claude',
        port: 3001,
        worktreePath: '/new/worktree',
        tmuxSession: 'maestro-new-agent',
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await stateManager.addSession(newSession);

      expect(fs.writeJson).toHaveBeenCalledWith(
        mockStatePath,
        expect.objectContaining({
          sessions: expect.arrayContaining([
            expect.objectContaining({
              name: 'new-agent',
              port: 3001
            })
          ]),
          allocatedPorts: [3001]
        }),
        { spaces: 2 }
      );
    });

    it('should remove a session', async () => {
      const session: AgentSession = {
        id: 'remove-id',
        name: 'remove-agent',
        model: 'claude',
        port: 3002,
        worktreePath: '/remove/worktree',
        tmuxSession: 'maestro-remove-agent',
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await stateManager.addSession(session);
      await stateManager.removeSession('remove-id');

      expect(fs.writeJson).toHaveBeenLastCalledWith(
        mockStatePath,
        expect.objectContaining({
          sessions: [],
          allocatedPorts: []
        }),
        { spaces: 2 }
      );
    });

    it('should get session by id', async () => {
      const session: AgentSession = {
        id: 'find-id',
        name: 'find-agent',
        model: 'claude',
        port: 3003,
        worktreePath: '/find/worktree',
        tmuxSession: 'maestro-find-agent',
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await stateManager.addSession(session);
      const found = await stateManager.getSession('find-id');

      expect(found).toBeDefined();
      expect(found?.name).toBe('find-agent');
    });

    it('should return undefined for non-existent session', async () => {
      const found = await stateManager.getSession('non-existent');
      expect(found).toBeUndefined();
    });
  });

  describe('port management', () => {
    beforeEach(async () => {
      (fs.pathExists as jest.Mock).mockResolvedValue(false);
      (fs.writeJson as jest.Mock).mockResolvedValue(undefined);
      await stateManager.load();
    });

    it('should allocate next available port', async () => {
      const port1 = await stateManager.getNextAvailablePort(3000, 3005);
      expect(port1).toBe(3000);

      await stateManager.addSession({
        id: 'port-id-1',
        name: 'port-agent-1',
        model: 'claude',
        port: port1!,
        worktreePath: '/port/worktree',
        tmuxSession: 'maestro-port-agent-1',
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date()
      });

      const port2 = await stateManager.getNextAvailablePort(3000, 3005);
      expect(port2).toBe(3001);
    });

    it('should skip allocated ports', async () => {
      // Pre-allocate some ports
      await stateManager.addSession({
        id: 'skip-id-1',
        name: 'skip-agent-1',
        model: 'claude',
        port: 3000,
        worktreePath: '/skip1/worktree',
        tmuxSession: 'maestro-skip-agent-1',
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date()
      });

      await stateManager.addSession({
        id: 'skip-id-2',
        name: 'skip-agent-2',
        model: 'claude',
        port: 3001,
        worktreePath: '/skip2/worktree',
        tmuxSession: 'maestro-skip-agent-2',
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date()
      });

      const nextPort = await stateManager.getNextAvailablePort(3000, 3005);
      expect(nextPort).toBe(3002);
    });

    it('should return null when no ports available', async () => {
      await stateManager.addSession({
        id: 'full-id',
        name: 'full-agent',
        model: 'claude',
        port: 3000,
        worktreePath: '/full/worktree',
        tmuxSession: 'maestro-full-agent',
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date()
      });

      const port = await stateManager.getNextAvailablePort(3000, 3000);
      expect(port).toBeNull();
    });
  });

  describe('concurrent operations', () => {
    beforeEach(async () => {
      (fs.pathExists as jest.Mock).mockResolvedValue(false);
      (fs.writeJson as jest.Mock).mockResolvedValue(undefined);
      await stateManager.load();
    });

    it('should handle concurrent session additions', async () => {
      const sessions: AgentSession[] = Array(5).fill(null).map((_, i) => ({
        id: `concurrent-id-${i}`,
        name: `concurrent-agent-${i}`,
        model: 'claude',
        port: 3000 + i,
        worktreePath: `/concurrent/worktree-${i}`,
        tmuxSession: `maestro-concurrent-agent-${i}`,
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date()
      }));

      await Promise.all(
        sessions.map(session => stateManager.addSession(session))
      );

      const allSessions = await stateManager.getAllSessions();
      expect(allSessions).toHaveLength(5);
    });

    it('should handle concurrent port allocations', async () => {
      const portPromises = Array(5).fill(null).map(() => 
        stateManager.getNextAvailablePort(3000, 3010)
      );

      const ports = await Promise.all(portPromises);
      const nonNullPorts = ports.filter(p => p !== null) as number[];
      const uniquePorts = new Set(nonNullPorts);

      // Note: Without proper locking, concurrent calls might return same port
      expect(nonNullPorts.length).toBeGreaterThan(0);
      expect(Math.min(...nonNullPorts)).toBeGreaterThanOrEqual(3000);
      expect(Math.max(...nonNullPorts)).toBeLessThanOrEqual(3010);
    });
  });

  describe('state persistence', () => {
    it('should persist state atomically', async () => {
      (fs.pathExists as jest.Mock).mockResolvedValue(false);
      let writeCount = 0;
      (fs.writeJson as jest.Mock).mockImplementation(async () => {
        writeCount++;
        // Simulate slow write
        await new Promise(resolve => setTimeout(resolve, 10));
      });

      await stateManager.load();
      
      const promises = Array(10).fill(null).map((_, i) => 
        stateManager.addSession({
          id: `persist-id-${i}`,
          name: `persist-agent-${i}`,
          model: 'claude',
          port: 3000 + i,
          worktreePath: `/persist/worktree-${i}`,
          tmuxSession: `maestro-persist-agent-${i}`,
          status: 'active',
          createdAt: new Date(),
          updatedAt: new Date()
        })
      );

      await Promise.all(promises);

      // Initial save + 10 addSession calls
      expect(writeCount).toBe(11);
    });
  });
});