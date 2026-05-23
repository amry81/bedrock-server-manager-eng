import fs from 'node:fs';
import path from 'node:path';
import type { ConfigSetPayload, ConfigSetResult, ServerPropertiesData } from '../shared/types';
import { bedrockDir } from './paths';

/** The server.properties the running server actually reads (cwd = bedrockDir). */
function propertiesPath(): string {
  return path.join(bedrockDir(), 'server.properties');
}

function detectEol(text: string): string {
  return text.includes('\r\n') ? '\r\n' : '\n';
}

/** Parse "key=value" lines into a map, ignoring comments and blanks. */
export function parseProperties(text: string): Record<string, string> {
  const values: Record<string, string> = {};
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    const value = line.slice(eq + 1).trim();
    if (key) values[key] = value;
  }
  return values;
}

export function readConfig(): ServerPropertiesData {
  const file = propertiesPath();
  if (!fs.existsSync(file)) {
    return { raw: '', values: {} };
  }
  const raw = fs.readFileSync(file, 'utf-8');
  return { raw, values: parseProperties(raw) };
}

/**
 * Merge updates into the existing file, preserving comments, ordering and EOL.
 * Keys not already present are appended at the end.
 */
function applyValues(raw: string, updates: Record<string, string>): string {
  const eol = detectEol(raw);
  const lines = raw.split(/\r?\n/);
  const remaining = new Set(Object.keys(updates));

  const out = lines.map((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return line;
    const eq = line.indexOf('=');
    if (eq === -1) return line;
    const key = line.slice(0, eq).trim();
    if (key in updates) {
      remaining.delete(key);
      return `${key}=${updates[key]}`;
    }
    return line;
  });

  for (const key of remaining) {
    out.push(`${key}=${updates[key]}`);
  }
  return out.join(eol);
}

export function writeConfig(payload: ConfigSetPayload): ConfigSetResult {
  const file = propertiesPath();
  try {
    if (!fs.existsSync(file)) {
      return { ok: false, error: 'server.properties が見つかりません。先にサーバー本体をインストールしてください。' };
    }
    if (typeof payload.raw === 'string') {
      fs.writeFileSync(file, payload.raw, 'utf-8');
      return { ok: true };
    }
    if (payload.values) {
      const current = fs.readFileSync(file, 'utf-8');
      fs.writeFileSync(file, applyValues(current, payload.values), 'utf-8');
      return { ok: true };
    }
    return { ok: false, error: '更新内容が指定されていません。' };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}
