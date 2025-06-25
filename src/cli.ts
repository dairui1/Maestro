#!/usr/bin/env node
import { Command } from 'commander';
import * as path from 'path';
import { createPromptCommand } from './commands/prompt';
import { createCreateCommand } from './commands/create';
import { createLsCommand } from './commands/ls';
import { createKillCommand } from './commands/kill';
import { createRunCommand } from './commands/run';
import { createBroadcastCommand } from './commands/broadcast';
import { createCheckpointCommand } from './commands/checkpoint';
import { createResetCommand } from './commands/reset';
import { createAutoCommand } from './commands/auto';
import { createMergeCommand } from './commands/merge';
import { createDiffCommand } from './commands/diff';
import { createMonitorCommand } from './commands/monitor';
import { ConfigManager } from './lib/config/config-manager';
import chalk from 'chalk';

async function main() {
  const program = new Command();
  
  program
    .name('maestro')
    .description('CLI tool to manage multiple AI coding agents in parallel')
    .version('1.0.0')
    .option('-v, --verbose', 'Enable verbose output')
    .option('-c, --config <path>', 'Path to config file (default: ./maestro.yaml)');

  // Add commands first
  program.addCommand(createPromptCommand());
  program.addCommand(createCreateCommand());
  program.addCommand(createLsCommand());
  program.addCommand(createKillCommand());
  program.addCommand(createRunCommand());
  program.addCommand(createBroadcastCommand());
  program.addCommand(createCheckpointCommand());
  program.addCommand(createResetCommand());
  program.addCommand(createAutoCommand());
  program.addCommand(createMergeCommand());
  program.addCommand(createDiffCommand());
  program.addCommand(createMonitorCommand());

  // Hook to check config before command execution
  program.hook('preAction', async (thisCommand) => {
    const options = thisCommand.opts();
    
    // Check if config exists, create default if not
    const configManager = new ConfigManager(options.config ? path.dirname(options.config) : undefined);
    if (!(await configManager.configExists())) {
      console.log(chalk.yellow('No maestro.yaml found. Creating default configuration...'));
      await configManager.createDefaultConfig();
      console.log(chalk.green('✓ Created maestro.yaml with default settings'));
    }
  });

  // Parse arguments
  try {
    await program.parseAsync(process.argv);
  } catch (error) {
    console.error(chalk.red(`Error: ${error}`));
    process.exit(1);
  }
}

// Run the CLI
main().catch((error) => {
  console.error(chalk.red(`Fatal error: ${error}`));
  process.exit(1);
});