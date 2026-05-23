import { app } from 'electron';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';
import { bedrockBinaryName, isWindows } from './platform';

/**
 * Root data folder. Spec 6.1 specifies %LOCALAPPDATA%/BedrockServerManager on
 * Windows. On Linux we follow XDG: $XDG_DATA_HOME/BedrockServerManager (default
 * ~/.local/share/BedrockServerManager).
 */
export function dataRoot(): string {
  if (isWindows) {
    const localAppData = process.env.LOCALAPPDATA || app.getPath('userData');
    return path.join(localAppData, 'BedrockServerManager');
  }
  const xdg = process.env.XDG_DATA_HOME || path.join(os.homedir(), '.local', 'share');
  return path.join(xdg, 'BedrockServerManager');
}

export function binDir(): string {
  return path.join(dataRoot(), 'bin');
}

export function bedrockDir(): string {
  return path.join(binDir(), 'bedrock_server');
}

/** Default location for the official server binary (used when not overridden in settings). */
export function defaultBedrockExe(): string {
  return path.join(bedrockDir(), bedrockBinaryName());
}

export function configDir(): string {
  return path.join(dataRoot(), 'config');
}

export function logsDir(): string {
  return path.join(dataRoot(), 'logs');
}

export function backupsDir(): string {
  return path.join(dataRoot(), 'backups');
}

export function appSettingsPath(): string {
  return path.join(configDir(), 'app-settings.json');
}

export function ensureDirs(): void {
  for (const dir of [dataRoot(), binDir(), bedrockDir(), configDir(), logsDir(), backupsDir()]) {
    fs.mkdirSync(dir, { recursive: true });
  }
}
