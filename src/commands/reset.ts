import { Command } from 'commander';
import { StateManager } from '../lib/state/state-manager';
import { ConfigManager } from '../lib/config/config-manager';
import { TmuxManager } from '../lib/tmux/tmux-manager';
import { WorktreeManager } from '../lib/git/worktree-manager';
import { AgentManager } from '../lib/agent/agent-manager';
import * as fs from 'fs-extra';
import * as path from 'path';
import chalk from 'chalk';
import * as readline from 'readline';

async function askConfirmation(message: string): Promise<boolean> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(message + ' (y/N): ', (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes');
    });
  });
}

export function createResetCommand(): Command {
  const command = new Command('reset');
  
  command
    .description('Reset Uzi completely - removes all data and configuration')
    .option('--force', 'Skip confirmation prompt', false)
    .action(async (options: { force?: boolean }) => {
      try {
        if (!options.force) {
          console.log(chalk.yellow('⚠️  WARNING: This will:'));
          console.log(chalk.yellow('  - Kill all active agent sessions'));
          console.log(chalk.yellow('  - Remove all git worktrees'));
          console.log(chalk.yellow('  - Delete all Uzi state and configuration'));
          console.log(chalk.yellow('  - This action cannot be undone!'));
          console.log();
          
          const confirmed = await askConfirmation('Are you sure you want to reset Uzi?');
          if (!confirmed) {
            console.log(chalk.gray('Reset cancelled'));
            return;
          }
        }
        
        console.log(chalk.blue('Resetting Uzi...'));
        
        // Initialize managers
        const stateManager = new StateManager();
        const configManager = new ConfigManager();
        const tmuxManager = new TmuxManager();
        const worktreeManager = new WorktreeManager();
        
        const config = await configManager.load();
        const agentManager = new AgentManager(stateManager, tmuxManager, worktreeManager, config);
        
        // Kill all agents
        console.log(chalk.gray('Killing all agents...'));
        try {
          await agentManager.killAllAgents();
        } catch (error) {
          console.error(chalk.yellow(`Warning: Failed to kill some agents: ${error}`));
        }
        
        // Remove worktrees directory
        const worktreesDir = path.join(process.cwd(), '.uzi', 'worktrees');
        if (await fs.pathExists(worktreesDir)) {
          console.log(chalk.gray('Removing worktrees directory...'));
          await fs.remove(worktreesDir);
        }
        
        // Reset state
        console.log(chalk.gray('Resetting state...'));
        await stateManager.reset();
        
        // Remove .uzi directory
        const uziDir = path.join(process.cwd(), '.uzi');
        if (await fs.pathExists(uziDir)) {
          console.log(chalk.gray('Removing .uzi directory...'));
          await fs.remove(uziDir);
        }
        
        console.log(chalk.green('✓ Uzi has been reset successfully'));
        
      } catch (error) {
        console.error(chalk.red(`Error: ${error}`));
        process.exit(1);
      }
    });
  
  return command;
}