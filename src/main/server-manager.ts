import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { EventEmitter } from 'node:events';
import fs from 'node:fs';
import path from 'node:path';
import type { LogLine, LogSource, ServerEvent, ServerStatus, StartResult } from '../shared/types';
import { defaultBedrockExe } from './paths';
import { readSettings } from './settings';
import { detectLevel, parseLogLine } from './log-parser';

let logCounter = 0;

function makeLog(text: string, source: LogSource): LogLine {
  return {
    id: ++logCounter,
    ts: Date.now(),
    level: detectLevel(text),
    source,
    text,
  };
}

/**
 * Manages the lifecycle of the bedrock_server.exe child process.
 * Emits: 'log' (LogLine), 'status' (ServerStatus), 'event' (ServerEvent).
 */
class ServerManager extends EventEmitter {
  private child: ChildProcessWithoutNullStreams | null = null;
  private status: ServerStatus = 'stopped';
  private stdoutBuf = '';
  private stderrBuf = '';
  private stopTimer: NodeJS.Timeout | null = null;
  private intentionalStop = false;
  private startedAt: number | null = null;

  getStatus(): ServerStatus {
    return this.status;
  }

  getPid(): number | null {
    return this.child?.pid ?? null;
  }

  /** Epoch ms when the server reached the running state (null if not running). */
  getStartedAt(): number | null {
    return this.startedAt;
  }

  /** Resolve the server exe: explicit setting wins, else the default data-folder location. */
  resolveExePath(): string | null {
    const settings = readSettings();
    const candidate = settings.bedrockExePath || defaultBedrockExe();
    return fs.existsSync(candidate) ? candidate : null;
  }

  private setStatus(status: ServerStatus): void {
    if (this.status === status) return;
    this.status = status;
    this.emit('status', status);
  }

  private system(text: string): void {
    this.emit('log', makeLog(text, 'system'));
  }

  start(): StartResult {
    if (this.child) {
      return { ok: false, error: 'The server is already running.' };
    }

    const exePath = this.resolveExePath();
    if (!exePath) {
      const msg =
        'bedrock_server.exe was not found. In the Console, select "Select Executable" and choose the server executable you downloaded manually.';
      this.system(msg);
      this.setStatus('error');
      return { ok: false, error: msg };
    }

    const cwd = path.dirname(exePath);
    this.intentionalStop = false;
    this.setStatus('starting');
    this.system(`Starting server: ${exePath}`);

    try {
      this.child = spawn(exePath, [], {
        cwd,
        windowsHide: true,
      }) as ChildProcessWithoutNullStreams;
    } catch (err) {
      const msg = `Failed to start the server: ${(err as Error).message}`;
      this.system(msg);
      this.setStatus('error');
      this.child = null;
      return { ok: false, error: msg };
    }

    this.child.stdout.setEncoding('utf-8');
    this.child.stderr.setEncoding('utf-8');
    this.child.stdout.on('data', (chunk: string) => this.onData(chunk, 'stdout'));
    this.child.stderr.on('data', (chunk: string) => this.onData(chunk, 'stderr'));

    this.child.on('error', (err) => {
      this.system(`Process error: ${err.message}`);
      this.setStatus('error');
    });

    this.child.on('exit', (code, signal) => this.onExit(code, signal));

    return { ok: true };
  }

  stop(): StartResult {
    if (!this.child) {
      return { ok: false, error: 'The server is not running.' };
    }
    this.intentionalStop = true;
    this.setStatus('stopping');
    this.system('Sending stop command...');
    try {
      this.child.stdin.write('stop\n');
    } catch {
      /* if stdin is closed, fall through to force-kill timer */
    }
    // Force-kill if it does not exit within 10s.
    this.stopTimer = setTimeout(() => {
      if (this.child) {
        this.system('The server did not stop in time; forcing it to exit.');
        this.child.kill();
      }
    }, 10_000);
    return { ok: true };
  }

  restart(): StartResult {
    if (this.child) {
      this.once('status', (s: ServerStatus) => {
        if (s === 'stopped') {
          setTimeout(() => this.start(), 500);
        }
      });
      return this.stop();
    }
    return this.start();
  }

  sendCommand(command: string): StartResult {
    const cmd = command.trim();
    if (!cmd) return { ok: false, error: 'Command cannot be empty.' };
    if (!this.child || this.status !== 'running') {
      return { ok: false, error: 'The server is not running.' };
    }
    try {
      this.child.stdin.write(cmd + '\n');
      this.emit('log', makeLog(`> ${cmd}`, 'system'));
      return { ok: true };
    } catch (err) {
      return { ok: false, error: (err as Error).message };
    }
  }

  private onData(chunk: string, source: LogSource): void {
    const isErr = source === 'stderr';
    let buf = (isErr ? this.stderrBuf : this.stdoutBuf) + chunk;
    const lines = buf.split(/\r?\n/);
    buf = lines.pop() ?? '';
    if (isErr) this.stderrBuf = buf;
    else this.stdoutBuf = buf;

    for (const line of lines) {
      if (line.length === 0) continue;
      this.emit('log', makeLog(line, source));
      this.parseEvents(line);
    }
  }

  private parseEvents(line: string): void {
    const parsed = parseLogLine(line);
    if (!parsed) return;

    if (parsed.type === 'server-ready') {
      if (this.status === 'starting') {
        this.startedAt = Date.now();
        this.setStatus('running');
        this.emit('event', { type: 'server-ready', ts: Date.now() } satisfies ServerEvent);
      }
      return;
    }

    this.emit('event', {
      type: parsed.type,
      ts: Date.now(),
      player: parsed.name,
      xuid: parsed.xuid,
    } satisfies ServerEvent);
  }

  private onExit(code: number | null, signal: NodeJS.Signals | null): void {
    if (this.stopTimer) {
      clearTimeout(this.stopTimer);
      this.stopTimer = null;
    }
    this.child = null;
    this.startedAt = null;
    this.stdoutBuf = '';
    this.stderrBuf = '';
    this.system(`Server process exited (code=${code ?? 'null'}, signal=${signal ?? 'null'})`);

    const crashed = !this.intentionalStop && code !== 0;
    if (crashed) {
      this.setStatus('error');
      if (readSettings().autoRestart) {
        this.system('Automatic restart is enabled. Restarting...');
        setTimeout(() => this.start(), 1000);
      }
    } else {
      this.setStatus('stopped');
    }
    this.intentionalStop = false;
  }

  /** Called on app quit to make sure we don't leave an orphan process. */
  forceStop(): void {
    if (this.child) {
      this.intentionalStop = true;
      this.child.kill();
    }
  }
}

export const serverManager = new ServerManager();
