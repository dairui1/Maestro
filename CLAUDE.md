# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Maestro is a cross-platform application with a monorepo architecture using pnpm workspaces and Turborepo. It targets desktop (Tauri) and mobile (Capacitor) platforms with a shared React-based UI component library.

## Essential Commands

### Development
```bash
# Install dependencies
pnpm install

# Run all development servers in parallel
pnpm dev

# Run desktop app specifically
pnpm -C apps/desktop tauri dev

# Run mobile app (iOS)
pnpm -C apps/mobile cap sync ios
pnpm -C apps/mobile cap open ios

# Run mobile app (Android)
pnpm -C apps/mobile cap sync android
pnpm -C apps/mobile cap open android
```

### Building
```bash
# Build all packages
pnpm build

# Build desktop app
pnpm -C apps/desktop tauri build

# Build mobile app
pnpm -C apps/mobile build
pnpm -C apps/mobile cap sync
```

### Linting
```bash
# Run linting across all packages
pnpm lint
```

## Architecture

### Monorepo Structure
- **apps/desktop**: Tauri 2.x desktop application with Rust backend
- **apps/mobile**: Capacitor 7.x mobile application for iOS/Android
- **packages/ui-core**: Shared React components using HeroUI (NextUI v2) and Tailwind CSS v4
- **packages/ui-desktop**: Desktop-specific UI components (currently empty)
- **packages/ui-mobile**: Mobile-specific UI components (currently empty)
- **shared**: Cross-platform utilities and hooks

### Technology Stack
- **Frontend**: React 19 + Vite + TypeScript
- **UI Framework**: HeroUI (NextUI v2) with Tailwind CSS v4
- **Desktop Runtime**: Tauri 2.x (Rust-based)
- **Mobile Runtime**: Capacitor 7.x
- **Build System**: Turborepo with pnpm workspaces

### Key Architectural Decisions
1. **Monorepo with workspaces**: Enables code sharing between desktop and mobile apps
2. **Platform-specific UI packages**: Allows tailoring components for each platform while maintaining a core set
3. **Turborepo pipelines**: Manages build dependencies and caching across packages
4. **Shared hooks**: The `shared/hooks/useApi.ts` provides platform-aware API base URL detection

### Development Workflow
1. All packages are built in dependency order via Turborepo
2. Development mode runs all apps in parallel
3. Platform-specific commands should be run from their respective directories using `pnpm -C apps/<platform>`
4. Mobile development requires platform-specific tools (Xcode for iOS, Android Studio for Android)

## Important Notes
- No testing framework is currently configured
- Storybook is mentioned in documentation but not yet implemented
- The project uses pnpm version 10.12.4 as the package manager
- Desktop app uses port 1420 for development API server