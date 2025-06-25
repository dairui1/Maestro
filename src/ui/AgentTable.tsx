import React from 'react';
import { Box, Text } from 'ink';
import { AgentSession } from '../types';

interface AgentTableProps {
  sessions: AgentSession[];
}

export const AgentTable: React.FC<AgentTableProps> = ({ sessions }) => {
  if (sessions.length === 0) {
    return (
      <Box>
        <Text color="yellow">No active agent sessions</Text>
      </Box>
    );
  }

  // Calculate column widths
  const nameWidth = Math.max(4, ...sessions.map(s => s.name.length));
  const modelWidth = Math.max(5, ...sessions.map(s => s.model.length));
  const statusWidth = 8;
  const portWidth = 6;
  const tmuxWidth = Math.max(12, ...sessions.map(s => s.tmuxSession.length));

  return (
    <Box flexDirection="column">
      {/* Header */}
      <Box>
        <Box width={nameWidth + 2}>
          <Text bold color="cyan">Name</Text>
        </Box>
        <Box width={modelWidth + 2}>
          <Text bold color="cyan">Model</Text>
        </Box>
        <Box width={statusWidth + 2}>
          <Text bold color="cyan">Status</Text>
        </Box>
        <Box width={portWidth + 2}>
          <Text bold color="cyan">Port</Text>
        </Box>
        <Box width={tmuxWidth + 2}>
          <Text bold color="cyan">Tmux Session</Text>
        </Box>
      </Box>

      {/* Separator */}
      <Box>
        <Text>{'─'.repeat(nameWidth + modelWidth + statusWidth + portWidth + tmuxWidth + 10)}</Text>
      </Box>

      {/* Rows */}
      {sessions.map((session) => (
        <Box key={session.id}>
          <Box width={nameWidth + 2}>
            <Text>{session.name}</Text>
          </Box>
          <Box width={modelWidth + 2}>
            <Text>{session.model}</Text>
          </Box>
          <Box width={statusWidth + 2}>
            <Text color={getStatusColor(session.status)}>{session.status}</Text>
          </Box>
          <Box width={portWidth + 2}>
            <Text>{session.port}</Text>
          </Box>
          <Box width={tmuxWidth + 2}>
            <Text color="gray">{session.tmuxSession}</Text>
          </Box>
        </Box>
      ))}
    </Box>
  );
};

function getStatusColor(status: AgentSession['status']): string {
  switch (status) {
    case 'active':
      return 'green';
    case 'inactive':
      return 'yellow';
    case 'error':
      return 'red';
    default:
      return 'white';
  }
}