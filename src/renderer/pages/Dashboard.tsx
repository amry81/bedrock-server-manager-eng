import { useServerStore } from '../store/server-store';
import MetricChart from '../components/MetricChart';
import type { ServerStatus } from '@shared/types';

const STATUS_LABEL: Record<ServerStatus, string> = {
  stopped: '停止中',
  starting: '起動中',
  running: '起動済み',
  stopping: '停止処理中',
  error: 'エラー',
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
  if (h > 0) return `${h}時間 ${m}分 ${s}秒`;
  if (m > 0) return `${m}分 ${s}秒`;
  return `${s}秒`;
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
  const lanFull = lanAddress ? `${lanAddress}:${port}` : 'LAN アドレス取得不可';
  const recentLogs = logs.slice(-10);

  return (
    <div className="p-8 space-y-6 max-w-4xl">
      <h2 className="text-2xl font-semibold">Dashboard</h2>

      {/* Status + connection */}
      <div className="grid grid-cols-3 gap-4">
        <div className="col-span-1 rounded-lg border border-neutral-800 bg-neutral-900 p-5">
          <p className="text-xs text-neutral-400">サーバー状態</p>
          <p className={'mt-1 text-2xl font-bold ' + STATUS_COLOR[status]}>
            {STATUS_LABEL[status]}
          </p>
          <p className="mt-3 text-xs text-neutral-400">稼働時間</p>
          <p className="text-sm text-neutral-200">
            {status === 'running' && last ? fmtUptime(last.uptimeSec) : '—'}
          </p>
        </div>

        <div className="col-span-2 rounded-lg border border-neutral-800 bg-neutral-900 p-5">
          <p className="text-xs text-neutral-400">接続アドレス（LAN内）</p>
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
                コピー
              </button>
            )}
          </div>
          <p className="mt-3 text-xs text-neutral-400">オンラインプレイヤー</p>
          <p className="text-sm text-neutral-200">{onlinePlayers.length} 人</p>
          <p className="mt-2 text-xs text-neutral-500">
            {status === 'running'
              ? '上のアドレスを友達に送ると参加できます。外部接続は Config から有効化できます。'
              : '「▶ サーバーを起動」で開始 → 表示されるアドレスを友達に共有してください。'}
          </p>
        </div>
      </div>

      {/* Metrics charts */}
      <div className="grid grid-cols-2 gap-4">
        <MetricChart
          data={cpuSeries}
          color="#34d399"
          unit="%"
          label="CPU 使用率（直近5分）"
          current={last?.cpu ?? 0}
        />
        <MetricChart
          data={memSeries}
          color="#60a5fa"
          unit="MB"
          label="メモリ使用量（直近5分）"
          current={last?.memoryMB ?? 0}
        />
      </div>
      {status !== 'running' && (
        <p className="text-xs text-neutral-500">
          ※ グラフはサーバー起動中に1秒間隔で更新されます。
        </p>
      )}

      {/* Recent logs */}
      <div className="rounded-lg border border-neutral-800 bg-neutral-900 p-4">
        <p className="mb-2 text-xs text-neutral-400">直近のログ</p>
        {recentLogs.length === 0 ? (
          <p className="text-xs text-neutral-600">ログはまだありません。</p>
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
