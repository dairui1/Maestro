import { Command } from 'commander';
import chalk from 'chalk';
import { StateManager } from '../lib/state/state-manager';
import { TmuxManager } from '../lib/tmux/tmux-manager';
import { AgentNotFoundError } from '../lib/errors';

export function createResumeCommand(): Command {
  const command = new Command('resume');
  
  command
    .description('Resume a paused agent session')
    .argument('<agent>', 'Name of the agent to resume')
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
          console.log(chalk.red(`Session ${sessionName} does not exist`));
          console.log(chalk.gray('The session may have been killed. Use `maestro prompt` to recreate it.'));
          return;
        }
        
        // Update session status
        await stateManager.updateSession(session.id, {
          status: 'active'
        });
        
        // Attach to the session
        console.log(chalk.green(`✓ Resumed agent ${agentName}`));
        console.log(chalk.gray(`  Attaching to tmux session: ${sessionName}`));
        
        // Attach to tmux session
        await tmuxManager.attachSession(sessionName);
        
      } catch (error) {
        if (error instanceof AgentNotFoundError) {
          console.error(chalk.red(`Agent '${agentName}' not found`));
          console.log(chalk.gray('Run `maestro ls` to see available agents'));
        } else {
          console.error(chalk.red(`Failed to resume agent: ${error}`));
        }
        process.exit(1);
      }
    });
  
  return command;
}