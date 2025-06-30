#!/usr/bin/env node
import React, { useState, useEffect } from 'react';
import { render, Box, Text, useApp, useInput, useFocus } from 'ink';
import { Command } from 'commander';
import chalk from 'chalk';
import { StateManager } from '../lib/state/state-manager';
import { TmuxManager } from '../lib/tmux/tmux-manager';
import { AgentManager } from '../lib/agent/agent-manager';
import { ConfigManager } from '../lib/config/config-manager';
import { WorktreeManager } from '../lib/git/worktree-manager';
import { AgentSession } from '../types';
import execa = require('execa');

interface SessionListProps {
  sessions: AgentSession[];
  selectedIndex: number;
  onSelect: (index: number) => void;
}

const SessionList: React.FC<SessionListProps> = ({ sessions, selectedIndex, onSelect }) => {
  return (
    <Box flexDirection="column" borderStyle="round" borderColor="cyan" padding={1}>
      <Text bold color="cyan">Active Sessions</Text>
      <Box marginTop={1} flexDirection="column">
        {sessions.length === 0 ? (
          <Text color="gray">No active sessions</Text>
        ) : (
          sessions.map((session, index) => (
            <Box key={session.id}>
              <Text color={index === selectedIndex ? 'green' : 'white'}>
                {index === selectedIndex ? '▶ ' : '  '}
                {session.name} ({session.model}) - {session.status}
              </Text>
            </Box>
          ))
        )}
      </Box>
    </Box>
  );
};

interface ActionMenuProps {
  selectedAction: number;
  onSelect: (index: number) => void;
}

const ActionMenu: React.FC<ActionMenuProps> = ({ selectedAction, onSelect }) => {
  const actions = [
    { key: 'n', label: 'New Session', description: 'Create a new agent session' },
    { key: 'N', label: 'New with Prompt', description: 'Create session with initial prompt' },
    { key: 'a', label: 'Attach', description: 'Attach to selected session' },
    { key: 'k', label: 'Kill', description: 'Terminate selected session' },
    { key: 'p', label: 'Pause', description: 'Pause selected session' },
    { key: 'r', label: 'Resume', description: 'Resume paused session' },
    { key: 'c', label: 'Commit', description: 'Commit and push changes' },
    { key: 'q', label: 'Quit', description: 'Exit Maestro TUI' },
  ];

  return (
    <Box flexDirection="column" borderStyle="round" borderColor="magenta" padding={1}>
      <Text bold color="magenta">Actions</Text>
      <Box marginTop={1} flexDirection="column">
        {actions.map((action, index) => (
          <Box key={action.key}>
            <Text color={index === selectedAction ? 'green' : 'white'}>
              {index === selectedAction ? '▶ ' : '  '}
              [{action.key}] {action.label}
            </Text>
          </Box>
        ))}
      </Box>
    </Box>
  );
};

interface MaestroTUIProps {
  initialSessions: AgentSession[];
}

const MaestroTUI: React.FC<MaestroTUIProps> = ({ initialSessions }) => {
  const { exit } = useApp();
  const [sessions, setSessions] = useState(initialSessions);
  const [selectedSession, setSelectedSession] = useState(0);
  const [selectedAction, setSelectedAction] = useState(0);
  const [focusArea, setFocusArea] = useState<'sessions' | 'actions'>('sessions');
  const [message, setMessage] = useState<string>('');

  // Refresh sessions periodically
  useEffect(() => {
    const interval = setInterval(async () => {
      const stateManager = new StateManager();
      const state = await stateManager.load();
      setSessions(state.sessions);
    }, 2000);

    return () => clearInterval(interval);
  }, []);

  useInput(async (input, key) => {
    // Handle navigation
    if (key.upArrow) {
      if (focusArea === 'sessions') {
        setSelectedSession(Math.max(0, selectedSession - 1));
      } else {
        setSelectedAction(Math.max(0, selectedAction - 1));
      }
    } else if (key.downArrow) {
      if (focusArea === 'sessions') {
        setSelectedSession(Math.min(sessions.length - 1, selectedSession + 1));
      } else {
        setSelectedAction(Math.min(7, selectedAction + 1)); // 8 actions total
      }
    } else if (key.tab) {
      setFocusArea(focusArea === 'sessions' ? 'actions' : 'sessions');
    }

    // Handle shortcuts
    const session = sessions[selectedSession];
    
    switch (input) {
      case 'q':
        exit();
        break;
        
      case 'n':
        // New session
        setMessage('Creating new session...');
        try {
          await execa('maestro', ['prompt', 'agent1', '-y']);
          setMessage('Session created successfully!');
        } catch (error) {
          setMessage(`Error: ${error}`);
        }
        break;
        
      case 'a':
        // Attach to session
        if (session) {
          exit();
          process.nextTick(() => {
            execa.sync('tmux', ['attach-session', '-t', session.tmuxSession], {
              stdio: 'inherit'
            });
          });
        }
        break;
        
      case 'k':
        // Kill session
        if (session) {
          setMessage(`Killing session ${session.name}...`);
          try {
            await execa('maestro', ['kill', session.name]);
            setMessage('Session killed successfully!');
          } catch (error) {
            setMessage(`Error: ${error}`);
          }
        }
        break;
        
      case 'p':
        // Pause session
        if (session && session.status === 'active') {
          setMessage(`Pausing session ${session.name}...`);
          try {
            await execa('maestro', ['pause', session.name]);
            setMessage('Session paused successfully!');
          } catch (error) {
            setMessage(`Error: ${error}`);
          }
        }
        break;
        
      case 'r':
        // Resume session
        if (session && session.status === 'paused') {
          exit();
          process.nextTick(() => {
            execa.sync('maestro', ['resume', session.name], {
              stdio: 'inherit'
            });
          });
        }
        break;
        
      case 'c':
        // Commit changes
        if (session) {
          setMessage(`Committing changes for ${session.name}...`);
          try {
            await execa('maestro', ['commit', session.name]);
            setMessage('Changes committed successfully!');
          } catch (error) {
            setMessage(`Error: ${error}`);
          }
        }
        break;
    }
  });

  return (
    <Box flexDirection="column" padding={1}>
      <Box marginBottom={1}>
        <Text bold color="yellow">🎼 Maestro - AI Agent Orchestration</Text>
      </Box>
      
      <Box>
        <Box width="60%" marginRight={2}>
          <SessionList 
            sessions={sessions} 
            selectedIndex={selectedSession}
            onSelect={setSelectedSession}
          />
        </Box>
        
        <Box width="40%">
          <ActionMenu 
            selectedAction={selectedAction}
            onSelect={setSelectedAction}
          />
        </Box>
      </Box>
      
      {message && (
        <Box marginTop={1} borderStyle="round" borderColor="gray" padding={1}>
          <Text color="yellow">{message}</Text>
        </Box>
      )}
      
      <Box marginTop={1}>
        <Text color="gray">Use ↑↓ to navigate, Tab to switch focus, shortcuts to perform actions</Text>
      </Box>
    </Box>
  );
};

export function createTUICommand(): Command {
  const command = new Command('tui');
  
  command
    .description('Launch interactive Terminal UI for managing agents')
    .action(async () => {
      try {
        const stateManager = new StateManager();
        const state = await stateManager.load();
        
        render(<MaestroTUI initialSessions={state.sessions} />);
      } catch (error) {
        console.error(chalk.red(`Failed to launch TUI: ${error}`));
        process.exit(1);
      }
    });
  
  return command;
}