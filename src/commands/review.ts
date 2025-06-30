import { Command } from 'commander';
import chalk from 'chalk';
import { StateManager } from '../lib/state/state-manager';
import { AgentNotFoundError } from '../lib/errors';
import execa = require('execa');
import inquirer from 'inquirer';
import * as path from 'path';

export function createReviewCommand(): Command {
  const command = new Command('review');
  
  command
    .description('Review changes made by an agent before applying them')
    .argument('<agent>', 'Name of the agent')
    .option('--apply', 'Apply selected changes after review')
    .action(async (agentName: string, options: { apply?: boolean }) => {
      try {
        const stateManager = new StateManager();
        
        // Load current state
        const state = await stateManager.load();
        
        // Find the session
        const session = state.sessions.find(s => s.name === agentName);
        if (!session) {
          throw new AgentNotFoundError(agentName);
        }
        
        const worktreePath = session.worktreePath;
        
        // Get list of modified files
        console.log(chalk.gray('Checking for changes...'));
        const status = await execa('git', ['status', '--porcelain'], { cwd: worktreePath });
        
        if (!status.stdout) {
          console.log(chalk.yellow('No changes to review'));
          return;
        }
        
        // Parse modified files
        const files = status.stdout.split('\n')
          .filter(line => line.trim())
          .map(line => {
            const parts = line.trim().split(/\s+/);
            const status = parts[0];
            const file = parts[1];
            return { status, file };
          });
        
        console.log(chalk.cyan(`\nFound ${files.length} changed files:`));
        files.forEach(({ status, file }) => {
          const statusLabel = status === 'M' ? 'modified' : 
                            status === 'A' ? 'added' : 
                            status === 'D' ? 'deleted' : 
                            status === '??' ? 'untracked' : status;
          console.log(`  ${chalk.yellow(statusLabel)} ${file}`);
        });
        
        // Show detailed diff for each file
        for (const { status, file } of files) {
          if (status === '??' || status === 'A') {
            // Show new file content
            console.log(chalk.cyan(`\n=== New file: ${file} ===`));
            try {
              const content = await execa('cat', [file], { cwd: worktreePath });
              console.log(content.stdout);
            } catch (error) {
              console.log(chalk.red('Could not read file'));
            }
          } else if (status === 'M') {
            // Show diff for modified files
            console.log(chalk.cyan(`\n=== Changes to: ${file} ===`));
            try {
              const diff = await execa('git', ['diff', file], { cwd: worktreePath });
              console.log(diff.stdout);
            } catch (error) {
              console.log(chalk.red('Could not get diff'));
            }
          }
        }
        
        // Ask if user wants to apply changes
        if (options.apply) {
          const { confirmApply } = await inquirer.prompt([
            {
              type: 'confirm',
              name: 'confirmApply',
              message: 'Do you want to apply these changes to the main branch?',
              default: false
            }
          ]);
          
          if (confirmApply) {
            // Get current branch
            const currentBranch = await execa('git', ['rev-parse', '--abbrev-ref', 'HEAD'], { cwd: worktreePath });
            const branchName = currentBranch.stdout.trim();
            
            // Stage all changes
            console.log(chalk.gray('\nStaging changes...'));
            await execa('git', ['add', '-A'], { cwd: worktreePath });
            
            // Commit changes
            console.log(chalk.gray('Committing changes...'));
            await execa('git', ['commit', '-m', `Review and apply changes from agent ${agentName}`], { cwd: worktreePath });
            
            // Switch to main branch
            console.log(chalk.gray('Switching to main branch...'));
            await execa('git', ['checkout', 'main'], { cwd: process.cwd() });
            
            // Cherry-pick the commit
            console.log(chalk.gray('Applying changes...'));
            const commitHash = await execa('git', ['rev-parse', 'HEAD'], { cwd: worktreePath });
            await execa('git', ['cherry-pick', commitHash.stdout.trim()], { cwd: process.cwd() });
            
            console.log(chalk.green('✓ Changes applied to main branch'));
          }
        } else {
          console.log(chalk.gray('\nUse --apply flag to apply these changes after review'));
        }
        
      } catch (error) {
        if (error instanceof AgentNotFoundError) {
          console.error(chalk.red(`Agent '${agentName}' not found`));
          console.log(chalk.gray('Run `maestro ls` to see available agents'));
        } else {
          console.error(chalk.red(`Failed to review changes: ${error}`));
        }
        process.exit(1);
      }
    });
  
  return command;
}