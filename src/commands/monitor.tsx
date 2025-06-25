import { Command } from 'commander';
import React, { useState, useEffect } from 'react';
import { render, Box, Text, useInput, useApp } from 'ink';
import { StateManager } from '../lib/state/state-manager';
import { TmuxManager } from '../lib/tmux/tmux-manager';
import { AgentSession } from '../types';
import chalk from 'chalk';
import execa = require('execa');

interface MonitorOptions {
  interval?: number;
  showOutput?: boolean;
  metrics?: boolean;
}

interface AgentMetrics {
  session: AgentSession;
  isActive: boolean;
  lastActivity: string;
  filesChanged: number;
  linesAdded: number;
  linesRemoved: number;
  currentTask: string;
  cpuUsage?: number;
  memoryUsage?: number;
}

const MonitorUI: React.FC<{ interval: number; showOutput: boolean; showMetrics: boolean }> = ({ 
  interval, 
  showOutput,
  showMetrics 
}) => {
  const [agents, setAgents] = useState<AgentMetrics[]>([]);
  const [selectedAgent, setSelectedAgent] = useState(0);
  const [agentOutputs, setAgentOutputs] = useState<Map<string, string[]>>(new Map());
  const { exit } = useApp();

  useInput((input, key) => {
    if (input === 'q' || key.escape) {
      exit();
    } else if (key.upArrow) {
      setSelectedAgent(prev => Math.max(0, prev - 1));
    } else if (key.downArrow) {
      setSelectedAgent(prev => Math.min(agents.length - 1, prev + 1));
    } else if (input === 'r') {
      refreshAgents();
    }
  });

  const refreshAgents = async () => {
    const stateManager = new StateManager();
    const tmuxManager = new TmuxManager();
    const sessions = await stateManager.getAllSessions();
    
    const metrics: AgentMetrics[] = await Promise.all(
      sessions.map(async (session) => {
        const isActive = await tmuxManager.sessionExists(session.tmuxSession);
        const stats = await getGitStats(session.worktreePath);
        const lastActivity = await getLastActivity(session);
        const currentTask = await getCurrentTask(tmuxManager, session);
        
        let cpuUsage, memoryUsage;
        if (showMetrics && session.pid) {
          const usage = await getProcessMetrics(session.pid);
          cpuUsage = usage.cpu;
          memoryUsage = usage.memory;
        }

        return {
          session,
          isActive,
          lastActivity,
          filesChanged: stats.files,
          linesAdded: stats.added,
          linesRemoved: stats.removed,
          currentTask,
          cpuUsage,
          memoryUsage
        };
      })
    );

    setAgents(metrics);

    // Update outputs if enabled
    if (showOutput) {
      const outputs = new Map<string, string[]>();
      for (const metric of metrics) {
        if (metric.isActive) {
          const output = await getRecentOutput(tmuxManager, metric.session);
          outputs.set(metric.session.id, output);
        }
      }
      setAgentOutputs(outputs);
    }
  };

  useEffect(() => {
    refreshAgents();
    const timer = setInterval(refreshAgents, interval * 1000);
    return () => clearInterval(timer);
  }, [interval]);

  return (
    <Box flexDirection="column" padding={1}>
      <Box marginBottom={1}>
        <Text bold color="blue">
          🔍 Maestro Agent Monitor - {agents.length} active agents
        </Text>
        <Text color="gray"> (↑/↓: navigate, r: refresh, q: quit)</Text>
      </Box>

      <Box flexDirection="column">
        {agents.map((agent, index) => (
          <Box
            key={agent.session.id}
            flexDirection="column"
            borderStyle="single"
            borderColor={index === selectedAgent ? 'cyan' : 'gray'}
            paddingX={1}
            marginBottom={1}
          >
            <Box justifyContent="space-between">
              <Text color={agent.isActive ? 'green' : 'red'}>
                {agent.isActive ? '●' : '○'} {agent.session.name} ({agent.session.model})
              </Text>
              <Text color="gray">Port: {agent.session.port}</Text>
            </Box>

            <Box>
              <Text color="gray">
                📝 {agent.filesChanged} files | 
                <Text color="green"> +{agent.linesAdded}</Text> | 
                <Text color="red"> -{agent.linesRemoved}</Text> | 
                Last: {agent.lastActivity}
              </Text>
            </Box>

            {agent.currentTask && (
              <Box>
                <Text color="yellow">🎯 {agent.currentTask}</Text>
              </Box>
            )}

            {showMetrics && agent.cpuUsage !== undefined && (
              <Box>
                <Text color="gray">
                  💻 CPU: {agent.cpuUsage.toFixed(1)}% | 
                  RAM: {(agent.memoryUsage! / 1024 / 1024).toFixed(0)}MB
                </Text>
              </Box>
            )}

            {showOutput && index === selectedAgent && agentOutputs.get(agent.session.id) && (
              <Box flexDirection="column" marginTop={1}>
                <Text color="cyan">Recent output:</Text>
                {agentOutputs.get(agent.session.id)!.map((line, i) => (
                  <Text key={i} color="gray">{line}</Text>
                ))}
              </Box>
            )}
          </Box>
        ))}
      </Box>

      {agents.length === 0 && (
        <Box>
          <Text color="yellow">No active agents found. Use 'maestro prompt' to create agents.</Text>
        </Box>
      )}
    </Box>
  );
};

