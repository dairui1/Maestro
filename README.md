# Maestro - Cross-Platform Application

A modern cross-platform application built with React, HeroUI, Tauri (desktop), and Capacitor (mobile).

## Tech Stack

- **Frontend**: React + Vite + TypeScript
- **UI Library**: HeroUI (formerly NextUI)
- **Styling**: Tailwind CSS
- **Desktop**: Tauri 2.x
- **Mobile**: Capacitor 7.x
- **Monorepo**: pnpm + Turborepo
- **Component Development**: Storybook

## Project Structure

```
maestro/
├── apps/
│   ├── desktop/      # Tauri desktop application
│   └── mobile/       # Capacitor mobile application
├── packages/
│   ├── ui-core/      # Shared React components with HeroUI
│   ├── ui-desktop/   # Desktop-specific components
│   └── ui-mobile/    # Mobile-specific components
├── shared/           # Shared utilities and hooks
└── .storybook/       # Storybook configuration
```

## Development

### Prerequisites

- Node.js 20 LTS
- pnpm (`npm i -g pnpm`)
- Rust 1.78+ (for Tauri)
- Xcode (for iOS development)
- Android Studio (for Android development)

### Getting Started

1. Install dependencies:
   ```bash
   pnpm install
   ```

2. Start development servers:

   **Frontend Development:**
   ```bash
   pnpm dev
   ```

   **Desktop App:**
   ```bash
   pnpm -C apps/desktop tauri dev
   ```

   **Mobile App (iOS):**
   ```bash
   pnpm -C apps/mobile cap sync ios
   pnpm -C apps/mobile cap open ios
   ```

   **Storybook:**
   ```bash
   pnpm storybook
   ```

### Building

```bash
# Build all packages
pnpm build

# Build desktop app
pnpm -C apps/desktop tauri build

# Build for mobile
pnpm -C apps/mobile build
pnpm -C apps/mobile cap sync
```

## Features

- ✅ Monorepo structure with pnpm workspaces
- ✅ Cross-platform UI components with HeroUI
- ✅ Desktop app with Tauri 2
- ✅ Mobile app with Capacitor 7
- ✅ Component documentation with Storybook
- ✅ TypeScript support
- ✅ Tailwind CSS for styling
- ✅ CI/CD with GitHub Actions

## License

ISC