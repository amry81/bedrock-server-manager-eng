import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import AdmZip from 'adm-zip';
import type {
  AddonActionResult,
  AddonImportResult,
  AddonPack,
  AddonType,
  WorldPackEntry,
  WorldPacks,
} from '../shared/types';
import { bedrockDir } from './paths';

function behaviorDir(): string {
  return path.join(bedrockDir(), 'behavior_packs');
}
function resourceDir(): string {
  return path.join(bedrockDir(), 'resource_packs');
}
function worldDir(world: string): string {
  return path.join(bedrockDir(), 'worlds', world);
}

interface ManifestModule {
  type?: string;
  uuid?: string;
  version?: number[];
}
interface Manifest {
  header?: {
    name?: string;
    description?: string;
    uuid?: string;
    version?: number[];
  };
  modules?: ManifestModule[];
}

function sanitizeFolderName(name: string): string {
  return (
    name
      .replace(/[<>:"/\\|?*\x00-\x1f]/g, '')
      .replace(/\s+/g, ' ')
      .replace(/\.+$/, '')
      .trim() || 'pack'
  );
}

function readManifestFromDir(dir: string): Manifest | null {
  const file = path.join(dir, 'manifest.json');
  if (!fs.existsSync(file)) return null;
  try {
    // Some packs have a UTF-8 BOM or `// ...` comments. Strip BOM; tolerate trailing/leading whitespace.
    let text = fs.readFileSync(file, 'utf-8');
    if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
    return JSON.parse(text) as Manifest;
  } catch {
    return null;
  }
}

/** Type of an addon pack based on its first module's `type` field. */
function packType(m: Manifest): AddonType | null {
  const mod = m.modules?.[0]?.type;
  if (mod === 'resources') return 'resource';
  if (mod === 'data' || mod === 'script' || mod === 'client_data') return 'behavior';
  return null;
}

function packFromManifest(m: Manifest, folder: string, type: AddonType): AddonPack | null {
  const h = m.header ?? {};
  if (!h.uuid || !Array.isArray(h.version)) return null;
  return {
    type,
    folder,
    uuid: h.uuid,
    version: h.version,
    name: h.name?.trim() || folder,
    description: h.description,
  };
}

function listAddonsInDir(dir: string, type: AddonType): AddonPack[] {
  if (!fs.existsSync(dir)) return [];
  const out: AddonPack[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const full = path.join(dir, entry.name);
    const m = readManifestFromDir(full);
    if (!m) continue;
    const detected = packType(m) ?? type;
    if (detected !== type) continue;
    const p = packFromManifest(m, entry.name, type);
    if (p) out.push(p);
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}

export function listAddons(): AddonPack[] {
  return [...listAddonsInDir(behaviorDir(), 'behavior'), ...listAddonsInDir(resourceDir(), 'resource')];
}

/**
 * Walk an extracted directory tree and return every pack root (folders containing
 * a valid manifest.json). Used when unpacking .mcaddon bundles.
 */
function findPackRoots(root: string): string[] {
  const found: string[] = [];
  const stack: string[] = [root];
  while (stack.length) {
    const dir = stack.pop()!;
    if (fs.existsSync(path.join(dir, 'manifest.json'))) {
      found.push(dir);
      continue; // Don't descend into a pack root.
    }
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (e.isDirectory()) stack.push(path.join(dir, e.name));
    }
  }
  return found;
}

function uniqueTarget(parent: string, base: string): string {
  let name = base;
  let i = 2;
  while (fs.existsSync(path.join(parent, name))) {
    name = `${base} (${i++})`;
  }
  return path.join(parent, name);
}

function installFromPackDir(packDir: string): { type: AddonType; name: string } | null {
  const m = readManifestFromDir(packDir);
  if (!m) return null;
  const type = packType(m);
  if (!type) return null;
  const base = m.header?.name ? sanitizeFolderName(m.header.name) : sanitizeFolderName(path.basename(packDir));
  const targetParent = type === 'behavior' ? behaviorDir() : resourceDir();
  fs.mkdirSync(targetParent, { recursive: true });
  const uuid = m.header?.uuid ?? '';
  const target = uniqueTarget(targetParent, `${base}_${uuid.slice(0, 8)}`);
  // Copy the pack folder contents.
  fs.cpSync(packDir, target, { recursive: true });
  return { type, name: m.header?.name?.trim() || path.basename(target) };
}

function extractZipToTemp(zipPath: string): string {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'bsm-addon-'));
  new AdmZip(zipPath).extractAllTo(tmp, true);
  return tmp;
}

