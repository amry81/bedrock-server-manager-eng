import { useServerStore } from '../store/server-store';
import MetricChart from '../components/MetricChart';
import type { ServerStatus } from '@shared/types';

const STATUS_LABEL: Record<ServerStatus, string> = {
  stopped: 'Stopped',
  starting: 'Starting',
  running: 'Running',
  stopping: 'Stopping',
  error: 'Error',
};

const STATUS_COLOR: Record<ServerStatus, string> = {
  stopped: 'text-neutral-400',
  starting: 'text-yellow-400',
  running: 'text-emerald-400',
  stopping: 'text-yellow-400',
  error: 'text-red-400',
};

function fmtUptime(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

export default function Dashboard() {
  const status = useServerStore((s) => s.status);
  const metrics = useServerStore((s) => s.metrics);
  const onlinePlayers = useServerStore((s) => s.onlinePlayers);
  const lanAddress = useServerStore((s) => s.lanAddress);
  const logs = useServerStore((s) => s.logs);

  const last = metrics[metrics.length - 1];
  const cpuSeries = metrics.map((m) => m.cpu);
  const memSeries = metrics.map((m) => m.memoryMB);
  const port = '19132';
  const lanFull = lanAddress ? `${lanAddress}:${port}` : 'LAN address unavailable';
  const recentLogs = logs.slice(-10);

  return (
    <div className="p-8 space-y-6 max-w-4xl">
      <h2 className="text-2xl font-semibold">Dashboard</h2>

      {/* Status + connection */}
      <div className="grid grid-cols-3 gap-4">
        <div className="col-span-1 rounded-lg border border-neutral-800 bg-neutral-900 p-5">
          <p className="text-xs text-neutral-400">Server Status</p>
          <p className={'mt-1 text-2xl font-bold ' + STATUS_COLOR[status]}>
            {STATUS_LABEL[status]}
          </p>
          <p className="mt-3 text-xs text-neutral-400">Uptime</p>
          <p className="text-sm text-neutral-200">
            {status === 'running' && last ? fmtUptime(last.uptimeSec) : '—'}
          </p>
        </div>

        <div className="col-span-2 rounded-lg border border-neutral-800 bg-neutral-900 p-5">
          <p className="text-xs text-neutral-400">Connection Address (LAN)</p>
          <div className="mt-1 flex items-center gap-2">
            <code className="rounded bg-neutral-800 px-2 py-1 text-sm text-emerald-300">
              {lanFull}
            </code>
            {lanAddress && (
              <button
                type="button"
                onClick={() => navigator.clipboard.writeText(lanFull)}
                className="rounded bg-neutral-700 px-2 py-1 text-xs text-neutral-200 hover:bg-neutral-600"
              >
                Copy
              </button>
            )}
          </div>
          <p className="mt-3 text-xs text-neutral-400">Online Players</p>
          <p className="text-sm text-neutral-200">{onlinePlayers.length}</p>
          <p className="mt-2 text-xs text-neutral-500">
            {status === 'running'
              ? 'Share the address above with your friends so they can join. Enable external connections in Config.'
              : 'Select “▶ Start Server” to begin, then share the displayed address with your friends.'}
          </p>
        </div>
      </div>

      {/* Metrics charts */}
      <div className="grid grid-cols-2 gap-4">
        <MetricChart
          data={cpuSeries}
          color="#34d399"
          unit="%"
          label="CPU Usage (Last 5 Minutes)"
          current={last?.cpu ?? 0}
        />
        <MetricChart
          data={memSeries}
          color="#60a5fa"
          unit="MB"
          label="Memory Usage (Last 5 Minutes)"
          current={last?.memoryMB ?? 0}
        />
      </div>
      {status !== 'running' && (
        <p className="text-xs text-neutral-500">
          Charts update every second while the server is running.
        </p>
      )}

      {/* Recent logs */}
      <div className="rounded-lg border border-neutral-800 bg-neutral-900 p-4">
        <p className="mb-2 text-xs text-neutral-400">Recent Logs</p>
        {recentLogs.length === 0 ? (
          <p className="text-xs text-neutral-600">No logs yet.</p>
        ) : (
          <div className="space-y-0.5 font-mono text-xs">
            {recentLogs.map((l) => (
              <div key={l.id} className="truncate text-neutral-400">
                {l.text}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
