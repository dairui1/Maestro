import { Command } from 'commander';
import { AgentManager } from '../lib/agent/agent-manager';
import { StateManager } from '../lib/state/state-manager';
import { ConfigManager } from '../lib/config/config-manager';
import { TmuxManager } from '../lib/tmux/tmux-manager';
import { WorktreeManager } from '../lib/git/worktree-manager';
import chalk from 'chalk';

export function createBroadcastCommand(): Command {
  const command = new Command('broadcast');
  
  command
    .description('Send a message to all active agent sessions')
    .argument('<message>', 'Message to broadcast')
    .action(async (message: string) => {
      try {
        // Initialize managers
        const stateManager = new StateManager();
        const configManager = new ConfigManager();
        const tmuxManager = new TmuxManager();
        const worktreeManager = new WorktreeManager();
        
        const config = await configManager.load();
        const agentManager = new AgentManager(stateManager, tmuxManager, worktreeManager, config);
        
        const sessions = await stateManager.getAllSessions();
        
        if (sessions.length === 0) {
          console.log(chalk.yellow('No active agents to broadcast to'));
          return;
        }
        
        console.log(chalk.blue(`Broadcasting to ${sessions.length} agent(s): "${message}"`));
        
        await agentManager.broadcastMessage(message);
        
        console.log(chalk.green(`✓ Message broadcast to ${sessions.length} agent(s)`));
        
      } catch (error) {
        console.error(chalk.red(`Error: ${error}`));
        process.exit(1);
      }
    });
  
  return command;
}