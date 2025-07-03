#!/usr/bin/env bun

import { mkdir } from 'fs/promises';

// API address
const baseURL = 'http://localhost:8080';

// Test data
const projectPath = '/tmp/test-project';
const prompt = 'Create a simple hello world Python script with comments';

// Create test directory
await mkdir(projectPath, { recursive: true });

console.log('🚀 Starting Claude API test...');
console.log('📁 Project path:', projectPath);
console.log('💭 Prompt:', prompt);
console.log();

try {
  // 1. Create session
  const response = await fetch(`${baseURL}/api/v1/sessions/execute`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      projectPath,
      prompt,
      model: 'sonnet',
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to create session: ${response.statusText}`);
  }

  const result = await response.json();
  const { sessionId, streamUrl } = result;

  console.log(`✅ Session created: ${sessionId}`);
  console.log(`📡 Stream URL: ${streamUrl}`);
  console.log('\n--- Claude Output ---');

  // 2. Connect to SSE stream
  const streamResponse = await fetch(`${baseURL}${streamUrl}`);
  
  if (!streamResponse.ok) {
    throw new Error(`Failed to connect to stream: ${streamResponse.statusText}`);
  }

  const reader = streamResponse.body?.getReader();
  if (!reader) {
    throw new Error('No response body');
  }

  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const data = line.slice(6).trim();
        if (!data) continue;

        try {
          const msg = JSON.parse(data);
          
          switch (msg.type) {
            case 'connected':
              console.log('🔗 Connected to stream');
              break;
            case 'output':
              if (msg.data) {
                const { content, stream } = msg.data;
                if (stream === 'stderr') {
                  console.log(`⚠️  ${content}`);
                } else {
                  console.log(content);
                }
              }
              break;
            case 'error':
              console.log(`❌ Error: ${msg.data}`);
              break;
            case 'status':
              console.log(`📊 Status: ${msg.data}`);
              break;
            case 'complete':
              console.log(`\n✅ Session completed with status: ${msg.data}`);
              process.exit(0);
              break;
          }
        } catch (error) {
          console.error('Failed to parse message:', error);
        }
      }
    }
  }
} catch (error) {
  console.error('❌ Test failed:', error);
  process.exit(1);
}