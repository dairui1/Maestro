import execa = require('execa');
type ExecaError = execa.ExecaError;
import * as path from 'path';
import * as fs from 'fs-extra';

export class WorktreeManager {
  private baseDir: string;

  constructor(baseDir?: string) {
    this.baseDir = baseDir || process.cwd();
  }

  async createWorktree(branchName: string, worktreePath: string): Promise<void> {
    try {
      // First check if branch exists
      const branchExists = await this.branchExists(branchName);
      
      if (branchExists) {
        // If branch exists, create worktree from existing branch
        await execa('git', ['worktree', 'add', worktreePath, branchName], {
          cwd: this.baseDir
        });
      } else {
        // If branch doesn't exist, create new branch with worktree
        await execa('git', ['worktree', 'add', '-b', branchName, worktreePath], {
          cwd: this.baseDir
        });
      }
    } catch (error) {
      throw new Error(`Failed to create worktree: ${(error as ExecaError).message}`);
    }
  }

  async removeWorktree(worktreePath: string, force: boolean = false): Promise<void> {
    try {
      const args = ['worktree', 'remove', worktreePath];
      if (force) {
        args.push('--force');
      }
      await execa('git', args, { cwd: this.baseDir });
    } catch (error) {
      throw new Error(`Failed to remove worktree: ${(error as ExecaError).message}`);
    }
  }

  async listWorktrees(): Promise<Array<{ path: string; branch: string; commit: string }>> {
    try {
      const result = await execa('git', ['worktree', 'list', '--porcelain'], {
        cwd: this.baseDir
      });

      const worktrees: Array<{ path: string; branch: string; commit: string }> = [];
      const lines = result.stdout.split('\n');
      
      let currentWorktree: any = {};
      for (const line of lines) {
        if (line.startsWith('worktree ')) {
          currentWorktree.path = line.substring(9);
        } else if (line.startsWith('HEAD ')) {
          currentWorktree.commit = line.substring(5);
        } else if (line.startsWith('branch ')) {
          currentWorktree.branch = line.substring(7);
          worktrees.push({ ...currentWorktree });
          currentWorktree = {};
        } else if (line === '' && currentWorktree.path) {
          // Detached HEAD case
          worktrees.push({ ...currentWorktree, branch: 'detached' });
          currentWorktree = {};
        }
      }

      return worktrees;
    } catch (error) {
      throw new Error(`Failed to list worktrees: ${(error as ExecaError).message}`);
    }
  }

  async pruneWorktrees(): Promise<void> {
    try {
      await execa('git', ['worktree', 'prune'], { cwd: this.baseDir });
    } catch (error) {
      throw new Error(`Failed to prune worktrees: ${(error as ExecaError).message}`);
    }
  }

  private async branchExists(branchName: string): Promise<boolean> {
    try {
      await execa('git', ['rev-parse', '--verify', branchName], {
        cwd: this.baseDir
      });
      return true;
    } catch {
      return false;
    }
  }

  async getCurrentBranch(): Promise<string> {
    try {
      const result = await execa('git', ['branch', '--show-current'], {
        cwd: this.baseDir
      });
      return result.stdout.trim();
    } catch (error) {
      throw new Error(`Failed to get current branch: ${(error as ExecaError).message}`);
    }
  }

  async checkoutBranch(branchName: string, create: boolean = false): Promise<void> {
    try {
      const args = ['checkout'];
      if (create) {
        args.push('-b');
      }
      args.push(branchName);
      await execa('git', args, { cwd: this.baseDir });
    } catch (error) {
      throw new Error(`Failed to checkout branch: ${(error as ExecaError).message}`);
    }
  }

  async commitChanges(message: string, worktreePath?: string): Promise<void> {
    try {
      const cwd = worktreePath || this.baseDir;
      
      // Add all changes
      await execa('git', ['add', '.'], { cwd });
      
      // Commit
      await execa('git', ['commit', '-m', message], { cwd });
    } catch (error) {
      const stderr = (error as ExecaError).stderr || '';
      if (typeof stderr === 'string' && stderr.includes('nothing to commit')) {
        throw new Error('No changes to commit');
      }
      throw new Error(`Failed to commit changes: ${(error as ExecaError).message}`);
    }
  }

  async rebase(targetBranch: string, worktreePath?: string): Promise<void> {
    try {
      const cwd = worktreePath || this.baseDir;
      await execa('git', ['rebase', targetBranch], { cwd });
    } catch (error) {
      throw new Error(`Failed to rebase: ${(error as ExecaError).message}`);
    }
  }

  async deleteBranch(branchName: string, force: boolean = false): Promise<void> {
    try {
      const args = ['branch', force ? '-D' : '-d', branchName];
      await execa('git', args, { cwd: this.baseDir });
    } catch (error) {
      throw new Error(`Failed to delete branch: ${(error as ExecaError).message}`);
    }
  }
}