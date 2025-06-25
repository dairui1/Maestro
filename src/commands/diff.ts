import { Command } from 'commander';
import { StateManager } from '../lib/state/state-manager';
import { ConfigManager } from '../lib/config/config-manager';
import { AgentSession } from '../types';
import chalk from 'chalk';
import execa = require('execa');
import * as path from 'path';
import * as fs from 'fs-extra';

interface DiffOptions {
  files?: string;
  unified?: number;
  sideBySide?: boolean;
  output?: string;
}

export function createDiffCommand(): Command {
  const command = new Command('diff');
  
  command
    .description('Compare code changes between agents')
    .argument('<agent1>', 'First agent name')
    .argument('<agent2>', 'Second agent name')
    .option('-f, --files <pattern>', 'Only compare files matching pattern')
    .option('-u, --unified <lines>', 'Number of unified context lines', '3')
    .option('-s, --side-by-side', 'Show side-by-side comparison', false)
    .option('-o, --output <file>', 'Save diff to file')
    .action(async (agent1: string, agent2: string, options: DiffOptions) => {
      try {
        const stateManager = new StateManager();
        const sessions = await stateManager.getAllSessions();
        
        // Find the two agents
        const session1 = sessions.find(s => s.name === agent1);
        const session2 = sessions.find(s => s.name === agent2);
        
        if (!session1) {
          console.error(chalk.red(`Agent "${agent1}" not found`));
          return;
        }
        
        if (!session2) {
          console.error(chalk.red(`Agent "${agent2}" not found`));
          return;
        }

        console.log(chalk.blue(`\n🔍 Comparing ${agent1} vs ${agent2}\n`));

        // Get list of changed files for both agents
        const files1 = await getChangedFiles(session1);
        const files2 = await getChangedFiles(session2);
        
        // Find common files and unique files
        const allFiles = new Set([...files1, ...files2]);
        const commonFiles = files1.filter(f => files2.includes(f));
        const unique1 = files1.filter(f => !files2.includes(f));
        const unique2 = files2.filter(f => !files1.includes(f));

        // Show summary
        console.log(chalk.cyan('📊 Summary:'));
        console.log(chalk.gray(`   Common files: ${commonFiles.length}`));
        console.log(chalk.gray(`   Unique to ${agent1}: ${unique1.length}`));
        console.log(chalk.gray(`   Unique to ${agent2}: ${unique2.length}`));
        console.log();

        // Show unique files
        if (unique1.length > 0) {
          console.log(chalk.yellow(`📁 Files only in ${agent1}:`));
          unique1.forEach(f => console.log(chalk.gray(`   + ${f}`)));
          console.log();
        }

        if (unique2.length > 0) {
          console.log(chalk.yellow(`📁 Files only in ${agent2}:`));
          unique2.forEach(f => console.log(chalk.gray(`   + ${f}`)));
          console.log();
        }

        // Compare common files
        if (commonFiles.length > 0) {
          console.log(chalk.blue(`📝 Comparing common files:\n`));
          
          let fullDiff = '';
          
          for (const file of commonFiles) {
            if (options.files && !file.match(new RegExp(options.files))) {
              continue;
            }

            const diff = await compareFile(session1, session2, file, options);
            if (diff) {
              console.log(chalk.cyan(`\n--- ${file} ---`));
              console.log(diff);
              fullDiff += `\n--- ${file} ---\n${diff}\n`;
            } else {
              console.log(chalk.gray(`\n✓ ${file} - identical`));
            }
          }

          // Save to file if requested
          if (options.output && fullDiff) {
            await fs.writeFile(options.output, fullDiff);
            console.log(chalk.green(`\n✅ Diff saved to ${options.output}`));
          }
        }

        // Show statistics
        await showDiffStats(session1, session2);
        
      } catch (error) {
        console.error(chalk.red(`Error: ${error}`));
        process.exit(1);
      }
    });
  
  return command;
}

async function getChangedFiles(session: AgentSession): Promise<string[]> {
  try {
    const result = await execa('git', ['diff', '--name-only', 'HEAD'], {
      cwd: session.worktreePath
    });
    return result.stdout.trim().split('\n').filter(f => f);
  } catch {
    return [];
  }
}

