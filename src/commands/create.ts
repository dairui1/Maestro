import { Command } from 'commander';
import { StateManager } from '../lib/state/state-manager';
import { ConfigManager } from '../lib/config/config-manager';
import { TmuxManager } from '../lib/tmux/tmux-manager';
import { WorktreeManager } from '../lib/git/worktree-manager';
import chalk from 'chalk';
import * as inquirer from 'inquirer';
import { v4 as uuidv4 } from 'uuid';
import * as path from 'path';

interface CreateOptions {
  description?: string;
  port?: number;
  attach?: boolean;
  branch?: string;
  nodev?: boolean;
}

export function createCreateCommand(): Command {
  const command = new Command('create');
  
  command
    .description('Create a workspace (Git worktree + tmux session) for a specific task')
    .argument('[name]', 'Workspace name')
    .option('-d, --description <desc>', 'Task description')
    .option('-p, --port <port>', 'Specific port for dev server', parseInt)
    .option('--attach', 'Attach to tmux session after creation', false)
    .option('-b, --branch <branch>', 'Base branch to create worktree from')
    .option('--no-dev', 'Skip creating development server window')
    .action(async (name: string | undefined, options: CreateOptions) => {
      try {
        // Initialize managers
        const stateManager = new StateManager();
        const configManager = new ConfigManager();
        const tmuxManager = new TmuxManager();
        const worktreeManager = new WorktreeManager();
        
        // Load configuration
        const config = await configManager.load();
        
        // Interactive mode if name not provided
        let workspaceName = name;
        let description = options.description;
        
        if (!workspaceName) {
          const answers = await inquirer.prompt([
            {
              type: 'input',
              name: 'name',
              message: 'Workspace name:',
              validate: async (input) => {
                if (!input || input.trim() === '') {
                  return 'Workspace name is required';
                }
                // Check if workspace already exists
                const sessions = await stateManager.getAllSessions();
                if (sessions.some((s: any) => s.name === input)) {
                  return `Workspace ${input} already exists`;
                }
                return true;
              }
            },
            {
              type: 'input',
              name: 'description',
              message: 'Task description (optional):',
              when: !description
            }
          ]);
          
          workspaceName = workspaceName || answers.name;
          description = description || answers.description;
        }
        
        // Validate workspace doesn't exist
        const sessions = await stateManager.getAllSessions();
        if (sessions.some((s: any) => s.name === workspaceName)) {
          console.error(chalk.red(`Workspace ${workspaceName} already exists`));
          process.exit(1);
        }
        
        console.log(chalk.blue(`Creating workspace: ${workspaceName}`));
        if (description) {
          console.log(chalk.gray(`Description: ${description}`));
        }
        
        // Create unique branch name
        const branchName = `maestro/${workspaceName}-${uuidv4().slice(0, 8)}`;
        
        // Create worktree path
        const worktreePath = path.join(process.cwd(), '.maestro-worktrees', workspaceName!);
        
        // Create worktree
        console.log(chalk.gray('Creating Git worktree...'));
        await worktreeManager.createWorktree(
          branchName,
          worktreePath
        );
        
        // Create tmux session
        const tmuxSession = `maestro-${workspaceName}`;
        console.log(chalk.gray('Creating tmux session...'));
        await tmuxManager.createSession(tmuxSession);
        
        // Rename first window to 'workspace'
        await tmuxManager.renameWindow(tmuxSession, 0, 'workspace');
        
        // Allocate port and create dev window if needed
        let port: number | undefined;
        if (!options.nodev) {
          // Allocate port
          if (options.port) {
            port = options.port;
          } else {
            const availablePort = await stateManager.getNextAvailablePort(
              config.portRange.start,
              config.portRange.end
            );
            if (!availablePort) {
              throw new Error('No available ports');
            }
            port = availablePort;
          }
          
          // Create dev window
          await tmuxManager.createWindow(tmuxSession, 'dev');
          
          // Start dev server with port
          const devCommand = config.devCommand.replace('$PORT', port.toString());
          await tmuxManager.sendKeys(tmuxSession, 1, devCommand);
        }
        
        // Save workspace to state
        await stateManager.addSession({
          id: uuidv4(),
          name: workspaceName!,
          tmuxSession,
          worktreePath,
          port: port || 0,
          createdAt: new Date(),
          updatedAt: new Date(),
          model: 'none', // No AI model for workspaces
          status: 'active',
          prompt: description,
        });
        
        console.log(chalk.green(`✓ Created workspace ${workspaceName}`));
        console.log(chalk.gray(`  Branch: ${branchName}`));
        console.log(chalk.gray(`  Worktree: ${worktreePath}`));
        console.log(chalk.gray(`  Session: ${tmuxSession}`));
        if (port) {
          console.log(chalk.gray(`  Dev port: ${port}`));
        }
        
        // Show how to use the workspace
        console.log(chalk.gray('\nTo use this workspace:'));
        console.log(chalk.gray(`  Attach: tmux attach -t ${tmuxSession}`));
        console.log(chalk.gray(`  Run commands: maestro run "command" -w ${workspaceName}`));
        console.log(chalk.gray(`  Add AI agent: maestro prompt -a "claude:1" -t "${description || 'task'}" --workspace ${workspaceName}`));
        
        // Attach to session if requested
        if (options.attach) {
          console.log(chalk.gray(`\nAttaching to workspace...`));
          try {
            await tmuxManager.switchToSession(tmuxSession);
          } catch (error) {
            console.log(chalk.yellow(`Could not attach to tmux session. Use "tmux attach -t ${tmuxSession}" to attach manually.`));
          }
        }
      } catch (error) {
        console.error(chalk.red(`Failed to create workspace: ${error}`));
        process.exit(1);
      }
    });
  
  return command;
}