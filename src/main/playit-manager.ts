import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { EventEmitter } from 'node:events';
import fs from 'node:fs';
import path from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import type { PlayitState, PlayitStatus } from '../shared/types';
import { binDir, ensureDirs } from './paths';
import { readSettings, writeSettings } from './settings';
import { chmodExec, playitAssetName, playitBinaryName } from './platform';

function playitDownloadUrl(): string {
  return `https://github.com/playit-cloud/playit-agent/releases/latest/download/${playitAssetName()}`;
}

const BROWSER_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)';

// Assigned tunnel address such as "purple-foo.gl.at.ply.gg:23456".
const TUNNEL_RE = /\b([a-z0-9-]+(?:\.[a-z0-9-]+)*\.(?:ply\.gg|playit\.gg))(?::(\d+))?\b/i;

/**
 * Manages the playit.exe agent (daemon). The Windows release is daemon-only and
 * is run as `playit.exe --secret <key>`; the user obtains the secret + configures
 * a Bedrock (UDP 19132) tunnel on the playit.gg dashboard. Emits 'status'.
 */
class PlayitManager extends EventEmitter {
  private child: ChildProcessWithoutNullStreams | null = null;
  private state: PlayitState = 'disabled';
  private detectedAddress?: string;
  private message?: string;
  private buf = '';

  exePath(): string {
    return path.join(binDir(), playitBinaryName());
  }

  isInstalled(): boolean {
    return fs.existsSync(this.exePath());
  }

  private hasSecret(): boolean {
    return !!readSettings().playitSecret;
  }

  getStatus(): PlayitStatus {
    return {
      state: this.state,
      installed: this.isInstalled(),
      hasSecret: this.hasSecret(),
      tunnelAddress: this.detectedAddress ?? readSettings().playitTunnelAddress,
      message: this.message,
    };
  }

  private setState(state: PlayitState, message?: string): void {
    this.state = state;
    this.message = message;
    this.emit('status', this.getStatus());
  }

  setSecret(secret: string): PlayitStatus {
    writeSettings({ playitSecret: secret.trim() });
    if (this.state === 'needs-secret' || this.state === 'disabled') {
      this.setState('disabled', 'Secret saved.');
    } else {
      this.emit('status', this.getStatus());
    }
    return this.getStatus();
  }

  setAddress(address: string): PlayitStatus {
    writeSettings({ playitTunnelAddress: address.trim() });
    this.emit('status', this.getStatus());
    return this.getStatus();
  }

  private async ensureInstalled(): Promise<void> {
    if (this.isInstalled()) return;
    ensureDirs();
    this.setState('installing', `Downloading ${playitBinaryName()}...`);
    const res = await fetch(playitDownloadUrl(), {
      headers: { 'User-Agent': BROWSER_UA },
      redirect: 'follow',
    });
    if (!res.ok || !res.body) {
      throw new Error(`Failed to download playit.exe (HTTP ${res.status})`);
    }
    const tmp = this.exePath() + '.download';
    const reader = res.body.getReader();
    const node = new Readable({
      async read() {
        const { done, value } = await reader.read();
        if (done) return this.push(null);
        this.push(Buffer.from(value));
      },
    });
    await pipeline(node, fs.createWriteStream(tmp));
    fs.renameSync(tmp, this.exePath());
    chmodExec(this.exePath());
  }

  async enable(): Promise<PlayitStatus> {
    if (this.child) return this.getStatus();

    const secret = readSettings().playitSecret;
    if (!secret) {
      this.setState('needs-secret', 'Set your playit.gg secret key.');
      return this.getStatus();
    }

    try {
      await this.ensureInstalled();
    } catch (err) {
      this.setState('error', (err as Error).message);
      return this.getStatus();
    }

    this.detectedAddress = undefined;
    this.setState('starting', 'Starting the playit agent...');

    try {
      this.child = spawn(this.exePath(), ['--secret', secret], {
        windowsHide: true,
      }) as ChildProcessWithoutNullStreams;
    } catch (err) {
      this.setState('error', `Failed to start: ${(err as Error).message}`);
      this.child = null;
      return this.getStatus();
    }

    this.child.stdout.setEncoding('utf-8');
    this.child.stderr.setEncoding('utf-8');
    this.child.stdout.on('data', (c: string) => this.onData(c));
    this.child.stderr.on('data', (c: string) => this.onData(c));
    this.child.on('error', (e) => this.setState('error', e.message));
    this.child.on('exit', () => {
      this.child = null;
      if (this.state !== 'disabled') {
        this.setState('disabled', 'The playit agent has exited.');
      }
    });

    return this.getStatus();
  }

  disable(): PlayitStatus {
    if (this.child) {
      this.child.kill();
      this.child = null;
    }
    this.detectedAddress = undefined;
    this.setState('disabled');
    return this.getStatus();
  }

  private onData(chunk: string): void {
    this.buf += chunk;
    const lines = this.buf.split(/\r?\n/);
    this.buf = lines.pop() ?? '';
    for (const line of lines) {
      if (line.trim()) this.parseLine(line);
    }
  }

  private parseLine(line: string): void {
    if (/InvalidAgentKey|Failed to create agent|playitd error|Setup error/i.test(line)) {
      const auth = /InvalidAgentKey/i.test(line);
      this.setState(
        'error',
        auth ? 'Invalid secret key. Set it again.' : line.trim(),
      );
      return;
    }

    const tunnel = line.match(TUNNEL_RE);
    if (tunnel) {
      this.detectedAddress = tunnel[2] ? `${tunnel[1]}:${tunnel[2]}` : tunnel[1];
      this.setState('connected', 'External access is enabled.');
      return;
    }
    if (
      /authenticated|tunnel.*(running|established|created|connected)|control.*(connected|established)|session established|now serving|setup_account_complete/i.test(
        line,
      )
    ) {
      if (this.state !== 'connected') this.setState('connected', 'External access is enabled.');
    }
  }

  forceStop(): void {
    if (this.child) {
      this.child.kill();
      this.child = null;
    }
  }
}

export const playitManager = new PlayitManager();
