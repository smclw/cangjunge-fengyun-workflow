import fs from 'node:fs/promises';
import path from 'node:path';

export async function readJsonConfig<T>(configDir: string, name: string): Promise<T> {
  const raw = await fs.readFile(path.join(configDir, name), 'utf8');
  return JSON.parse(raw) as T;
}

export interface WorkflowConfig {
  schemaVersion: number;
  steps: Array<{ id: string; label: string; manualGate: boolean }>;
  states: string[];
}

export interface ScoringConfig {
  schemaVersion: number;
  version: string;
  defaultWeights: { growth: number; monetization: number };
  growth: Record<string, number>;
  monetization: Record<string, number>;
  risks: Record<string, number>;
  hardBlocks: string[];
}

export interface AppConfig {
  host: string;
  defaultPort: number;
  maxPort: number;
  jsonLimit: string;
  uploadLimitBytes: number;
  backupRetention: number;
  allowedOrigins: string[];
  allowedExtensions: string[];
}
