import type { LogLine, ScheduleEntry } from '../shared/types';
import { serverManager } from './server-manager';
import { readSettings, writeSettings } from './settings';

let timer: NodeJS.Timeout | null = null;
// Per-entry "last fired" key (YYYYMMDD-HHMM) to prevent double-fire within a minute.
const lastFired = new Map<string, string>();

const TIME_RE = /^(\d{1,2}):(\d{2})$/;

function pad2(n: number): string {
  return n < 10 ? '0' + n : String(n);
}

function minuteKey(d: Date): string {
  return (
    `${d.getFullYear()}${pad2(d.getMonth() + 1)}${pad2(d.getDate())}` +
    `-${pad2(d.getHours())}${pad2(d.getMinutes())}`
  );
}

export function getSchedule(): ScheduleEntry[] {
  return readSettings().schedule ?? [];
}

export function setSchedule(entries: ScheduleEntry[]): ScheduleEntry[] {
  const sanitized = entries
    .filter((e) => e && typeof e.id === 'string' && e.id.length > 0)
    .map((e) => ({
      id: e.id,
      enabled: !!e.enabled,
      action: e.action === 'start' || e.action === 'stop' || e.action === 'restart' ? e.action : 'start',
      time: typeof e.time === 'string' ? e.time.trim() : '',
      daysOfWeek: Array.isArray(e.daysOfWeek)
        ? e.daysOfWeek.filter((d) => Number.isInteger(d) && d >= 0 && d <= 6)
        : [],
    }));
  writeSettings({ schedule: sanitized });
  return sanitized;
}

function shouldFire(entry: ScheduleEntry, now: Date): boolean {
  if (!entry.enabled) return false;
  if (!entry.daysOfWeek.includes(now.getDay())) return false;
  const m = entry.time.match(TIME_RE);
  if (!m) return false;
  const h = Number(m[1]);
  const mi = Number(m[2]);
  if (h !== now.getHours() || mi !== now.getMinutes()) return false;
  const key = minuteKey(now);
  if (lastFired.get(entry.id) === key) return false;
  lastFired.set(entry.id, key);
  return true;
}

function fire(entry: ScheduleEntry, log: (line: LogLine) => void): void {
  const status = serverManager.getStatus();
  let result;
  let label: string;
  switch (entry.action) {
    case 'start':
      if (status === 'stopped' || status === 'error') {
        label = 'Scheduled start';
        result = serverManager.start();
      } else {
        label = 'Scheduled start (skipped: already running)';
        result = { ok: true };
      }
      break;
    case 'stop':
      if (status === 'running') {
        label = 'Scheduled stop';
        result = serverManager.stop();
      } else {
        label = 'Scheduled stop (skipped: not running)';
        result = { ok: true };
      }
      break;
    case 'restart':
      label = 'Scheduled restart';
      result = serverManager.restart();
      break;
  }
  log({
    id: -Date.now(),
    ts: Date.now(),
    level: result.ok ? 'INFO' : 'ERROR',
    source: 'system',
    text: result.ok ? `${label} executed (${entry.time})` : `${label} failed: ${result.error}`,
  });
}

/** Start a periodic check of schedule entries. Re-reads settings each tick. */
export function startScheduler(log: (line: LogLine) => void): void {
  if (timer) return;
  const tick = () => {
    const now = new Date();
    for (const entry of getSchedule()) {
      if (shouldFire(entry, now)) fire(entry, log);
    }
  };
  // Tick every 30s so a minute is never missed even with drift.
  timer = setInterval(tick, 30_000);
  // Also tick immediately so a scheduled time exactly at boot is honored.
  tick();
}

export function stopScheduler(): void {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}