export function createMonitorCommand(): Command {
  const command = new Command('monitor');
  
  command
    .description('Real-time monitoring of all active agents')
    .option('-i, --interval <seconds>', 'Refresh interval in seconds', '2')
    .option('-o, --output', 'Show recent output from agents', false)
    .option('-m, --metrics', 'Show CPU and memory usage', false)
    .action(async (options: MonitorOptions) => {
      const interval = parseInt(options.interval?.toString() || '2', 10);
      
      console.clear();
      
      const { waitUntilExit } = render(
        <MonitorUI 
          interval={interval} 
          showOutput={options.showOutput || false}
          showMetrics={options.metrics || false}
        />
      );
      
      await waitUntilExit();
    });
  
  return command;
}

async function getGitStats(worktreePath: string): Promise<{
  files: number;
  added: number;
  removed: number;
}> {
  try {
    const result = await execa('git', ['diff', '--stat'], {
      cwd: worktreePath
    });

    const output = result.stdout;
    const match = output.match(/(\d+) files? changed(?:, (\d+) insertions?\(\+\))?(?:, (\d+) deletions?\(-\))?/);

    if (match) {
      return {
        files: parseInt(match[1]) || 0,
        added: parseInt(match[2]) || 0,
        removed: parseInt(match[3]) || 0
      };
    }
  } catch {}

  return { files: 0, added: 0, removed: 0 };
}

async function getLastActivity(session: AgentSession): Promise<string> {
  try {
    const result = await execa('git', ['log', '-1', '--format=%cr'], {
      cwd: session.worktreePath
    });
    return result.stdout.trim() || 'No commits';
  } catch {
    return 'No activity';
  }
}

async function getCurrentTask(tmuxManager: TmuxManager, session: AgentSession): Promise<string> {
  try {
    const output = await tmuxManager.capturePane(session.tmuxSession, 1);
    const lines = output.split('\n').filter(line => line.trim());
    
    // Look for task indicators
    for (const line of lines.slice(-10).reverse()) {
      if (line.includes('Working on') || 
          line.includes('Implementing') || 
          line.includes('Creating') ||
          line.includes('Testing') ||
          line.includes('Fixing')) {
        return line.trim();
      }
    }
    
    // Check for Claude's task acknowledgment
    const taskMatch = output.match(/I'll help you (.+?)\./);
    if (taskMatch) {
      return taskMatch[1];
    }
    
    return 'Idle';
  } catch {
    return 'Unknown';
  }
}

async function getRecentOutput(tmuxManager: TmuxManager, session: AgentSession): Promise<string[]> {
  try {
    const output = await tmuxManager.capturePane(session.tmuxSession, 1);
    const lines = output.split('\n');
    return lines.slice(-5).filter(line => line.trim());
  } catch {
    return ['Unable to capture output'];
  }
}

async function getProcessMetrics(pid: number): Promise<{ cpu: number; memory: number }> {
  try {
    const result = await execa('ps', ['-p', pid.toString(), '-o', '%cpu,rss']);
    const lines = result.stdout.trim().split('\n');
    if (lines.length > 1) {
      const [cpu, memory] = lines[1].trim().split(/\s+/);
      return {
        cpu: parseFloat(cpu) || 0,
        memory: parseInt(memory) || 0
      };
    }
  } catch {}
  
  return { cpu: 0, memory: 0 };
}