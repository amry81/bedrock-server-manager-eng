import { useEffect, useState } from 'react';
import { api } from '../ipc-client';
import { useServerStore } from '../store/server-store';
import type { BackupInfo, BackupSettings, WorldInfo } from '@shared/types';

function fmtSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return (bytes / 1024 / 1024).toFixed(1) + ' MB';
  return (bytes / 1024).toFixed(0) + ' KB';
}

function fmtBackupTime(ts: number): string {
  return new Date(ts).toLocaleString('en-US', { hour12: false });
}

const GAMEMODES = [
  { value: 'survival', label: 'Survival' },
  { value: 'creative', label: 'Creative' },
  { value: 'adventure', label: 'Adventure' },
];
const DIFFICULTIES = [
  { value: 'peaceful', label: 'Peaceful' },
  { value: 'easy', label: 'Easy' },
  { value: 'normal', label: 'Normal' },
  { value: 'hard', label: 'Hard' },
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
      setMsg(`Created a backup of "${name}".`);
      await refreshBackups();
    } else {
      setMsg(`Backup failed: ${res.error}`);
    }
  };

  const onRestore = async (b: BackupInfo) => {
    setMsg(null);
    const res = await api.restoreBackup(b.id);
    if (res.ok) {
      setMsg(`Restored "${b.world}".`);
      await refresh();
    } else {
      setMsg(`Restore failed: ${res.error}`);
    }
  };

  const onDeleteBackup = async (b: BackupInfo) => {
    const res = await api.deleteBackup(b.id);
    if (res.ok) await refreshBackups();
    else setMsg(`Delete failed: ${res.error}`);
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
      setMsg(`Switched to "${name}".`);
      await refresh();
    } else {
      setMsg(`Switch failed: ${res.error}`);
    }
  };

  return (
    <div className="p-8 space-y-6 max-w-3xl">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold">World</h2>
          <p className="text-neutral-400">View, create, and switch between worlds.</p>
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
                setMsg(`Imported "${res.worldName}".`);
                await refresh();
              } else {
                setMsg(`Import failed: ${res.error}`);
              }
            }}
            className="rounded-md bg-neutral-700 px-4 py-2 text-sm font-medium text-neutral-100 hover:bg-neutral-600 disabled:opacity-50"
          >
            📥 Import .mcworld
          </button>
          <button
            type="button"
            disabled={!installState?.installed}
            onClick={() => setShowModal(true)}
            className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
          >
            + Create World
          </button>
        </div>
      </div>

      {msg && <p className="text-sm text-emerald-400">{msg}</p>}
      {!canModify && (
        <p className="text-xs text-yellow-400">
          The server is running. World changes and new worlds will take effect the next time it starts.
        </p>
      )}

      {!installState?.installed ? (
        <p className="text-sm text-neutral-500">The server is not installed.</p>
      ) : worlds.length === 0 ? (
        <p className="text-sm text-neutral-500">No worlds found. Select "Create World" to create one.</p>
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
                    Active
                  </span>
                )}
              </div>
              <p className="mt-2 text-xs text-neutral-500">
                {w.generated ? 'Generated' : 'Not generated (will be created on next start)'}
              </p>
              <div className="mt-3 flex gap-2">
                {!w.active && (
                  <button
                    type="button"
                    onClick={() => onSwitch(w.name)}
                    className="rounded bg-neutral-700 px-3 py-1.5 text-xs text-neutral-100 hover:bg-neutral-600"
                  >
                    Switch
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => onBackup(w.name)}
                  className="rounded bg-neutral-700 px-3 py-1.5 text-xs text-neutral-100 hover:bg-neutral-600"
                >
                  Back Up
                </button>
                <button
                  type="button"
                  onClick={() => api.openWorldFolder(w.name)}
                  className="rounded bg-neutral-800 px-3 py-1.5 text-xs text-neutral-300 hover:bg-neutral-700"
                >
                  Open Folder
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
            <h3 className="text-sm font-semibold text-neutral-200">Backups</h3>
            <button
              type="button"
              onClick={() => api.openBackupsFolder()}
              className="rounded bg-neutral-800 px-2 py-1 text-xs text-neutral-300 hover:bg-neutral-700"
            >
              Open Folder
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
                Automatically back up when the server stops
              </label>
              <label className="flex items-center gap-2">
                Backups to keep
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
              <p className="text-sm text-neutral-500">No backups yet.</p>
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
                        title={!canModify ? 'The server must be stopped to restore a backup.' : undefined}
                        className="rounded bg-neutral-700 px-2 py-1 text-xs text-neutral-100 hover:bg-neutral-600 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Restore
                      </button>
                      <button
                        type="button"
                        onClick={() => onDeleteBackup(b)}
                        className="rounded bg-red-700/80 px-2 py-1 text-xs text-white hover:bg-red-600"
                      >
                        Delete
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
            setMsg(`Created "${name}".`);
            await refresh();
          }}
          onError={(e) => setMsg(`Creation failed: ${e}`)}
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
      onError('Enter a world name.');
      return;
    }
    setBusy(true);
    const res = await api.createWorld({ name: name.trim(), seed: seed.trim(), gamemode, difficulty });
    setBusy(false);
    if (res.ok) onCreated(name.trim());
    else onError(res.error ?? 'Unknown error.');
  };

  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-neutral-950/80 p-8">
      <div className="w-full max-w-md rounded-xl border border-neutral-800 bg-neutral-900 p-6">
        <h3 className="text-lg font-semibold">Create World</h3>
        <div className="mt-4 space-y-4">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-neutral-400">World Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My World"
              className="rounded bg-neutral-800 px-2 py-1.5 text-sm outline-none focus:ring-1 focus:ring-neutral-600"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-neutral-400">Seed (leave blank for random)</label>
            <input
              type="text"
              value={seed}
              onChange={(e) => setSeed(e.target.value)}
              placeholder="Optional"
              className="rounded bg-neutral-800 px-2 py-1.5 text-sm outline-none focus:ring-1 focus:ring-neutral-600"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs text-neutral-400">Game Mode</label>
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
              <label className="text-xs text-neutral-400">Difficulty</label>
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
            Cancel
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={submit}
            className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
          >
            {busy ? 'Creating...' : 'Create'}
          </button>
        </div>
      </div>
    </div>
  );
}
