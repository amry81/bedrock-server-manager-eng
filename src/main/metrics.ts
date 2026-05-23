import os from 'node:os';
import pidusage from 'pidusage';
import type { SystemMetrics } from '../shared/types';
import { serverManager } from './server-manager';

let timer: NodeJS.Timeout | null = null;

/**
 * Sample the bedrock_server process every second and invoke `onSample`.
 * Emits nothing while the server is not running.
 */
export function startMetricsSampler(onSample: (m: SystemMetrics) => void): void {
  if (timer) return;
  timer = setInterval(async () => {
    const pid = serverManager.getPid();
    const startedAt = serverManager.getStartedAt();
    if (!pid || serverManager.getStatus() !== 'running') return;

    try {
      const stat = await pidusage(pid);
      onSample({
        ts: Date.now(),
        cpu: Math.round(stat.cpu * 10) / 10,
        memoryMB: Math.round((stat.memory / 1024 / 1024) * 10) / 10,
        uptimeSec: startedAt ? Math.floor((Date.now() - startedAt) / 1000) : 0,
      });
    } catch {
      /* process may have exited between checks */
    }
  }, 1000);
}

export function stopMetricsSampler(): void {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}

/** Best-effort LAN IPv4 address (spec 3.7: shown when tunneling is off). */
export function getLanAddress(): string | null {
  const ifaces = os.networkInterfaces();
  for (const name of Object.keys(ifaces)) {
    for (const net of ifaces[name] ?? []) {
      if (net.family === 'IPv4' && !net.internal) {
        return net.address;
      }
    }
  }
  return null;
}
