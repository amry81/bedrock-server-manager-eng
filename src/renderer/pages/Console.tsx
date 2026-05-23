import { useEffect, useMemo, useRef, useState } from 'react';
import { useServerStore } from '../store/server-store';
import { api } from '../ipc-client';
import type { LogLevel, LogLine } from '@shared/types';

const LEVEL_COLOR: Record<LogLevel, string> = {
  INFO: 'text-neutral-300',
  WARN: 'text-yellow-400',
  ERROR: 'text-red-400',
  RAW: 'text-neutral-500',
};

const LEVEL_FILTERS: (LogLevel | 'ALL')[] = ['ALL', 'INFO', 'WARN', 'ERROR'];

function fmtTime(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleTimeString('ja-JP', { hour12: false });
}

export default function Console() {
  const logs = useServerStore((s) => s.logs);
  const status = useServerStore((s) => s.status);
  const exePath = useServerStore((s) => s.exePath);
  const selectExe = useServerStore((s) => s.selectExe);
  const clearLogs = useServerStore((s) => s.clearLogs);

  const [search, setSearch] = useState('');
  const [levelFilter, setLevelFilter] = useState<LogLevel | 'ALL'>('ALL');
  const [autoScroll, setAutoScroll] = useState(true);
  const [command, setCommand] = useState('');

  const scrollRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo<LogLine[]>(() => {
    const q = search.toLowerCase();
    return logs.filter((l) => {
      if (levelFilter !== 'ALL' && l.level !== levelFilter) return false;
      if (q && !l.text.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [logs, search, levelFilter]);

  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [filtered, autoScroll]);

  const sendCommand = async () => {
    const cmd = command.trim();
    if (!cmd) return;
    await api.sendCommand(cmd);
    setCommand('');
  };

  const canSend = status === 'running';

  return (
    <div className="flex h-full flex-col">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 border-b border-neutral-800 px-4 py-3">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="ログを検索..."
          className="w-48 rounded bg-neutral-800 px-2 py-1 text-sm text-neutral-100 outline-none focus:ring-1 focus:ring-neutral-600"
        />
        <div className="flex gap-1">
          {LEVEL_FILTERS.map((lvl) => (
            <button
              key={lvl}
              type="button"
              onClick={() => setLevelFilter(lvl)}
              className={
                'rounded px-2 py-1 text-xs ' +
                (levelFilter === lvl
                  ? 'bg-neutral-700 text-white'
                  : 'bg-neutral-800 text-neutral-400 hover:text-neutral-200')
              }
            >
              {lvl}
            </button>
          ))}
        </div>
        <label className="flex items-center gap-1 text-xs text-neutral-400">
          <input
            type="checkbox"
            checked={autoScroll}
            onChange={(e) => setAutoScroll(e.target.checked)}
          />
          自動スクロール
        </label>
        <button
          type="button"
          onClick={clearLogs}
          className="rounded bg-neutral-800 px-2 py-1 text-xs text-neutral-400 hover:text-neutral-200"
        >
          クリア
        </button>
        <div className="ml-auto flex items-center gap-2">
          <span className="max-w-[22rem] truncate text-xs text-neutral-500" title={exePath ?? ''}>
            {exePath ?? 'exe 未選択'}
          </span>
          <button
            type="button"
            onClick={selectExe}
            className="rounded bg-neutral-700 px-2 py-1 text-xs text-neutral-200 hover:bg-neutral-600"
          >
            exe を選択
          </button>
        </div>
      </div>

      {/* Log view */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-auto bg-neutral-950 px-4 py-2 font-mono text-xs leading-relaxed"
      >
        {filtered.length === 0 ? (
          <p className="text-neutral-600">ログはまだありません。</p>
        ) : (
          filtered.map((l) => (
            <div key={l.id} className="whitespace-pre-wrap break-all">
              <span className="text-neutral-600">{fmtTime(l.ts)} </span>
              <span className={LEVEL_COLOR[l.level]}>{l.text}</span>
            </div>
          ))
        )}
      </div>

      {/* Command input */}
      <div className="flex gap-2 border-t border-neutral-800 px-4 py-3">
        <input
          type="text"
          value={command}
          onChange={(e) => setCommand(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') sendCommand();
          }}
          disabled={!canSend}
          placeholder={canSend ? 'コマンドを入力 (例: list)' : 'サーバー起動後にコマンド送信できます'}
          className="flex-1 rounded bg-neutral-800 px-3 py-2 text-sm text-neutral-100 outline-none focus:ring-1 focus:ring-neutral-600 disabled:opacity-50"
        />
        <button
          type="button"
          onClick={sendCommand}
          disabled={!canSend}
          className="rounded bg-neutral-700 px-4 py-2 text-sm text-neutral-100 hover:bg-neutral-600 disabled:opacity-50"
        >
          送信
        </button>
      </div>
    </div>
  );
}
