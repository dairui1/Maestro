import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'ai.codeck.maestro',
  appName: 'Maestro',
  webDir: '../../packages/ui-core/dist',
  server: {
    cleartext: true,
    androidScheme: 'https'
  }
};

export default config;