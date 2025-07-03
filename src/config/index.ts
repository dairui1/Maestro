import { z } from 'zod';

const ClaudeConfigSchema = z.object({
  binaryPath: z.string().default('claude'),
  defaultModel: z.string().default('sonnet'),
  maxConcurrentSessions: z.number().default(5),
  defaultArgs: z.array(z.string()).default([
    '--output-format', 'stream-json',
    '--verbose',
    '--dangerously-skip-permissions'
  ])
});

const ConfigSchema = z.object({
  claude: ClaudeConfigSchema
});

export type ClaudeConfig = z.infer<typeof ClaudeConfigSchema>;
export type Config = z.infer<typeof ConfigSchema>;

export async function loadConfig(configFile?: string): Promise<Config> {
  let configData: any = {
    claude: {
      binaryPath: 'claude',
      defaultModel: 'sonnet',
      maxConcurrentSessions: 5,
      defaultArgs: [
        '--output-format', 'stream-json',
        '--verbose',
        '--dangerously-skip-permissions'
      ]
    }
  };

  if (configFile) {
    try {
      const file = Bun.file(configFile);
      const content = await file.json();
      configData = { ...configData, ...content };
    } catch (error) {
      console.error(`Failed to load config file: ${error}`);
    }
  }

  return ConfigSchema.parse(configData);
}