import fs from 'node:fs';

export const isWindows = process.platform === 'win32';
export const isLinux = process.platform === 'linux';

/** Filename of the official Bedrock server binary on this platform. */
export function bedrockBinaryName(): string {
  return isWindows ? 'bedrock_server.exe' : 'bedrock_server';
}

/** Filename of the playit agent binary on this platform. */
export function playitBinaryName(): string {
  return isWindows ? 'playit.exe' : 'playit';
}

/** Subpath used by Microsoft's BDS download CDN for this platform. */
export function bdsCdnSubdir(): 'bin-win' | 'bin-linux' {
  return isWindows ? 'bin-win' : 'bin-linux';
}

/** Asset name on the playit-agent GitHub release. */
export function playitAssetName(): string {
  return isWindows ? 'playit-windows-x86_64-signed.exe' : 'playit-linux-amd64';
}

interface VersionsJsonLike {
  windows: { stable: string };
  linux: { stable: string };
}

export function platformStableVersion(j: VersionsJsonLike): string {
  return isWindows ? j.windows.stable : j.linux.stable;
}

/** Mark a path executable on POSIX systems; no-op on Windows. */
export function chmodExec(p: string): void {
  if (isWindows) return;
  try {
    fs.chmodSync(p, 0o755);
  } catch {
    /* best effort */
  }
}
