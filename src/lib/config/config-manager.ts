import * as fs from 'fs-extra';
import * as path from 'path';
import * as yaml from 'js-yaml';
import { z } from 'zod';
import { MaestroConfig } from '../../types';

const MaestroConfigSchema = z.object({
  devCommand: z.string().default('pnpm run dev'),
  portRange: z.object({
    start: z.number().default(3000),
    end: z.number().default(4000),
  }).default({ start: 3000, end: 4000 }),
  autoConfirm: z.boolean().optional(),
  defaultModel: z.string().optional(),
});

export class ConfigManager {
  private config: MaestroConfig | null = null;
  private configPath: string;

  constructor(projectRoot?: string) {
    const root = projectRoot || process.cwd();
    this.configPath = path.join(root, 'maestro.yaml');
  }

  async load(): Promise<MaestroConfig> {
    try {
      if (await fs.pathExists(this.configPath)) {
        const yamlContent = await fs.readFile(this.configPath, 'utf8');
        const rawConfig = yaml.load(yamlContent) as any;
        this.config = MaestroConfigSchema.parse(rawConfig);
        return this.config;
      }
    } catch (error) {
      console.error('Failed to load config:', error);
    }

    // Return default config
    this.config = {
      devCommand: 'pnpm run dev',
      portRange: {
        start: 3000,
        end: 4000,
      },
    };

    return this.config;
  }

  async save(): Promise<void> {
    if (!this.config) {
      throw new Error('Config not initialized');
    }

    const yamlContent = yaml.dump(this.config, { indent: 2 });
    await fs.writeFile(this.configPath, yamlContent);
  }

  async createDefaultConfig(): Promise<void> {
    const defaultConfig: MaestroConfig = {
      devCommand: '',
      portRange: {
        start: 3000,
        end: 4000,
      },
      autoConfirm: false,
      defaultModel: 'claude',
    };

    const yamlContent = yaml.dump(defaultConfig, { indent: 2 });
    await fs.writeFile(this.configPath, yamlContent);
    this.config = defaultConfig;
  }

  getConfig(): MaestroConfig {
    if (!this.config) {
      throw new Error('Config not loaded');
    }
    return this.config;
  }

  async configExists(): Promise<boolean> {
    return fs.pathExists(this.configPath);
  }
}