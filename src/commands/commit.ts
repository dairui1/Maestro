import { Command } from 'commander';
import chalk from 'chalk';
import { StateManager } from '../lib/state/state-manager';
import { WorktreeManager } from '../lib/git/worktree-manager';
import { AgentNotFoundError } from '../lib/errors';
import execa = require('execa');
import * as path from 'path';

export function createCommitCommand(): Command {
  const command = new Command('commit');
  
  command
    .description('Commit and push changes for an agent to GitHub')
    .argument('<agent>', 'Name of the agent')
    .option('-m, --message <message>', 'Commit message')
    .option('--no-push', 'Only commit, do not push to remote')
    .action(async (agentName: string, options: { message?: string; push: boolean }) => {
      try {
        const stateManager = new StateManager();
        const worktreeManager = new WorktreeManager();
        
        // Load current state
        const state = await stateManager.load();
        
        // Find the session
        const session = state.sessions.find(s => s.name === agentName);
        if (!session) {
          throw new AgentNotFoundError(agentName);
        }
        
        const worktreePath = session.worktreePath;
        
        // Check for uncommitted changes
        console.log(chalk.gray('Checking for changes...'));
        const status = await execa('git', ['status', '--porcelain'], { cwd: worktreePath });
        
        if (!status.stdout) {
          console.log(chalk.yellow('No changes to commit'));
          return;
        }
        
        // Show changes
        console.log(chalk.cyan('\nChanges to be committed:'));
        const diff = await execa('git', ['diff', '--stat'], { cwd: worktreePath });
        console.log(diff.stdout);
        
        // Stage all changes
        console.log(chalk.gray('\nStaging changes...'));
        await execa('git', ['add', '-A'], { cwd: worktreePath });
        
        // Commit changes
        const commitMessage = options.message || `Update from agent ${agentName}`;
        console.log(chalk.gray(`\nCommitting with message: "${commitMessage}"...`));
        await execa('git', ['commit', '-m', commitMessage], { cwd: worktreePath });
        console.log(chalk.green('✓ Changes committed'));
        
        // Push to remote if requested
        if (options.push) {
          console.log(chalk.gray('\nPushing to remote...'));
          const branchName = path.basename(worktreePath);
          
          try {
            // Try to push, setting upstream if needed
            await execa('git', ['push', '-u', 'origin', branchName], { cwd: worktreePath });
            console.log(chalk.green('✓ Pushed to remote'));
            
            // Get remote URL to construct PR link
            const remoteUrl = await execa('git', ['remote', 'get-url', 'origin'], { cwd: worktreePath });
            const repoUrl = remoteUrl.stdout.trim()
              .replace(/\.git$/, '')
              .replace(/^git@github\.com:/, 'https://github.com/');
            
            console.log(chalk.gray(`\nCreate a pull request at:`));
            console.log(chalk.blue(`${repoUrl}/compare/${branchName}?expand=1`));
          } catch (error) {
            console.error(chalk.red('Failed to push to remote:'), (error as Error).message);
            console.log(chalk.yellow('You may need to manually push the branch'));
          }
        }
        
      } catch (error) {
        if (error instanceof AgentNotFoundError) {
          console.error(chalk.red(`Agent '${agentName}' not found`));
          console.log(chalk.gray('Run `maestro ls` to see available agents'));
        } else {
          console.error(chalk.red(`Failed to commit: ${error}`));
        }
        process.exit(1);
      }
    });
  
  return command;
}