export function importAddons(filePaths: string[]): AddonImportResult {
  if (filePaths.length === 0) return { ok: false, cancelled: true };
  const imported: { type: AddonType; name: string }[] = [];
  try {
    for (const src of filePaths) {
      const ext = path.extname(src).toLowerCase();
      // .mcpack and .mcaddon are both zip files; treat .zip the same way.
      const tmp = extractZipToTemp(src);
      try {
        // Single-pack .mcpack usually has manifest.json at the temp root; .mcaddon
        // may contain multiple nested .mcpack files OR multiple pack folders.
        const nestedMcpacks: string[] = [];
        const stack: string[] = [tmp];
        while (stack.length) {
          const dir = stack.pop()!;
          for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
            const full = path.join(dir, e.name);
            if (e.isDirectory()) stack.push(full);
            else if (/\.(mcpack|zip)$/i.test(e.name)) nestedMcpacks.push(full);
          }
        }

        for (const nested of nestedMcpacks) {
          const nt = extractZipToTemp(nested);
          try {
            for (const pd of findPackRoots(nt)) {
              const res = installFromPackDir(pd);
              if (res) imported.push(res);
            }
          } finally {
            fs.rmSync(nt, { recursive: true, force: true });
          }
        }

        for (const pd of findPackRoots(tmp)) {
          const res = installFromPackDir(pd);
          if (res) imported.push(res);
        }
      } finally {
        fs.rmSync(tmp, { recursive: true, force: true });
      }
      // Touch ext so it's clearly part of the trace if needed in the future.
      void ext;
    }
    if (imported.length === 0) {
      return { ok: false, error: '有効な manifest.json を含むパックが見つかりませんでした。' };
    }
    return { ok: true, imported };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

export function deleteAddon(type: AddonType, folder: string): AddonActionResult {
  const parent = type === 'behavior' ? behaviorDir() : resourceDir();
  const target = path.resolve(parent, folder);
  if (!target.startsWith(path.resolve(parent))) {
    return { ok: false, error: '不正なフォルダ指定です。' };
  }
  if (!fs.existsSync(target)) return { ok: false, error: 'パックが見つかりません。' };
  try {
    fs.rmSync(target, { recursive: true, force: true });
    return { ok: true };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

function readPackList(file: string): WorldPackEntry[] {
  if (!fs.existsSync(file)) return [];
  try {
    let text = fs.readFileSync(file, 'utf-8');
    if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
    const parsed = JSON.parse(text);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((e: WorldPackEntry) => e && typeof e.pack_id === 'string' && Array.isArray(e.version))
      .map((e: WorldPackEntry) => ({ pack_id: e.pack_id, version: e.version }));
  } catch {
    return [];
  }
}

function writePackList(file: string, list: WorldPackEntry[]): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(list, null, 2), 'utf-8');
}

export function getWorldPacks(world: string): WorldPacks {
  const dir = worldDir(world);
  return {
    behavior: readPackList(path.join(dir, 'world_behavior_packs.json')),
    resource: readPackList(path.join(dir, 'world_resource_packs.json')),
  };
}

export function setWorldPacks(world: string, packs: WorldPacks): AddonActionResult {
  try {
    const dir = worldDir(world);
    if (!fs.existsSync(dir)) return { ok: false, error: 'ワールドが見つかりません。' };
    writePackList(path.join(dir, 'world_behavior_packs.json'), packs.behavior);
    writePackList(path.join(dir, 'world_resource_packs.json'), packs.resource);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}
