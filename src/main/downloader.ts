import fs from 'node:fs';
import path from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import AdmZip from 'adm-zip';
import type { DownloadProgress, DownloadResult, InstallState } from '../shared/types';
import { bedrockDir, binDir, defaultBedrockExe, ensureDirs } from './paths';
import { readSettings, writeSettings } from './settings';
import { ensureDefaultWorld } from './world-manager';
import { bdsCdnSubdir, chmodExec, platformStableVersion } from './platform';

const VERSIONS_URL =
  'https://raw.githubusercontent.com/Bedrock-OSS/BDS-Versions/main/versions.json';

// Microsoft serves the official zip with a User-Agent check; present a browser UA (spec 9).
const BROWSER_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

// Top-level entries to keep on update so the user's world/config survives (spec 3.3).
const PRESERVE_ON_UPDATE = new Set([
  'worlds',
  'server.properties',
  'allowlist.json',
  'permissions.json',
  'whitelist.json',
]);

interface PlatformVersions {
  stable: string;
  preview?: string;
  versions: string[];
}

interface VersionsJson {
  cdn_root: string;
  windows: PlatformVersions;
  linux: PlatformVersions;
}

type ProgressCb = (p: DownloadProgress) => void;

async function fetchVersions(): Promise<VersionsJson> {
  const res = await fetch(VERSIONS_URL, { headers: { 'User-Agent': BROWSER_UA } });
  if (!res.ok) throw new Error(`versions.json の取得に失敗 (HTTP ${res.status})`);
  return (await res.json()) as VersionsJson;
}

function buildDownloadUrl(cdnRoot: string, version: string): string {
  return `${cdnRoot.replace(/\/$/, '')}/${bdsCdnSubdir()}/bedrock-server-${version}.zip`;
}

/** Numeric "1.26.23.1" comparison. Returns >0 if a is newer than b. */
function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d !== 0) return d;
  }
  return 0;
}

export async function getInstallState(): Promise<InstallState> {
  const settings = readSettings();
  const installed = fs.existsSync(defaultBedrockExe());
  const currentVersion = installed ? settings.installedVersion ?? null : null;

  let latestVersion: string | null = null;
  try {
    latestVersion = platformStableVersion(await fetchVersions());
  } catch {
    latestVersion = null;
  }

  const updateAvailable =
    installed &&
    !!latestVersion &&
    !!currentVersion &&
    compareVersions(latestVersion, currentVersion) > 0;

  return {
    installed,
    currentVersion,
    latestVersion,
    updateAvailable,
    eulaAccepted: !!settings.eulaAcceptedAt,
  };
}

/** Resolve which URL+version to download: manual override wins, else stable from the list. */
async function resolveTarget(): Promise<{ url: string; version: string }> {
  const override = readSettings().downloadUrlOverride;
  if (override) {
    const m = override.match(/bedrock-server-([\d.]+)\.zip/i);
    return { url: override, version: m?.[1] ?? 'unknown' };
  }
  const versions = await fetchVersions();
  const version = platformStableVersion(versions);
  return { url: buildDownloadUrl(versions.cdn_root, version), version };
}

async function downloadZip(url: string, dest: string, onProgress: ProgressCb): Promise<void> {
  const res = await fetch(url, { headers: { 'User-Agent': BROWSER_UA } });
  if (!res.ok || !res.body) {
    throw new Error(`ダウンロードに失敗 (HTTP ${res.status})`);
  }
  const total = Number(res.headers.get('content-length')) || 0;
  let received = 0;

  const reader = res.body.getReader();
  const out = fs.createWriteStream(dest);
  const nodeStream = new Readable({
    async read() {
      try {
        const { done, value } = await reader.read();
        if (done) {
          this.push(null);
          return;
        }
        received += value.length;
        onProgress({
          phase: 'downloading',
          receivedBytes: received,
          totalBytes: total || undefined,
          percent: total ? Math.round((received / total) * 100) : undefined,
        });
        this.push(Buffer.from(value));
      } catch (err) {
        this.destroy(err as Error);
      }
    },
  });
  await pipeline(nodeStream, out);
}

function extractZip(zipPath: string, isUpdate: boolean): void {
  const zip = new AdmZip(zipPath);
  const target = bedrockDir();
  fs.mkdirSync(target, { recursive: true });

  for (const entry of zip.getEntries()) {
    const topSegment = entry.entryName.replace(/\\/g, '/').split('/')[0];
    if (isUpdate && PRESERVE_ON_UPDATE.has(topSegment)) continue;
    if (entry.isDirectory) continue;
    zip.extractEntryTo(entry, target, /*maintainEntryPath*/ true, /*overwrite*/ true);
  }
}

export async function downloadServer(onProgress: ProgressCb): Promise<DownloadResult> {
  ensureDirs();
  try {
    onProgress({ phase: 'resolving', message: 'バージョン情報を取得しています...' });
    const { url, version } = await resolveTarget();
    onProgress({ phase: 'resolving', version, message: `バージョン ${version} を取得します` });

    const isUpdate = fs.existsSync(defaultBedrockExe());
    const tmpZip = path.join(binDir(), `bedrock-server-${version}.download.zip`);

    await downloadZip(url, tmpZip, onProgress);

    onProgress({ phase: 'extracting', version, message: '展開しています...' });
    extractZip(tmpZip, isUpdate);
    try {
      fs.unlinkSync(tmpZip);
    } catch {
      /* ignore temp cleanup failure */
    }

    // Point the server at the freshly-installed canonical exe.
    writeSettings({ installedVersion: version, bedrockExePath: defaultBedrockExe() });
    // POSIX: ensure the extracted binary is executable.
    chmodExec(defaultBedrockExe());

    // Make sure a default world folder exists for the configured level-name.
    try {
      ensureDefaultWorld();
    } catch {
      /* non-fatal: BDS will generate it on first start */
    }

    onProgress({ phase: 'done', version, percent: 100, message: '完了しました' });
    return { ok: true, version };
  } catch (err) {
    const message = (err as Error).message;
    onProgress({ phase: 'error', error: message });
    return { ok: false, error: message };
  }
}
