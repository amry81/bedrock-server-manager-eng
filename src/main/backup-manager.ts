import fs from 'node:fs';
import path from 'node:path';
import AdmZip from 'adm-zip';
import type { BackupInfo, BackupResult, BackupSettings } from '../shared/types';
import { backupsDir, bedrockDir } from './paths';
import { readSettings, writeSettings } from './settings';

function worldsDir(): string {
  return path.join(bedrockDir(), 'worlds');
}

function tsStamp(d = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return (
    `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}` +
    `-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`
  );
}

export function getBackupSettings(): BackupSettings {
  const s = readSettings();
  return {
    autoBackupOnStop: s.autoBackupOnStop ?? false,
    maxBackupsPerWorld: s.maxBackupsPerWorld ?? 10,
  };
}

export function setBackupSettings(next: BackupSettings): BackupSettings {
  writeSettings({
    autoBackupOnStop: next.autoBackupOnStop,
    maxBackupsPerWorld: Math.max(1, Math.min(100, Math.floor(next.maxBackupsPerWorld) || 10)),
  });
  return getBackupSettings();
}

export function listBackups(): BackupInfo[] {
  const root = backupsDir();
  if (!fs.existsSync(root)) return [];
  const out: BackupInfo[] = [];
  for (const world of fs.readdirSync(root, { withFileTypes: true })) {
    if (!world.isDirectory()) continue;
    const dir = path.join(root, world.name);
    for (const f of fs.readdirSync(dir)) {
      if (!f.toLowerCase().endsWith('.zip')) continue;
      const full = path.join(dir, f);
      const stat = fs.statSync(full);
      out.push({
        id: `${world.name}/${f}`,
        world: world.name,
        ts: stat.mtimeMs,
        sizeBytes: stat.size,
      });
    }
  }
  return out.sort((a, b) => b.ts - a.ts);
}

function backupFilePath(id: string): string {
  // id is "<world>/<file>.zip" — keep it strictly under backupsDir.
  const resolved = path.resolve(backupsDir(), id);
  if (!resolved.startsWith(path.resolve(backupsDir()))) {
    throw new Error('不正なバックアップIDです。');
  }
  return resolved;
}

function pruneOldBackups(world: string): void {
  const max = getBackupSettings().maxBackupsPerWorld;
  const dir = path.join(backupsDir(), world);
  if (!fs.existsSync(dir)) return;
  const files = fs
    .readdirSync(dir)
    .filter((f) => f.toLowerCase().endsWith('.zip'))
    .map((f) => ({ f, t: fs.statSync(path.join(dir, f)).mtimeMs }))
    .sort((a, b) => b.t - a.t);
  for (const old of files.slice(max)) {
    try {
      fs.unlinkSync(path.join(dir, old.f));
    } catch {
      /* ignore */
    }
  }
}

export function createBackup(world: string): BackupResult {
  const src = path.join(worldsDir(), world);
  if (!fs.existsSync(src)) {
    return { ok: false, error: 'ワールドが見つかりません。' };
  }
  try {
    const destDir = path.join(backupsDir(), world);
    fs.mkdirSync(destDir, { recursive: true });
    const fileName = `${tsStamp()}.zip`;
    const dest = path.join(destDir, fileName);

    const zip = new AdmZip();
    // Nest under the world folder name so restore recreates worlds/<world>/.
    zip.addLocalFolder(src, world);
    zip.writeZip(dest);

    pruneOldBackups(world);
    return { ok: true, id: `${world}/${fileName}` };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

export function restoreBackup(id: string): BackupResult {
  let file: string;
  try {
    file = backupFilePath(id);
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
  if (!fs.existsSync(file)) return { ok: false, error: 'バックアップが見つかりません。' };

  const world = id.split('/')[0];
  const target = path.join(worldsDir(), world);
  const tempOld = target + `.restore-old-${Date.now()}`;

  try {
    const zip = new AdmZip(file);
    // Move current world aside so we can roll back on failure.
    if (fs.existsSync(target)) fs.renameSync(target, tempOld);
    zip.extractAllTo(worldsDir(), /*overwrite*/ true);

    if (!fs.existsSync(target)) {
      throw new Error('展開後にワールドフォルダが見つかりません。');
    }
    // Success: drop the old copy.
    if (fs.existsSync(tempOld)) fs.rmSync(tempOld, { recursive: true, force: true });
    return { ok: true, id };
  } catch (err) {
    // Roll back.
    try {
      if (fs.existsSync(tempOld)) {
        if (fs.existsSync(target)) fs.rmSync(target, { recursive: true, force: true });
        fs.renameSync(tempOld, target);
      }
    } catch {
      /* best effort */
    }
    return { ok: false, error: (err as Error).message };
  }
}

export function deleteBackup(id: string): BackupResult {
  try {
    const file = backupFilePath(id);
    if (fs.existsSync(file)) fs.unlinkSync(file);
    return { ok: true, id };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}
