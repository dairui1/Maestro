import execa = require('execa');
type ExecaError = execa.ExecaError;

export class TmuxManager {
  async createSession(sessionName: string, command?: string): Promise<void> {
    try {
      const args = ['new-session', '-d', '-s', sessionName];
      if (command) {
        args.push('-c', process.cwd(), command);
      } else {
        // Create with a default shell
        args.push('-c', process.cwd());
      }
      await execa('tmux', args);
    } catch (error) {
      throw new Error(`Failed to create tmux session: ${(error as ExecaError).message}`);
    }
  }

  async sessionExists(sessionName: string): Promise<boolean> {
    try {
      await execa('tmux', ['has-session', '-t', sessionName]);
      return true;
    } catch {
      return false;
    }
  }

  async killSession(sessionName: string): Promise<void> {
    try {
      await execa('tmux', ['kill-session', '-t', sessionName]);
    } catch (error) {
      if ((error as ExecaError).exitCode !== 1) {
        throw new Error(`Failed to kill tmux session: ${(error as ExecaError).message}`);
      }
    }
  }

  async sendKeys(sessionName: string, windowIndex: number, keys: string): Promise<void> {
    try {
      await execa('tmux', [
        'send-keys',
        '-t',
        `${sessionName}:${windowIndex}`,
        keys,
        'Enter'
      ]);
    } catch (error) {
      throw new Error(`Failed to send keys to tmux: ${(error as ExecaError).message}`);
    }
  }

  async createWindow(sessionName: string, windowName: string, command?: string): Promise<void> {
    try {
      const args = ['new-window', '-t', sessionName, '-n', windowName];
      if (command) {
        args.push(command);
      }
      await execa('tmux', args);
    } catch (error) {
      throw new Error(`Failed to create tmux window: ${(error as ExecaError).message}`);
    }
  }

  async capturePane(sessionName: string, windowIndex: number): Promise<string> {
    try {
      const result = await execa('tmux', [
        'capture-pane',
        '-t',
        `${sessionName}:${windowIndex}`,
        '-p'
      ]);
      return result.stdout;
    } catch (error) {
      throw new Error(`Failed to capture tmux pane: ${(error as ExecaError).message}`);
    }
  }

  async listSessions(): Promise<string[]> {
    try {
      const result = await execa('tmux', ['list-sessions', '-F', '#{session_name}']);
      return result.stdout.split('\n').filter(Boolean);
    } catch (error) {
      if ((error as ExecaError).exitCode === 1) {
        return [];
      }
      throw new Error(`Failed to list tmux sessions: ${(error as ExecaError).message}`);
    }
  }

  async switchToSession(sessionName: string): Promise<void> {
    try {
      await execa('tmux', ['switch-client', '-t', sessionName]);
    } catch (error) {
      // If we're not in tmux, try to attach instead
      const stderr = (error as ExecaError).stderr || '';
      if (typeof stderr === 'string' && stderr.includes('no current client')) {
        await execa('tmux', ['attach-session', '-t', sessionName]);
      } else {
        throw new Error(`Failed to switch to tmux session: ${(error as ExecaError).message}`);
      }
    }
  }

  async renameWindow(sessionName: string, windowIndex: number, newName: string): Promise<void> {
    try {
      await execa('tmux', [
        'rename-window',
        '-t',
        `${sessionName}:${windowIndex}`,
        newName
      ]);
    } catch (error) {
      throw new Error(`Failed to rename tmux window: ${(error as ExecaError).message}`);
    }
  }

  async getWindowList(sessionName: string): Promise<string[]> {
    try {
      const result = await execa('tmux', [
        'list-windows',
        '-t',
        sessionName,
        '-F',
        '#{window_index}:#{window_name}'
      ]);
      return result.stdout.split('\n').filter(Boolean);
    } catch (error) {
      throw new Error(`Failed to list tmux windows: ${(error as ExecaError).message}`);
    }
  }
}