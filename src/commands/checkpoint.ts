import { Command } from 'commander';
import { AgentManager } from '../lib/agent/agent-manager';
import { StateManager } from '../lib/state/state-manager';
import { ConfigManager } from '../lib/config/config-manager';
import { TmuxManager } from '../lib/tmux/tmux-manager';
import { WorktreeManager } from '../lib/git/worktree-manager';
import chalk from 'chalk';

export function createCheckpointCommand(): Command {
  const command = new Command('checkpoint');
  
  command
    .description('Commit and rebase agent changes into the main branch')
    .argument('[agent-name]', 'Name of the agent to checkpoint (or checkpoint all if not specified)')
    .option('-b, --branch <branch>', 'Target branch for rebase', 'main')
    .action(async (agentName: string | undefined, options: { branch: string }) => {
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
          console.log(chalk.yellow('No active agents to checkpoint'));
          return;
        }
        
        let targetsessions = sessions;
        
        if (agentName) {
          const session = sessions.find(s => s.name === agentName);
          if (!session) {
            console.error(chalk.red(`Agent "${agentName}" not found`));
            console.log(chalk.gray('\nActive agents:'));
            sessions.forEach(s => console.log(chalk.gray(`  - ${s.name}`)));
            process.exit(1);
          }
          targetsessions = [session];
        }
        
        console.log(chalk.blue(`Checkpointing ${targetsessions.length} agent(s)...`));
        
        let successCount = 0;
        let errorCount = 0;
        
        for (const session of targetsessions) {
          try {
            console.log(chalk.gray(`Checkpointing ${session.name}...`));
            await agentManager.checkpointAgent(session.id, options.branch);
            console.log(chalk.green(`✓ Checkpointed ${session.name}`));
            successCount++;
          } catch (error) {
            console.error(chalk.red(`✗ Failed to checkpoint ${session.name}: ${error}`));
            errorCount++;
          }
        }
        
        console.log();
        if (successCount > 0) {
          console.log(chalk.green(`✓ Successfully checkpointed ${successCount} agent(s)`));
        }
        if (errorCount > 0) {
          console.log(chalk.red(`✗ Failed to checkpoint ${errorCount} agent(s)`));
        }
        
      } catch (error) {
        console.error(chalk.red(`Error: ${error}`));
        process.exit(1);
      }
    });
  
  return command;
}