async function compareFile(
  session1: AgentSession,
  session2: AgentSession,
  file: string,
  options: DiffOptions
): Promise<string> {
  try {
    const file1 = path.join(session1.worktreePath, file);
    const file2 = path.join(session2.worktreePath, file);

    // Check if both files exist
    const exists1 = await fs.pathExists(file1);
    const exists2 = await fs.pathExists(file2);

    if (!exists1 && !exists2) {
      return '';
    }

    if (!exists1) {
      return chalk.red(`File only exists in ${session2.name}`);
    }

    if (!exists2) {
      return chalk.red(`File only exists in ${session1.name}`);
    }

    // Use git diff for better formatting
    const diffArgs = ['diff', '--no-index', '--no-prefix'];
    
    if (options.unified) {
      diffArgs.push(`-U${options.unified}`);
    }

    if (options.sideBySide) {
      // Use diff command for side-by-side
      const result = await execa('diff', ['-y', '--width=120', file1, file2], {
        reject: false
      });
      return colorifyDiff(result.stdout);
    } else {
      const result = await execa('git', [...diffArgs, file1, file2], {
        reject: false
      });
      return colorifyDiff(result.stdout);
    }
  } catch (error) {
    return chalk.red(`Error comparing file: ${error}`);
  }
}

function colorifyDiff(diff: string): string {
  return diff.split('\n').map(line => {
    if (line.startsWith('+') && !line.startsWith('+++')) {
      return chalk.green(line);
    } else if (line.startsWith('-') && !line.startsWith('---')) {
      return chalk.red(line);
    } else if (line.startsWith('@')) {
      return chalk.cyan(line);
    }
    return line;
  }).join('\n');
}

async function showDiffStats(session1: AgentSession, session2: AgentSession) {
  console.log(chalk.blue('\n📈 Diff Statistics:\n'));

  try {
    // Get stats for each agent
    const stats1 = await getAgentStats(session1);
    const stats2 = await getAgentStats(session2);

    console.log(chalk.cyan(`${session1.name} (${session1.model}):`));
    console.log(chalk.gray(`   Files changed: ${stats1.files}`));
    console.log(chalk.green(`   Lines added: ${stats1.added}`));
    console.log(chalk.red(`   Lines removed: ${stats1.removed}`));
    console.log(chalk.gray(`   Total changes: ${stats1.total}`));

    console.log();

    console.log(chalk.cyan(`${session2.name} (${session2.model}):`));
    console.log(chalk.gray(`   Files changed: ${stats2.files}`));
    console.log(chalk.green(`   Lines added: ${stats2.added}`));
    console.log(chalk.red(`   Lines removed: ${stats2.removed}`));
    console.log(chalk.gray(`   Total changes: ${stats2.total}`));

    // Calculate difference
    const diffStats = {
      files: Math.abs(stats1.files - stats2.files),
      added: Math.abs(stats1.added - stats2.added),
      removed: Math.abs(stats1.removed - stats2.removed),
      total: Math.abs(stats1.total - stats2.total)
    };

    console.log();
    console.log(chalk.yellow('📊 Difference:'));
    console.log(chalk.gray(`   Files: ${diffStats.files}`));
    console.log(chalk.gray(`   Lines: ${diffStats.total}`));

    // Determine which is more concise
    if (stats1.total < stats2.total) {
      console.log(chalk.green(`\n✨ ${session1.name} has a more concise implementation`));
    } else if (stats2.total < stats1.total) {
      console.log(chalk.green(`\n✨ ${session2.name} has a more concise implementation`));
    } else {
      console.log(chalk.gray(`\n✨ Both implementations have similar size`));
    }

  } catch (error) {
    console.error(chalk.red(`Failed to get statistics: ${error}`));
  }
}

async function getAgentStats(session: AgentSession): Promise<{
  files: number;
  added: number;
  removed: number;
  total: number;
}> {
  try {
    const result = await execa('git', ['diff', '--stat'], {
      cwd: session.worktreePath
    });

    const output = result.stdout;
    const match = output.match(/(\d+) files? changed(?:, (\d+) insertions?\(\+\))?(?:, (\d+) deletions?\(-\))?/);

    if (match) {
      const files = parseInt(match[1]) || 0;
      const added = parseInt(match[2]) || 0;
      const removed = parseInt(match[3]) || 0;
      return {
        files,
        added,
        removed,
        total: added + removed
      };
    }
  } catch {}

  return { files: 0, added: 0, removed: 0, total: 0 };
}