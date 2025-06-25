import { Command } from 'commander';
import { AgentManager } from '../lib/agent/agent-manager';
import { StateManager } from '../lib/state/state-manager';
import { ConfigManager } from '../lib/config/config-manager';
import { TmuxManager } from '../lib/tmux/tmux-manager';
import { WorktreeManager } from '../lib/git/worktree-manager';
import { AgentSession } from '../types';
import chalk from 'chalk';
import * as inquirer from 'inquirer';
import execa = require('execa');

interface MergeOptions {
  interactive?: boolean;
  strategy?: 'auto' | 'manual' | 'best';
  base?: string;
  squash?: boolean;
  compareOnly?: boolean;
}

export function createMergeCommand(): Command {
  const command = new Command('merge');
  
  command
    .description('Intelligently merge work from multiple agents')
    .argument('[agents...]', 'Agent names to merge (default: all agents)')
    .option('-i, --interactive', 'Interactive merge mode with conflict resolution', false)
    .option('-s, --strategy <strategy>', 'Merge strategy: auto, manual, or best', 'auto')
    .option('-b, --base <branch>', 'Base branch to merge into', 'main')
    .option('--squash', 'Squash commits from each agent', false)
    .option('-c, --compare-only', 'Only show differences without merging', false)
    .action(async (agentNames: string[] | undefined, options: MergeOptions) => {
      try {
        // Initialize managers
        const stateManager = new StateManager();
        const configManager = new ConfigManager();
        const tmuxManager = new TmuxManager();
        const worktreeManager = new WorktreeManager();
        
        const config = await configManager.load();
        const agentManager = new AgentManager(stateManager, tmuxManager, worktreeManager, config);
        
        // Get all sessions
        const allSessions = await stateManager.getAllSessions();
        if (allSessions.length === 0) {
          console.log(chalk.yellow('No active agents to merge'));
          return;
        }

        // Filter sessions based on agent names
        let sessions = allSessions;
        if (agentNames && agentNames.length > 0) {
          sessions = allSessions.filter(s => agentNames.includes(s.name));
          if (sessions.length === 0) {
            console.error(chalk.red('No matching agents found'));
            return;
          }
        }

        console.log(chalk.blue(`\n🔀 Preparing to merge ${sessions.length} agents into ${options.base}\n`));

        // Show agent status
        for (const session of sessions) {
          const changes = await getChangeSummary(session.worktreePath);
          console.log(chalk.gray(`📁 ${session.name} (${session.model}): ${changes}`));
        }

        if (options.compareOnly) {
          await compareAgentWork(sessions, worktreeManager);
          return;
        }

        // Determine merge strategy
        switch (options.strategy) {
          case 'auto':
            await autoMerge(sessions, options, worktreeManager);
            break;
          case 'manual':
            await manualMerge(sessions, options, worktreeManager);
            break;
          case 'best':
            await bestOfMerge(sessions, options, worktreeManager, tmuxManager);
            break;
          default:
            throw new Error(`Unknown strategy: ${options.strategy}`);
        }

        console.log(chalk.green('\n✅ Merge completed successfully!'));
        
      } catch (error) {
        console.error(chalk.red(`Error: ${error}`));
        process.exit(1);
      }
    });
  
  return command;
}

async function getChangeSummary(worktreePath: string): Promise<string> {
  try {
    const result = await execa('git', ['diff', '--stat', 'HEAD'], { cwd: worktreePath });
    const lines = result.stdout.trim().split('\n');
    const lastLine = lines[lines.length - 1];
    return lastLine || 'No changes';
  } catch {
    return 'Unable to get changes';
  }
}

