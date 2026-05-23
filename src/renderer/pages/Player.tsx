import { useEffect, useState } from 'react';
import { api } from '../ipc-client';
import { useServerStore } from '../store/server-store';
import type {
  AllowlistEntry,
  KnownPlayer,
  PermissionEntry,
  PermissionLevel,
} from '@shared/types';

type Tab = 'online' | 'allowlist' | 'operators';

export default function Player() {
  const [tab, setTab] = useState<Tab>('online');

  return (
    <div className="p-8 max-w-3xl">
      <h2 className="text-2xl font-semibold mb-4">Player</h2>
      <div className="mb-6 flex gap-1 border-b border-neutral-800">
        {(
          [
            ['online', 'Online'],
            ['allowlist', 'Allowlist'],
            ['operators', 'Operators'],
          ] as [Tab, string][]
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={
              '-mb-px border-b-2 px-4 py-2 text-sm ' +
              (tab === key
                ? 'border-emerald-500 text-white'
                : 'border-transparent text-neutral-400 hover:text-neutral-200')
            }
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'online' && <OnlineTab />}
      {tab === 'allowlist' && <AllowlistTab />}
      {tab === 'operators' && <OperatorsTab />}
    </div>
  );
}

function OnlineTab() {
  const online = useServerStore((s) => s.onlinePlayers);
  const status = useServerStore((s) => s.status);
  const running = status === 'running';

  if (!running) {
    return <p className="text-sm text-neutral-500">サーバー起動中のみオンラインプレイヤーを表示します。</p>;
  }
  if (online.length === 0) {
    return <p className="text-sm text-neutral-500">接続中のプレイヤーはいません。</p>;
  }
  return (
    <ul className="space-y-2">
      {online.map((p) => (
        <li
          key={p.name}
          className="flex items-center justify-between rounded border border-neutral-800 bg-neutral-900 px-4 py-2"
        >
          <div>
            <span className="text-sm text-neutral-100">{p.name}</span>
            {p.xuid && <span className="ml-2 text-xs text-neutral-500">xuid: {p.xuid}</span>}
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => api.sendCommand(`op "${p.name}"`)}
              className="rounded bg-neutral-700 px-2 py-1 text-xs text-neutral-100 hover:bg-neutral-600"
            >
              op 付与
            </button>
            <button
              type="button"
              onClick={() => api.sendCommand(`kick "${p.name}"`)}
              className="rounded bg-red-700/80 px-2 py-1 text-xs text-white hover:bg-red-600"
            >
              kick
            </button>
          </div>
        </li>
      ))}
    </ul>
  );
}

