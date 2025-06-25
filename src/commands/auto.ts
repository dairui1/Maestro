import { Command } from 'commander';
import { StateManager } from '../lib/state/state-manager';
import { TmuxManager } from '../lib/tmux/tmux-manager';
import chalk from 'chalk';

interface AutoOptions {
  interval?: number;
}

export function createAutoCommand(): Command {
  const command = new Command('auto');
  
  command
    .description('Run as a background process to automatically handle agent prompts')
    .option('-i, --interval <seconds>', 'Check interval in seconds', '5')
    .action(async (options: AutoOptions) => {
      try {
        const interval = parseInt(options.interval?.toString() || '5', 10) * 1000;
        
        if (isNaN(interval) || interval < 1000) {
          console.error(chalk.red('Invalid interval. Must be at least 1 second.'));
          process.exit(1);
        }
        
        console.log(chalk.blue('Starting auto mode...'));
        console.log(chalk.gray(`Checking every ${interval / 1000} seconds`));
        console.log(chalk.gray('Press Ctrl+C to stop'));
        
        const stateManager = new StateManager();
        const tmuxManager = new TmuxManager();
        
        // Main auto loop
        const checkAgents = async () => {
          try {
            const sessions = await stateManager.getAllSessions();
            
            for (const session of sessions) {
              try {
                // Capture the agent window pane content
                const paneContent = await tmuxManager.capturePane(session.tmuxSession, 1);
                
                // Look for common prompts that need confirmation
                const needsConfirmation = 
                  paneContent.includes('Continue?') ||
                  paneContent.includes('Proceed?') ||
                  paneContent.includes('[Y/n]') ||
                  paneContent.includes('[y/N]') ||
                  paneContent.includes('(y/n)');
                
                if (needsConfirmation) {
                  console.log(chalk.yellow(`Auto-confirming prompt for ${session.name}`));
                  await tmuxManager.sendKeys(session.tmuxSession, 1, 'y');
                }
                
                // Look for prompts that might need input
                const needsInput = 
                  paneContent.includes('Enter') && 
                  paneContent.includes(':') &&
                  paneContent.split('\n').pop()?.endsWith(':');
                
                if (needsInput) {
                  // For now, just press Enter for empty inputs
                  console.log(chalk.yellow(`Auto-responding to input prompt for ${session.name}`));
                  await tmuxManager.sendKeys(session.tmuxSession, 1, '');
                }
                
              } catch (error) {
                // Ignore errors for individual sessions
                console.error(chalk.gray(`Failed to check ${session.name}: ${error}`));
              }
            }
          } catch (error) {
            console.error(chalk.red(`Error in auto loop: ${error}`));
          }
        };
        
        // Run immediately
        await checkAgents();
        
        // Set up interval
        const intervalId = setInterval(checkAgents, interval);
        
        // Handle graceful shutdown
        process.on('SIGINT', () => {
          console.log(chalk.yellow('\nStopping auto mode...'));
          clearInterval(intervalId);
          process.exit(0);
        });
        
        // Keep process alive
        process.stdin.resume();
        
      } catch (error) {
        console.error(chalk.red(`Error: ${error}`));
        process.exit(1);
      }
    });
  
  return command;
}