async function compareAgentWork(sessions: AgentSession[], worktreeManager: WorktreeManager) {
  console.log(chalk.blue('\n📊 Comparing agent implementations:\n'));

  // Get modified files for each agent
  const agentFiles = new Map<string, Set<string>>();
  
  for (const session of sessions) {
    try {
      const result = await execa('git', ['diff', '--name-only', 'HEAD'], { 
        cwd: session.worktreePath 
      });
      const files = result.stdout.trim().split('\n').filter(f => f);
      agentFiles.set(session.name, new Set(files));
    } catch (error) {
      console.error(chalk.red(`Failed to get changes for ${session.name}`));
    }
  }

  // Find overlapping files
  const allFiles = new Set<string>();
  const conflictFiles = new Set<string>();
  
  for (const [agent, files] of agentFiles) {
    for (const file of files) {
      if (allFiles.has(file)) {
        conflictFiles.add(file);
      }
      allFiles.add(file);
    }
  }

  // Display comparison
  if (conflictFiles.size > 0) {
    console.log(chalk.yellow('⚠️  Files modified by multiple agents:'));
    for (const file of conflictFiles) {
      console.log(chalk.yellow(`   - ${file}`));
      const agents = sessions.filter(s => agentFiles.get(s.name)?.has(file));
      for (const agent of agents) {
        console.log(chalk.gray(`     • ${agent.name} (${agent.model})`));
      }
    }
    console.log();
  }

  // Show unique files per agent
  console.log(chalk.green('📝 Unique files per agent:'));
  for (const session of sessions) {
    const files = agentFiles.get(session.name) || new Set();
    const uniqueFiles = Array.from(files).filter(f => !conflictFiles.has(f));
    if (uniqueFiles.length > 0) {
      console.log(chalk.cyan(`\n   ${session.name}:`));
      uniqueFiles.forEach(f => console.log(chalk.gray(`     - ${f}`)));
    }
  }
}

async function autoMerge(
  sessions: AgentSession[], 
  options: MergeOptions, 
  worktreeManager: WorktreeManager
) {
  console.log(chalk.blue('\n🤖 Running automatic merge...\n'));

  // Create a temporary merge branch
  const mergeBranch = `uzi-merge-${Date.now()}`;
  await execa('git', ['checkout', '-b', mergeBranch, options.base!]);

  let successCount = 0;
  let conflictCount = 0;

  // Merge each agent's work
  for (const session of sessions) {
    try {
      console.log(chalk.gray(`Merging ${session.name}...`));
      
      const mergeArgs = ['merge', '--no-ff'];
      if (options.squash) {
        mergeArgs.push('--squash');
      }
      mergeArgs.push(`uzi/${session.name}-${session.id.slice(0, 8)}`);
      mergeArgs.push('-m', `Merge ${session.name}: ${session.model} implementation`);

      await execa('git', mergeArgs, { cwd: process.cwd() });
      successCount++;
      console.log(chalk.green(`✓ Merged ${session.name}`));
    } catch (error) {
      conflictCount++;
      console.log(chalk.yellow(`⚠️  Conflicts in ${session.name} - manual resolution needed`));
      
      // Abort the merge
      await execa('git', ['merge', '--abort'], { cwd: process.cwd() }).catch(() => {});
    }
  }

  if (conflictCount > 0) {
    console.log(chalk.yellow(`\n⚠️  ${conflictCount} agents had conflicts. Consider using --interactive mode.`));
  }

  console.log(chalk.green(`\n✅ Successfully merged ${successCount} agents into ${mergeBranch}`));
  console.log(chalk.gray('Review the changes and merge to main when ready.'));
}

async function manualMerge(
  sessions: AgentSession[], 
  options: MergeOptions, 
  worktreeManager: WorktreeManager
) {
  console.log(chalk.blue('\n👤 Manual merge mode\n'));

  // Let user choose which agents to merge
  const { selectedAgents } = await inquirer.prompt([{
    type: 'checkbox',
    name: 'selectedAgents',
    message: 'Select agents to merge:',
    choices: sessions.map(s => ({
      name: `${s.name} (${s.model}) - ${s.status}`,
      value: s,
      checked: true
    }))
  }]);

  if (selectedAgents.length === 0) {
    console.log(chalk.yellow('No agents selected'));
    return;
  }

  // For each selected agent, choose files to merge
  for (const session of selectedAgents) {
    console.log(chalk.cyan(`\n📁 Processing ${session.name}...`));
    
    // Get list of changed files
    const result = await execa('git', ['diff', '--name-only', 'HEAD'], { 
      cwd: session.worktreePath 
    });
    const files = result.stdout.trim().split('\n').filter(f => f);

    if (files.length === 0) {
      console.log(chalk.gray('No changes in this agent'));
      continue;
    }

    const { selectedFiles } = await inquirer.prompt([{
      type: 'checkbox',
      name: 'selectedFiles',
      message: `Select files to merge from ${session.name}:`,
      choices: files.map(f => ({ name: f, value: f, checked: true }))
    }]);

    // Cherry-pick selected files
    for (const file of selectedFiles) {
      try {
        await execa('git', ['checkout', `uzi/${session.name}-${session.id.slice(0, 8)}`, '--', file]);
        console.log(chalk.green(`✓ Merged ${file}`));
      } catch (error) {
        console.error(chalk.red(`✗ Failed to merge ${file}`));
      }
    }
  }
}

