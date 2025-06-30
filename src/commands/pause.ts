import { Command } from 'commander';
import chalk from 'chalk';
import { StateManager } from '../lib/state/state-manager';
import { TmuxManager } from '../lib/tmux/tmux-manager';
import { AgentNotFoundError } from '../lib/errors';

export function createPauseCommand(): Command {
  const command = new Command('pause');
  
  command
    .description('Pause an agent session (detach from tmux)')
    .argument('<agent>', 'Name of the agent to pause')
    .action(async (agentName: string) => {
      try {
        const stateManager = new StateManager();
        const tmuxManager = new TmuxManager();
        
        // Load current state
        const state = await stateManager.load();
        
        // Find the session
        const session = state.sessions.find(s => s.name === agentName);
        if (!session) {
          throw new AgentNotFoundError(agentName);
        }
        
        // Check if tmux session exists
        const sessionName = `maestro-${agentName}`;
        const exists = await tmuxManager.sessionExists(sessionName);
        
        if (!exists) {
          console.log(chalk.yellow(`Session ${sessionName} is not running`));
          return;
        }
        
        // Update session status
        await stateManager.updateSession(session.id, {
          status: 'paused'
        });
        
        console.log(chalk.green(`✓ Paused agent ${agentName}`));
        console.log(chalk.gray(`  Session preserved in tmux: ${sessionName}`));
        console.log(chalk.gray(`  Use 'maestro resume ${agentName}' to continue`));
        
      } catch (error) {
        if (error instanceof AgentNotFoundError) {
          console.error(chalk.red(`Agent '${agentName}' not found`));
          console.log(chalk.gray('Run `maestro ls` to see available agents'));
        } else {
          console.error(chalk.red(`Failed to pause agent: ${error}`));
        }
        process.exit(1);
      }
    });
  
  return command;
}