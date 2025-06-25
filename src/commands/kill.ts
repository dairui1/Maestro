import { Command } from 'commander';
import { AgentManager } from '../lib/agent/agent-manager';
import { StateManager } from '../lib/state/state-manager';
import { ConfigManager } from '../lib/config/config-manager';
import { TmuxManager } from '../lib/tmux/tmux-manager';
import { WorktreeManager } from '../lib/git/worktree-manager';
import chalk from 'chalk';

interface KillOptions {
  all?: boolean;
}

export function createKillCommand(): Command {
  const command = new Command('kill');
  
  command
    .description('Terminate agent sessions')
    .argument('[agent-name]', 'Name of the agent to kill')
    .option('--all', 'Kill all active agents', false)
    .action(async (agentName: string | undefined, options: KillOptions) => {
      try {
        // Initialize managers
        const stateManager = new StateManager();
        const configManager = new ConfigManager();
        const tmuxManager = new TmuxManager();
        const worktreeManager = new WorktreeManager();
        
        const config = await configManager.load();
        const agentManager = new AgentManager(stateManager, tmuxManager, worktreeManager, config);
        
        if (options.all) {
          console.log(chalk.yellow('Killing all agents...'));
          
          const sessions = await stateManager.getAllSessions();
          if (sessions.length === 0) {
            console.log(chalk.yellow('No active agents to kill'));
            return;
          }
          
          await agentManager.killAllAgents();
          console.log(chalk.green(`✓ Killed ${sessions.length} agent(s)`));
          
        } else if (agentName) {
          // Find agent by name
          const sessions = await stateManager.getAllSessions();
          const session = sessions.find(s => s.name === agentName);
          
          if (!session) {
            console.error(chalk.red(`Agent "${agentName}" not found`));
            console.log(chalk.gray('\nActive agents:'));
            sessions.forEach(s => console.log(chalk.gray(`  - ${s.name}`)));
            process.exit(1);
          }
          
          console.log(chalk.yellow(`Killing agent "${agentName}"...`));
          await agentManager.killAgent(session.id);
          console.log(chalk.green(`✓ Killed agent "${agentName}"`));
          
        } else {
          console.error(chalk.red('Please specify an agent name or use --all'));
          process.exit(1);
        }
        
      } catch (error) {
        console.error(chalk.red(`Error: ${error}`));
        process.exit(1);
      }
    });
  
  return command;
}