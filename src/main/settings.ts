import fs from 'node:fs';
import { appSettingsPath, ensureDirs } from './paths';
import type { ScheduleEntry } from '../shared/types';

export interface AppSettings {
  /** Absolute path to bedrock_server.exe, if the user has chosen one manually (P1). */
  bedrockExePath?: string;
  /** Restart automatically when the server process crashes (spec 3.1). */
  autoRestart?: boolean;
  /** Microsoft EULA acceptance timestamp (ISO string), spec 8.2. */
  eulaAcceptedAt?: string;
  /** Version string of the managed install at the canonical location. */
  installedVersion?: string;
  /** Manual download URL override (spec 9.2 fallback when scraping fails). */
  downloadUrlOverride?: string;
  /** playit.gg agent secret key (run `playit.exe --secret <key>`). */
  playitSecret?: string;
  /** User-saved public tunnel address from the playit dashboard. */
  playitTunnelAddress?: string;
  /** Automatically back up the active world when the server stops (v2). */
  autoBackupOnStop?: boolean;
  /** How many backups to keep per world (older ones are pruned). */
  maxBackupsPerWorld?: number;
  /** Scheduled start/stop/restart entries (v2). */
  schedule?: ScheduleEntry[];
}

const DEFAULTS: AppSettings = {
  autoRestart: false,
};

let cache: AppSettings | null = null;

export function readSettings(): AppSettings {
  if (cache) return cache;
  ensureDirs();
  try {
    const raw = fs.readFileSync(appSettingsPath(), 'utf-8');
    cache = { ...DEFAULTS, ...(JSON.parse(raw) as AppSettings) };
  } catch {
    cache = { ...DEFAULTS };
  }
  return cache;
}

export function writeSettings(patch: Partial<AppSettings>): AppSettings {
  const next = { ...readSettings(), ...patch };
  ensureDirs();
  fs.writeFileSync(appSettingsPath(), JSON.stringify(next, null, 2), 'utf-8');
  cache = next;
  return next;
}
