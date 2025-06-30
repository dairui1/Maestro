#!/usr/bin/env node
// Shortcut for launching Maestro TUI
import execa = require('execa');

execa('maestro', ['tui'], { stdio: 'inherit' }).catch(error => {
  console.error('Failed to launch Maestro TUI:', error);
  process.exit(1);
});