async function bestOfMerge(
  sessions: AgentSession[], 
  options: MergeOptions, 
  worktreeManager: WorktreeManager,
  tmuxManager: TmuxManager
) {
  console.log(chalk.blue('\n🏆 Best-of merge mode\n'));
  console.log(chalk.gray('Analyzing agent outputs to select best implementations...\n'));

  // Analyze each agent's work quality
  const scores = new Map<string, number>();
  
  for (const session of sessions) {
    let score = 0;
    
    // Check test results if available
    try {
      const testResult = await execa('pnpm', ['test'], { 
        cwd: session.worktreePath,
        reject: false 
      });
      if (testResult.exitCode === 0) {
        score += 50;
        console.log(chalk.green(`✓ ${session.name}: All tests passing (+50)`));
      } else {
        console.log(chalk.yellow(`⚠️  ${session.name}: Some tests failing`));
      }
    } catch {
      console.log(chalk.gray(`- ${session.name}: Unable to run tests`));
    }

    // Check linting
    try {
      const lintResult = await execa('pnpm', ['run', 'lint'], { 
        cwd: session.worktreePath,
        reject: false 
      });
      if (lintResult.exitCode === 0) {
        score += 25;
        console.log(chalk.green(`✓ ${session.name}: No lint errors (+25)`));
      }
    } catch {}

    // Check code complexity (lines changed as a proxy)
    try {
      const statResult = await execa('git', ['diff', '--stat'], { 
        cwd: session.worktreePath 
      });
      const lines = statResult.stdout.match(/(\d+) insertions?\(\+\), (\d+) deletions?/);
      if (lines) {
        const totalChanges = parseInt(lines[1]) + parseInt(lines[2]);
        if (totalChanges < 500) {
          score += 25;
          console.log(chalk.green(`✓ ${session.name}: Concise implementation (+25)`));
        }
      }
    } catch {}

    scores.set(session.name, score);
  }

  // Sort agents by score
  const sortedSessions = sessions.sort((a, b) => 
    (scores.get(b.name) || 0) - (scores.get(a.name) || 0)
  );

  console.log(chalk.blue('\n📊 Agent Rankings:'));
  sortedSessions.forEach((s, i) => {
    console.log(chalk.cyan(`${i + 1}. ${s.name}: ${scores.get(s.name) || 0} points`));
  });

  // Merge the best implementation
  const bestAgent = sortedSessions[0];
  console.log(chalk.green(`\n🏆 Merging best implementation from ${bestAgent.name}...`));
  
  await autoMerge([bestAgent], options, worktreeManager);

  // Optionally merge specific good parts from other agents
  if (sortedSessions.length > 1 && options.interactive) {
    const { mergeOthers } = await inquirer.prompt([{
      type: 'confirm',
      name: 'mergeOthers',
      message: 'Would you like to cherry-pick specific features from other agents?',
      default: false
    }]);

    if (mergeOthers) {
      await manualMerge(sortedSessions.slice(1), options, worktreeManager);
    }
  }
}

// Helper function to detect merge conflicts
async function hasConflicts(branch1: string, branch2: string): Promise<boolean> {
  try {
    await execa('git', ['merge-tree', branch1, branch2]);
    return false;
  } catch {
    return true;
  }
}