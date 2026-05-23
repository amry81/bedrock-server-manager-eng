import { useEffect, useState } from 'react';
import { api } from '../ipc-client';
import { useServerStore } from '../store/server-store';
import type { BackupInfo, BackupSettings, WorldInfo } from '@shared/types';

function fmtSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return (bytes / 1024 / 1024).toFixed(1) + ' MB';
  return (bytes / 1024).toFixed(0) + ' KB';
}

function fmtBackupTime(ts: number): string {
  return new Date(ts).toLocaleString('ja-JP', { hour12: false });
}

const GAMEMODES = [
  { value: 'survival', label: 'サバイバル' },
  { value: 'creative', label: 'クリエイティブ' },
  { value: 'adventure', label: 'アドベンチャー' },
];
const DIFFICULTIES = [
  { value: 'peaceful', label: 'ピースフル' },
  { value: 'easy', label: 'イージー' },
  { value: 'normal', label: 'ノーマル' },
  { value: 'hard', label: 'ハード' },
];

export default function World() {
  const installState = useServerStore((s) => s.installState);
  const status = useServerStore((s) => s.status);
  const [worlds, setWorlds] = useState<WorldInfo[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [backups, setBackups] = useState<BackupInfo[]>([]);
  const [backupSettings, setBackupSettings] = useState<BackupSettings | null>(null);

  const canModify = status === 'stopped' || status === 'error';

  const refresh = async () => {
    setWorlds(await api.listWorlds());
  };

  const refreshBackups = async () => {
    setBackups(await api.listBackups());
  };

  useEffect(() => {
    refresh();
    refreshBackups();
    api.getBackupSettings().then(setBackupSettings);
  }, []);

  const onBackup = async (name: string) => {
    setMsg(null);
    const res = await api.createBackup(name);
    if (res.ok) {
      setMsg(`「${name}」をバックアップしました`);
      await refreshBackups();
    } else {
      setMsg(`バックアップ失敗: ${res.error}`);
    }
  };

  const onRestore = async (b: BackupInfo) => {
    setMsg(null);
    const res = await api.restoreBackup(b.id);
    if (res.ok) {
      setMsg(`「${b.world}」を復元しました`);
      await refresh();
    } else {
      setMsg(`復元失敗: ${res.error}`);
    }
  };

  const onDeleteBackup = async (b: BackupInfo) => {
    const res = await api.deleteBackup(b.id);
    if (res.ok) await refreshBackups();
    else setMsg(`削除失敗: ${res.error}`);
  };

  const updateBackupSettings = async (patch: Partial<BackupSettings>) => {
    if (!backupSettings) return;
    const next = { ...backupSettings, ...patch };
    setBackupSettings(await api.setBackupSettings(next));
  };

  const onSwitch = async (name: string) => {
    setMsg(null);
    const res = await api.switchWorld(name);
    if (res.ok) {
      setMsg(`「${name}」に切り替えました`);
      await refresh();
    } else {
      setMsg(`切替失敗: ${res.error}`);
    }
  };

  return (
    <div className="p-8 space-y-6 max-w-3xl">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold">World</h2>
          <p className="text-neutral-400">ワールドの一覧・作成・切り替え。</p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            disabled={!installState?.installed}
            onClick={async () => {
              setMsg(null);
              const res = await api.importWorld();
              if (res.cancelled) return;
              if (res.ok) {
                setMsg(`「${res.worldName}」をインポートしました`);
                await refresh();
              } else {
                setMsg(`インポート失敗: ${res.error}`);
              }
            }}
            className="rounded-md bg-neutral-700 px-4 py-2 text-sm font-medium text-neutral-100 hover:bg-neutral-600 disabled:opacity-50"
          >
            📥 .mcworld をインポート
          </button>
          <button
            type="button"
            disabled={!installState?.installed}
            onClick={() => setShowModal(true)}
            className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
          >
            ＋ 新規作成
          </button>
        </div>
      </div>

      {msg && <p className="text-sm text-emerald-400">{msg}</p>}
      {!canModify && (
        <p className="text-xs text-yellow-400">
          サーバー稼働中です。切り替え・作成は次回起動時に反映されます。
        </p>
      )}

      {!installState?.installed ? (
        <p className="text-sm text-neutral-500">サーバー本体が未インストールです。</p>
      ) : worlds.length === 0 ? (
        <p className="text-sm text-neutral-500">ワールドがありません。「新規作成」から作成してください。</p>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          {worlds.map((w) => (
            <div
              key={w.name}
              className={
                'rounded-lg border p-4 ' +
                (w.active
                  ? 'border-emerald-600/60 bg-emerald-950/20'
                  : 'border-neutral-800 bg-neutral-900')
              }
            >
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-medium text-neutral-100">{w.displayName}</h3>
                  <p className="text-xs text-neutral-500">{w.name}</p>
                </div>
                {w.active && (
                  <span className="rounded bg-emerald-600 px-2 py-0.5 text-xs text-white">
                    アクティブ
                  </span>
                )}
              </div>
              <p className="mt-2 text-xs text-neutral-500">
                {w.generated ? '生成済み' : '未生成（次回起動時に生成）'}
              </p>
              <div className="mt-3 flex gap-2">
                {!w.active && (
                  <button
                    type="button"
                    onClick={() => onSwitch(w.name)}
                    className="rounded bg-neutral-700 px-3 py-1.5 text-xs text-neutral-100 hover:bg-neutral-600"
                  >
                    切り替え
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => onBackup(w.name)}
                  className="rounded bg-neutral-700 px-3 py-1.5 text-xs text-neutral-100 hover:bg-neutral-600"
                >
                  バックアップ
                </button>
                <button
                  type="button"
                  onClick={() => api.openWorldFolder(w.name)}
                  className="rounded bg-neutral-800 px-3 py-1.5 text-xs text-neutral-300 hover:bg-neutral-700"
                >
                  フォルダを開く
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Backups (v2) */}
      {installState?.installed && (
        <section className="rounded-lg border border-neutral-800 bg-neutral-900 p-5">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-neutral-200">バックアップ</h3>
            <button
              type="button"
              onClick={() => api.openBackupsFolder()}
              className="rounded bg-neutral-800 px-2 py-1 text-xs text-neutral-300 hover:bg-neutral-700"
            >
              フォルダを開く
            </button>
          </div>

          {backupSettings && (
            <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-neutral-400">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={backupSettings.autoBackupOnStop}
                  onChange={(e) => updateBackupSettings({ autoBackupOnStop: e.target.checked })}
                />
                サーバー停止時に自動バックアップ
              </label>
              <label className="flex items-center gap-2">
                保持世代数
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={backupSettings.maxBackupsPerWorld}
                  onChange={(e) =>
                    updateBackupSettings({ maxBackupsPerWorld: Number(e.target.value) })
                  }
                  className="w-16 rounded bg-neutral-800 px-2 py-1 text-neutral-100 outline-none focus:ring-1 focus:ring-neutral-600"
                />
              </label>
            </div>
          )}

          <div className="mt-4">
            {backups.length === 0 ? (
              <p className="text-sm text-neutral-500">バックアップはまだありません。</p>
            ) : (
              <ul className="space-y-2">
                {backups.map((b) => (
                  <li
                    key={b.id}
                    className="flex items-center justify-between rounded border border-neutral-800 bg-neutral-950/40 px-3 py-2"
                  >
                    <div className="text-sm">
                      <span className="text-neutral-100">{b.world}</span>
                      <span className="ml-2 text-xs text-neutral-500">
                        {fmtBackupTime(b.ts)} · {fmtSize(b.sizeBytes)}
                      </span>
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        disabled={!canModify}
                        onClick={() => onRestore(b)}
                        title={!canModify ? 'サーバー停止中のみ復元できます' : undefined}
                        className="rounded bg-neutral-700 px-2 py-1 text-xs text-neutral-100 hover:bg-neutral-600 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        復元
                      </button>
                      <button
                        type="button"
                        onClick={() => onDeleteBackup(b)}
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
        </section>
      )}

      {showModal && (
        <CreateWorldModal
          onClose={() => setShowModal(false)}
          onCreated={async (name) => {
            setShowModal(false);
            setMsg(`「${name}」を作成しました`);
            await refresh();
          }}
          onError={(e) => setMsg(`作成失敗: ${e}`)}
        />
      )}
    </div>
  );
}

function CreateWorldModal({
  onClose,
  onCreated,
  onError,
}: {
  onClose: () => void;
  onCreated: (name: string) => void;
  onError: (e: string) => void;
}) {
  const [name, setName] = useState('');
  const [seed, setSeed] = useState('');
  const [gamemode, setGamemode] = useState('survival');
  const [difficulty, setDifficulty] = useState('easy');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!name.trim()) {
      onError('ワールド名を入力してください');
      return;
    }
    setBusy(true);
    const res = await api.createWorld({ name: name.trim(), seed: seed.trim(), gamemode, difficulty });
    setBusy(false);
    if (res.ok) onCreated(name.trim());
    else onError(res.error ?? '不明なエラー');
  };

  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-neutral-950/80 p-8">
      <div className="w-full max-w-md rounded-xl border border-neutral-800 bg-neutral-900 p-6">
        <h3 className="text-lg font-semibold">新規ワールド作成</h3>
        <div className="mt-4 space-y-4">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-neutral-400">ワールド名</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My World"
              className="rounded bg-neutral-800 px-2 py-1.5 text-sm outline-none focus:ring-1 focus:ring-neutral-600"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-neutral-400">シード値（空欄でランダム）</label>
            <input
              type="text"
              value={seed}
              onChange={(e) => setSeed(e.target.value)}
              placeholder="（任意）"
              className="rounded bg-neutral-800 px-2 py-1.5 text-sm outline-none focus:ring-1 focus:ring-neutral-600"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs text-neutral-400">ゲームモード</label>
              <select
                value={gamemode}
                onChange={(e) => setGamemode(e.target.value)}
                className="rounded bg-neutral-800 px-2 py-1.5 text-sm outline-none focus:ring-1 focus:ring-neutral-600"
              >
                {GAMEMODES.map((g) => (
                  <option key={g.value} value={g.value}>
                    {g.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-neutral-400">難易度</label>
              <select
                value={difficulty}
                onChange={(e) => setDifficulty(e.target.value)}
                className="rounded bg-neutral-800 px-2 py-1.5 text-sm outline-none focus:ring-1 focus:ring-neutral-600"
              >
                {DIFFICULTIES.map((d) => (
                  <option key={d.value} value={d.value}>
                    {d.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md bg-neutral-800 px-4 py-2 text-sm text-neutral-300 hover:bg-neutral-700"
          >
            キャンセル
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={submit}
            className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
          >
            {busy ? '作成中...' : '作成'}
          </button>
        </div>
      </div>
    </div>
  );
}
