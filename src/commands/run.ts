import { Command } from 'commander';
import { AgentManager } from '../lib/agent/agent-manager';
import { StateManager } from '../lib/state/state-manager';
import { ConfigManager } from '../lib/config/config-manager';
import { TmuxManager } from '../lib/tmux/tmux-manager';
import { WorktreeManager } from '../lib/git/worktree-manager';
import chalk from 'chalk';

export function createRunCommand(): Command {
  const command = new Command('run');
  
  command
    .description('Execute commands across all active agents in parallel')
    .argument('<command>', 'Command to execute')
    .action(async (commandToRun: string) => {
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
          console.log(chalk.yellow('No active agents to run command on'));
          return;
        }
        
        console.log(chalk.blue(`Running command on ${sessions.length} agent(s): ${commandToRun}`));
        console.log();
        
        const results = await agentManager.runCommandOnAllAgents(commandToRun);
        
        // Display results
        for (const [agentName, output] of results.entries()) {
          console.log(chalk.bold.cyan(`=== ${agentName} ===`));
          
          if (output.startsWith('Error:')) {
            console.log(chalk.red(output));
          } else {
            console.log(output || chalk.gray('(no output)'));
          }
          
          console.log();
        }
        
        console.log(chalk.green(`✓ Command executed on ${results.size} agent(s)`));
        
      } catch (error) {
        console.error(chalk.red(`Error: ${error}`));
        process.exit(1);
      }
    });
  
  return command;
}