function AllowlistTab() {
  const [entries, setEntries] = useState<AllowlistEntry[]>([]);
  const [name, setName] = useState('');
  const [msg, setMsg] = useState<string | null>(null);

  const load = async () => setEntries(await api.getAllowlist());
  useEffect(() => {
    load();
  }, []);

  const save = async (next: AllowlistEntry[]) => {
    setEntries(next);
    const res = await api.setAllowlist(next);
    setMsg(res.ok ? '保存しました' : `保存失敗: ${res.error}`);
  };

  const add = async () => {
    const n = name.trim();
    if (!n) return;
    if (entries.some((e) => e.name.toLowerCase() === n.toLowerCase())) {
      setMsg('既に追加されています');
      return;
    }
    setName('');
    await save([...entries, { name: n, ignoresPlayerLimit: false }]);
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-neutral-400">
        allowlist.json を編集します。ホワイトリストが有効な場合、ここに登録したプレイヤーのみ接続できます。
      </p>
      <div className="flex gap-2">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && add()}
          placeholder="ゲーマータグ"
          className="flex-1 rounded bg-neutral-800 px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-neutral-600"
        />
        <button
          type="button"
          onClick={add}
          className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500"
        >
          追加
        </button>
      </div>
      {msg && <p className="text-xs text-emerald-400">{msg}</p>}

      {entries.length === 0 ? (
        <p className="text-sm text-neutral-500">登録なし。</p>
      ) : (
        <ul className="space-y-2">
          {entries.map((e, i) => (
            <li
              key={e.name}
              className="flex items-center justify-between rounded border border-neutral-800 bg-neutral-900 px-4 py-2"
            >
              <span className="text-sm text-neutral-100">{e.name}</span>
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-1 text-xs text-neutral-400">
                  <input
                    type="checkbox"
                    checked={e.ignoresPlayerLimit}
                    onChange={(ev) => {
                      const next = [...entries];
                      next[i] = { ...e, ignoresPlayerLimit: ev.target.checked };
                      save(next);
                    }}
                  />
                  人数上限を無視
                </label>
                <button
                  type="button"
                  onClick={() => save(entries.filter((_, j) => j !== i))}
                  className="rounded bg-red-700/80 px-2 py-1 text-xs text-white hover:bg-red-600"
                >
                  削除
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

const LEVELS: PermissionLevel[] = ['visitor', 'member', 'operator'];

function OperatorsTab() {
  const [entries, setEntries] = useState<PermissionEntry[]>([]);
  const [known, setKnown] = useState<KnownPlayer[]>([]);
  const [xuid, setXuid] = useState('');
  const [msg, setMsg] = useState<string | null>(null);

  const load = async () => {
    setEntries(await api.getPermissions());
    setKnown(await api.getKnownPlayers());
  };
  useEffect(() => {
    load();
  }, []);

  const save = async (next: PermissionEntry[]) => {
    setEntries(next);
    const res = await api.setPermissions(next);
    setMsg(res.ok ? '保存しました' : `保存失敗: ${res.error}`);
  };

  const addByXuid = async (value: string, level: PermissionLevel = 'operator') => {
    const x = value.trim();
    if (!x) return;
    if (entries.some((e) => e.xuid === x)) {
      setMsg('既に登録されています');
      return;
    }
    setXuid('');
    await save([...entries, { xuid: x, permission: level }]);
  };

  const nameForXuid = (x: string) => known.find((k) => k.xuid === x)?.name;
  const unregisteredKnown = known.filter((k) => !entries.some((e) => e.xuid === k.xuid));

  return (
    <div className="space-y-4">
      <p className="text-sm text-neutral-400">
        permissions.json を編集します。BDS は XUID で権限を管理します（XUID
        は一度接続したプレイヤーのログから取得されます）。
      </p>

      {/* Add from known players */}
      {unregisteredKnown.length > 0 && (
        <div className="rounded border border-neutral-800 bg-neutral-900 p-3">
          <p className="mb-2 text-xs text-neutral-400">接続履歴から追加:</p>
          <div className="flex flex-wrap gap-2">
            {unregisteredKnown.map((k) => (
              <button
                key={k.xuid}
                type="button"
                onClick={() => addByXuid(k.xuid)}
                className="rounded bg-neutral-700 px-2 py-1 text-xs text-neutral-100 hover:bg-neutral-600"
              >
                ＋ {k.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Add by raw xuid */}
      <div className="flex gap-2">
        <input
          type="text"
          value={xuid}
          onChange={(e) => setXuid(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addByXuid(xuid)}
          placeholder="XUID を直接入力"
          className="flex-1 rounded bg-neutral-800 px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-neutral-600"
        />
        <button
          type="button"
          onClick={() => addByXuid(xuid)}
          className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500"
        >
          追加
        </button>
      </div>
      {msg && <p className="text-xs text-emerald-400">{msg}</p>}

      {entries.length === 0 ? (
        <p className="text-sm text-neutral-500">登録なし。</p>
      ) : (
        <ul className="space-y-2">
          {entries.map((e, i) => (
            <li
              key={e.xuid}
              className="flex items-center justify-between rounded border border-neutral-800 bg-neutral-900 px-4 py-2"
            >
              <div>
                <span className="text-sm text-neutral-100">
                  {nameForXuid(e.xuid) ?? '(不明)'}
                </span>
                <span className="ml-2 text-xs text-neutral-500">{e.xuid}</span>
              </div>
              <div className="flex items-center gap-3">
                <select
                  value={e.permission}
                  onChange={(ev) => {
                    const next = [...entries];
                    next[i] = { ...e, permission: ev.target.value as PermissionLevel };
                    save(next);
                  }}
                  className="rounded bg-neutral-800 px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-neutral-600"
                >
                  {LEVELS.map((l) => (
                    <option key={l} value={l}>
                      {l}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => save(entries.filter((_, j) => j !== i))}
                  className="rounded bg-red-700/80 px-2 py-1 text-xs text-white hover:bg-red-600"
                >
                  削除
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
