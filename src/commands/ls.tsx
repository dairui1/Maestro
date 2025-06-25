import { Command } from 'commander';
import React, { useEffect, useState } from 'react';
import { render, Box, Text } from 'ink';
import { StateManager } from '../lib/state/state-manager';
import { AgentTable } from '../ui/AgentTable';
import { AgentSession } from '../types';
import chalk from 'chalk';

interface ListOptions {
  watch?: boolean;
  json?: boolean;
}

const ListApp: React.FC<{ watch: boolean }> = ({ watch }) => {
  const [sessions, setSessions] = useState<AgentSession[]>([]);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [error, setError] = useState<string | null>(null);

  const loadSessions = async () => {
    try {
      const stateManager = new StateManager();
      const allSessions = await stateManager.getAllSessions();
      setSessions(allSessions);
      setLastUpdate(new Date());
      setError(null);
    } catch (err) {
      setError(`Failed to load sessions: ${err}`);
    }
  };

  useEffect(() => {
    loadSessions();

    if (watch) {
      const interval = setInterval(loadSessions, 2000);
      return () => clearInterval(interval);
    }
  }, [watch]);

  if (error) {
    return (
      <Box>
        <Text color="red">{error}</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column">
      <Box marginBottom={1}>
        <Text bold>Maestro Agent Sessions</Text>
        {watch && (
          <Text color="gray"> (watching, updated: {lastUpdate.toLocaleTimeString()})</Text>
        )}
      </Box>
      <AgentTable sessions={sessions} />
      {watch && (
        <Box marginTop={1}>
          <Text color="gray">Press Ctrl+C to stop watching</Text>
        </Box>
      )}
    </Box>
  );
};

export function createLsCommand(): Command {
  const command = new Command('ls');
  
  command
    .description('List all active agent sessions')
    .option('-w, --watch', 'Watch mode - auto-refresh every 2 seconds', false)
    .option('--json', 'Output as JSON', false)
    .action(async (options: ListOptions) => {
      try {
        const stateManager = new StateManager();
        
        if (options.json) {
          const sessions = await stateManager.getAllSessions();
          console.log(JSON.stringify(sessions, null, 2));
          return;
        }
        
        if (options.watch) {
          const { waitUntilExit } = render(<ListApp watch={true} />);
          await waitUntilExit();
        } else {
          const sessions = await stateManager.getAllSessions();
          
          if (sessions.length === 0) {
            console.log(chalk.yellow('No active agent sessions'));
            return;
          }
          
          console.log(chalk.bold('Maestro Agent Sessions\n'));
          
          // Print table header
          const header = `${'Name'.padEnd(20)} ${'Model'.padEnd(15)} ${'Status'.padEnd(10)} ${'Port'.padEnd(8)} ${'Tmux Session'.padEnd(20)}`;
          console.log(chalk.cyan(header));
          console.log('─'.repeat(header.length));
          
          // Print sessions
          for (const session of sessions) {
            const statusColor = session.status === 'active' ? chalk.green : 
                              session.status === 'error' ? chalk.red : chalk.yellow;
            
            console.log(
              `${session.name.padEnd(20)} ${session.model.padEnd(15)} ${statusColor(session.status.padEnd(10))} ${session.port.toString().padEnd(8)} ${chalk.gray(session.tmuxSession.padEnd(20))}`
            );
          }
        }
      } catch (error) {
        console.error(chalk.red(`Error: ${error}`));
        process.exit(1);
      }
    });
  
  return command;
}