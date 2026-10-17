import { useServerStore } from '../store/server-store';
import { api } from '../ipc-client';
import type { ServerStatus } from '@shared/types';

const STATUS_LABEL: Record<ServerStatus, string> = {
  stopped: 'Stopped',
  starting: 'Starting',
  running: 'Running',
  stopping: 'Stopping',
  error: 'Error',
};

const STATUS_COLOR: Record<ServerStatus, string> = {
  stopped: 'bg-neutral-500',
  starting: 'bg-yellow-400 animate-pulse',
  running: 'bg-emerald-500',
  stopping: 'bg-yellow-400 animate-pulse',
  error: 'bg-red-500',
};

export default function ServerControl() {
  const status = useServerStore((s) => s.status);
  const running = status === 'running' || status === 'starting';
  const transitioning = status === 'starting' || status === 'stopping';

  const onClick = async () => {
    const result = running ? await api.stop() : await api.start();
    if (!result.ok && result.error) {
      // Surfaced in the console via a system log line already; no-op here.
      console.warn(result.error);
    }
  };

  return (
    <div className="border-t border-neutral-800 p-4 space-y-3">
      <button
        type="button"
        onClick={onClick}
        disabled={transitioning}
        className={
          'w-full rounded-md px-3 py-2 text-sm font-medium transition-colors ' +
          (running
            ? 'bg-red-600/80 hover:bg-red-600 text-white'
            : 'bg-emerald-600/80 hover:bg-emerald-600 text-white') +
          ' disabled:cursor-not-allowed disabled:opacity-60'
        }
      >
        {running ? '■ Stop Server' : '▶ Start Server'}
      </button>
      <div className="flex items-center gap-2 text-xs text-neutral-400">
        <span className={'inline-block h-2 w-2 rounded-full ' + STATUS_COLOR[status]} />
        <span>Status: {STATUS_LABEL[status]}</span>
      </div>
    </div>
  );
}
