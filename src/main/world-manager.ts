import fs from 'node:fs';
import path from 'node:path';
import AdmZip from 'adm-zip';
import type {
  CreateWorldInput,
  WorldActionResult,
  WorldImportResult,
  WorldInfo,
} from '../shared/types';
import { bedrockDir } from './paths';
import { readConfig, writeConfig } from './config-manager';

function worldsDir(): string {
  return path.join(bedrockDir(), 'worlds');
}

/** Strip characters that are illegal in Windows folder names. */
function sanitizeFolderName(name: string): string {
  return name
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, '')
    .replace(/\.+$/, '')
    .trim();
}

function isGenerated(dir: string): boolean {
  return fs.existsSync(path.join(dir, 'level.dat')) || fs.existsSync(path.join(dir, 'db'));
}

function readLevelName(dir: string, fallback: string): string {
  try {
    const txt = fs.readFileSync(path.join(dir, 'levelname.txt'), 'utf-8').trim();
    return txt || fallback;
  } catch {
    return fallback;
  }
}

export function listWorlds(): WorldInfo[] {
  const dir = worldsDir();
  if (!fs.existsSync(dir)) return [];
  const activeLevel = readConfig().values['level-name'] ?? '';

  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => {
      const full = path.join(dir, e.name);
      return {
        name: e.name,
        displayName: readLevelName(full, e.name),
        active: e.name === activeLevel,
        generated: isGenerated(full),
      };
    })
    .sort((a, b) => Number(b.active) - Number(a.active) || a.name.localeCompare(b.name));
}

/**
 * Create a new world folder and make it active. BDS generates the actual level
 * data on next start using the seed/gamemode/difficulty written to server.properties.
 */
export function createWorld(input: CreateWorldInput): WorldActionResult {
  const folder = sanitizeFolderName(input.name);
  if (!folder) return { ok: false, error: 'Invalid world name.' };

  const dir = worldsDir();
  fs.mkdirSync(dir, { recursive: true });
  const target = path.join(dir, folder);
  if (fs.existsSync(target)) {
    return { ok: false, error: 'A world with that name already exists.' };
  }

  try {
    fs.mkdirSync(target, { recursive: true });
    fs.writeFileSync(path.join(target, 'levelname.txt'), input.name, 'utf-8');

    const values: Record<string, string> = {
      'level-name': folder,
      gamemode: input.gamemode,
      difficulty: input.difficulty,
    };
    if (input.seed !== undefined) values['level-seed'] = input.seed;

    const res = writeConfig({ values });
    if (!res.ok) return res;
    return { ok: true };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

export function switchWorld(name: string): WorldActionResult {
  const target = path.join(worldsDir(), name);
  if (!fs.existsSync(target)) {
    return { ok: false, error: 'World not found.' };
  }
  return writeConfig({ values: { 'level-name': name } });
}

export function worldFolderPath(name: string): string {
  return path.join(worldsDir(), name);
}

function uniqueWorldFolder(base: string): string {
  const dir = worldsDir();
  let name = base;
  let i = 2;
  while (fs.existsSync(path.join(dir, name))) {
    name = `${base} (${i++})`;
  }
  return name;
}

/**
 * Import a Bedrock world export (.mcworld zip) as a new world folder.
 * Handles both flat archives (level.dat at root) and archives nested in one
 * top-level folder. Picks a unique folder name based on levelname.txt or filename.
 */
export function importWorld(srcPath: string): WorldImportResult {
  if (!fs.existsSync(srcPath)) {
    return { ok: false, error: 'File not found.' };
  }
  try {
    const zip = new AdmZip(srcPath);
    const entries = zip.getEntries();
    if (entries.length === 0) {
      return { ok: false, error: 'The file is empty.' };
    }

    // If everything is nested under a single top-level folder, strip it.
    const topSegments = new Set(
      entries
        .map((e) => e.entryName.replace(/\\/g, '/').split('/')[0])
        .filter((s) => s.length > 0),
    );
    const hasSlash = entries.some((e) => e.entryName.includes('/'));
    const stripTop = topSegments.size === 1 && hasSlash;

    // Try to read levelname.txt for the display name.
    let display: string | null = null;
    const lnEntry = entries.find(
      (e) => !e.isDirectory && /(^|\/)levelname\.txt$/i.test(e.entryName),
    );
    if (lnEntry) {
      try {
        display = lnEntry.getData().toString('utf-8').trim();
      } catch {
        /* ignore */
      }
    }
    if (!display) display = path.basename(srcPath, path.extname(srcPath));

    const base = sanitizeFolderName(display) || 'Imported World';
    const folder = uniqueWorldFolder(base);
    const target = path.join(worldsDir(), folder);
    fs.mkdirSync(target, { recursive: true });

    let extracted = 0;
    for (const e of entries) {
      if (e.isDirectory) continue;
      let name = e.entryName.replace(/\\/g, '/');
      if (stripTop) {
        const idx = name.indexOf('/');
        if (idx >= 0) name = name.slice(idx + 1);
        if (!name) continue;
      }
      // Guard against path traversal.
      const out = path.resolve(target, name);
      if (!out.startsWith(path.resolve(target))) continue;
      fs.mkdirSync(path.dirname(out), { recursive: true });
      fs.writeFileSync(out, e.getData());
      extracted++;
    }

    if (extracted === 0) {
      fs.rmSync(target, { recursive: true, force: true });
      return { ok: false, error: 'Could not extract the world data.' };
    }

    // Make sure levelname.txt exists so the world list shows a name.
    const lnPath = path.join(target, 'levelname.txt');
    if (!fs.existsSync(lnPath)) {
      fs.writeFileSync(lnPath, display, 'utf-8');
    }

    return { ok: true, worldName: folder };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

/**
 * Ensure a world folder exists for the configured level-name so a fresh install
 * lands with a default world (spec 5). BDS generates the actual level data on
 * first start.
 */
export function ensureDefaultWorld(): void {
  const level = readConfig().values['level-name']?.trim() || 'Bedrock level';
  const dir = path.join(worldsDir(), level);
  if (fs.existsSync(dir)) return;
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'levelname.txt'), level, 'utf-8');
}
