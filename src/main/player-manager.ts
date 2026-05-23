import fs from 'node:fs';
import path from 'node:path';
import type {
  AllowlistEntry,
  KnownPlayer,
  PermissionEntry,
  PlayerActionResult,
} from '../shared/types';
import { bedrockDir, configDir, ensureDirs } from './paths';

function allowlistPath(): string {
  return path.join(bedrockDir(), 'allowlist.json');
}
function permissionsPath(): string {
  return path.join(bedrockDir(), 'permissions.json');
}
function knownPlayersPath(): string {
  return path.join(configDir(), 'known-players.json');
}

function readJsonArray<T>(file: string): T[] {
  try {
    const parsed = JSON.parse(fs.readFileSync(file, 'utf-8'));
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

function writeJson(file: string, data: unknown): PlayerActionResult {
  try {
    fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf-8');
    return { ok: true };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

// --- Allowlist ---

export function getAllowlist(): AllowlistEntry[] {
  return readJsonArray<AllowlistEntry>(allowlistPath()).map((e) => ({
    ignoresPlayerLimit: !!e.ignoresPlayerLimit,
    name: e.name,
    ...(e.xuid ? { xuid: e.xuid } : {}),
  }));
}

export function setAllowlist(entries: AllowlistEntry[]): PlayerActionResult {
  if (!fs.existsSync(bedrockDir())) {
    return { ok: false, error: 'サーバー本体が未インストールです。' };
  }
  const clean = entries
    .filter((e) => e.name && e.name.trim())
    .map((e) => ({
      ignoresPlayerLimit: !!e.ignoresPlayerLimit,
      name: e.name.trim(),
      ...(e.xuid ? { xuid: e.xuid } : {}),
    }));
  return writeJson(allowlistPath(), clean);
}

// --- Permissions (operators) ---

export function getPermissions(): PermissionEntry[] {
  return readJsonArray<PermissionEntry>(permissionsPath())
    .filter((e) => e.xuid)
    .map((e) => ({ permission: e.permission ?? 'member', xuid: String(e.xuid) }));
}

export function setPermissions(entries: PermissionEntry[]): PlayerActionResult {
  if (!fs.existsSync(bedrockDir())) {
    return { ok: false, error: 'サーバー本体が未インストールです。' };
  }
  const clean = entries
    .filter((e) => e.xuid && e.xuid.trim())
    .map((e) => ({ permission: e.permission, xuid: e.xuid.trim() }));
  return writeJson(permissionsPath(), clean);
}

// --- Known players (captured from connection logs) ---

export function getKnownPlayers(): KnownPlayer[] {
  return readJsonArray<KnownPlayer>(knownPlayersPath());
}

export function recordKnownPlayer(name: string, xuid?: string): void {
  if (!xuid) return;
  ensureDirs();
  const players = getKnownPlayers();
  const idx = players.findIndex((p) => p.xuid === xuid);
  if (idx >= 0) {
    players[idx].name = name;
  } else {
    players.push({ name, xuid });
  }
  writeJson(knownPlayersPath(), players);
}
