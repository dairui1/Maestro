import { Command } from 'commander';
import { AgentManager } from '../lib/agent/agent-manager';
import { StateManager } from '../lib/state/state-manager';
import { ConfigManager } from '../lib/config/config-manager';
import { TmuxManager } from '../lib/tmux/tmux-manager';
import { WorktreeManager } from '../lib/git/worktree-manager';
import chalk from 'chalk';

interface PromptOptions {
  agents: string;
  task: string;
  auto?: boolean;
}

export function createPromptCommand(): Command {
  const command = new Command('prompt');
  
  command
    .description('Create new agent sessions with specified AI models')
    .requiredOption('-a, --agents <agents>', 'Agent specification (e.g., claude:2,codex:1)')
    .requiredOption('-t, --task <task>', 'Task description for agents')
    .option('--auto', 'Enable auto-confirm mode', false)
    .action(async (options: PromptOptions) => {
      try {
        // Initialize managers
        const stateManager = new StateManager();
        const configManager = new ConfigManager();
        const tmuxManager = new TmuxManager();
        const worktreeManager = new WorktreeManager();
        
        // Load configuration
        const config = await configManager.load();
        if (options.auto) {
          config.autoConfirm = true;
        }
        
        const agentManager = new AgentManager(stateManager, tmuxManager, worktreeManager, config);
        
        // Parse agent specification
        const agentSpecs = parseAgentSpec(options.agents);
        
        console.log(chalk.blue('Creating agent sessions...'));
        
        // Create agents
        const createdAgents = [];
        for (const spec of agentSpecs) {
          for (let i = 0; i < spec.count; i++) {
            const name = `${spec.model}-${i + 1}`;
            console.log(chalk.gray(`Creating agent: ${name}`));
            
            try {
              const agent = await agentManager.createAgent(name, spec.model, options.task);
              createdAgents.push(agent);
              console.log(chalk.green(`✓ Created agent ${name} on port ${agent.port}`));
            } catch (error) {
              console.error(chalk.red(`✗ Failed to create agent ${name}: ${error}`));
            }
          }
        }
        
        if (createdAgents.length === 0) {
          console.log(chalk.yellow('No agents were created'));
          return;
        }
        
        console.log(chalk.green(`\nSuccessfully created ${createdAgents.length} agent(s)`));
        console.log(chalk.gray('\nAgents are running in tmux sessions. Use "uzi ls" to view status.'));
        
        // If there's at least one agent, switch to its tmux session
        if (createdAgents.length > 0) {
          const firstAgent = createdAgents[0];
          console.log(chalk.gray(`\nSwitching to ${firstAgent.name} session...`));
          try {
            await tmuxManager.switchToSession(firstAgent.tmuxSession);
          } catch (error) {
            console.log(chalk.yellow(`Could not switch to tmux session. Use "tmux attach -t ${firstAgent.tmuxSession}" to attach manually.`));
          }
        }
      } catch (error) {
        console.error(chalk.red(`Error: ${error}`));
        process.exit(1);
      }
    });
  
  return command;
}

function parseAgentSpec(spec: string): Array<{ model: string; count: number }> {
  const parts = spec.split(',');
  const agents: Array<{ model: string; count: number }> = [];
  
  for (const part of parts) {
    const [model, countStr] = part.trim().split(':');
    const count = countStr ? parseInt(countStr, 10) : 1;
    
    if (!model || isNaN(count) || count < 1) {
      throw new Error(`Invalid agent specification: ${part}`);
    }
    
    agents.push({ model, count });
  }
  
  return agents;
}