import { useEffect, useState } from 'react';
import { api } from '../ipc-client';
import { useServerStore } from '../store/server-store';
import type { AddonPack, AddonType, WorldInfo, WorldPacks } from '@shared/types';

const EMPTY_PACKS: WorldPacks = { behavior: [], resource: [] };

export default function Addon() {
  const installState = useServerStore((s) => s.installState);
  const status = useServerStore((s) => s.status);
  const [worlds, setWorlds] = useState<WorldInfo[]>([]);
  const [addons, setAddons] = useState<AddonPack[]>([]);
  const [packs, setPacks] = useState<WorldPacks>(EMPTY_PACKS);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState('');

  const active = worlds.find((w) => w.active);

  const reload = async () => {
    const ws = await api.listWorlds();
    setWorlds(ws);
    const ads = await api.listAddons();
    setAddons(ads);
    const a = ws.find((w) => w.active);
    setPacks(a ? await api.getWorldPacks(a.name) : EMPTY_PACKS);
  };

  useEffect(() => {
    reload();
  }, []);

  const onImport = async () => {
    setMsg(null);
    setBusy(true);
    const res = await api.importAddons();
    setBusy(false);
    if (res.cancelled) return;
    if (res.ok) {
      const count = res.imported?.length ?? 0;
      setMsg(`${count} pack${count === 1 ? '' : 's'} imported.`);
      await reload();
    } else {
      setMsg(`Import failed: ${res.error}`);
    }
  };

  const onDelete = async (a: AddonPack) => {
    if (!confirm(`Delete "${a.name}"?`)) return;
    const res = await api.deleteAddon(a.type, a.folder);
    if (res.ok) {
      setMsg(`Deleted "${a.name}".`);
      await reload();
    } else {
      setMsg(`Delete failed: ${res.error}`);
    }
  };

  const isActive = (a: AddonPack): boolean => {
    const list = a.type === 'behavior' ? packs.behavior : packs.resource;
    return list.some((e) => e.pack_id === a.uuid);
  };

  const toggleActive = async (a: AddonPack) => {
    if (!active) {
      setMsg('There is no active world.');
      return;
    }
    const list = a.type === 'behavior' ? packs.behavior : packs.resource;
    const has = list.some((e) => e.pack_id === a.uuid);
    const nextList = has
      ? list.filter((e) => e.pack_id !== a.uuid)
      : [...list, { pack_id: a.uuid, version: a.version }];
    const next: WorldPacks =
      a.type === 'behavior' ? { ...packs, behavior: nextList } : { ...packs, resource: nextList };
    setPacks(next);
    const res = await api.setWorldPacks(active.name, next);
    if (!res.ok) {
      setMsg(`Save failed: ${res.error}`);
      await reload();
    }
  };

  const grouped = (type: AddonType) => {
    const q = search.trim().toLowerCase();
    return addons.filter((a) => {
      if (a.type !== type) return false;
      if (!q) return true;
      return (
        a.name.toLowerCase().includes(q) ||
        a.folder.toLowerCase().includes(q) ||
        a.uuid.toLowerCase().includes(q)
      );
    });
  };

  const serverRunning = status === 'running' || status === 'starting';

  return (
    <div className="p-8 space-y-6 max-w-3xl">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold">Addon</h2>
          <p className="text-neutral-400">
            Manage behavior and resource packs, and enable them in the active world.
          </p>
        </div>
        <button
          type="button"
          disabled={!installState?.installed || busy}
          onClick={onImport}
          className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
        >
          📥 Import .mcpack / .mcaddon
        </button>
      </div>

      {msg && <p className="text-sm text-emerald-400">{msg}</p>}

      {active ? (
        <p className="text-xs text-neutral-400">
          Active World: <span className="text-neutral-200">{active.displayName}</span>{' '}
          <span className="text-neutral-600">（{active.name}）</span>
        </p>
      ) : (
        <p className="text-xs text-yellow-400">There is no active world. Select one on the World page.</p>
      )}
      {serverRunning && (
        <p className="text-xs text-yellow-400">
          The server is running. Changes to enabled packs will take effect the next time it starts.
        </p>
      )}

      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder={`Search packs (${addons.length})`}
        className="w-full rounded bg-neutral-800 px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-neutral-600"
      />

      <AddonGroup
        title="Behavior Packs"
        type="behavior"
        addons={grouped('behavior')}
        isActive={isActive}
        toggleActive={toggleActive}
        onDelete={onDelete}
        activeWorldName={active?.name}
      />
      <AddonGroup
        title="Resource Packs"
        type="resource"
        addons={grouped('resource')}
        isActive={isActive}
        toggleActive={toggleActive}
        onDelete={onDelete}
        activeWorldName={active?.name}
      />
    </div>
  );
}

function AddonGroup({
  title,
  addons,
  isActive,
  toggleActive,
  onDelete,
  activeWorldName,
}: {
  title: string;
  type: AddonType;
  addons: AddonPack[];
  isActive: (a: AddonPack) => boolean;
  toggleActive: (a: AddonPack) => void;
  onDelete: (a: AddonPack) => void;
  activeWorldName?: string;
}) {
  return (
    <section className="rounded-lg border border-neutral-800 bg-neutral-900 p-5">
      <h3 className="text-sm font-semibold text-neutral-200">{title}</h3>
      {addons.length === 0 ? (
        <p className="mt-3 text-sm text-neutral-500">No packs found.</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {addons.map((a) => {
            const on = isActive(a);
            return (
              <li
                key={a.folder}
                className="flex items-center justify-between rounded border border-neutral-800 bg-neutral-950/40 px-3 py-2"
              >
                <div className="min-w-0">
                  <div className="truncate text-sm text-neutral-100">{a.name}</div>
                  <div className="truncate text-xs text-neutral-500">
                    v{a.version.join('.')} · {a.uuid}
                  </div>
                </div>
                <div className="ml-3 flex items-center gap-2">
                  <label
                    className="flex items-center gap-1 text-xs text-neutral-300"
                    title={!activeWorldName ? 'There is no active world.' : ''}
                  >
                    <input
                      type="checkbox"
                      checked={on}
                      disabled={!activeWorldName}
                      onChange={() => toggleActive(a)}
                    />
                    Enabled
                  </label>
                  <button
                    type="button"
                    onClick={() => onDelete(a)}
                    className="rounded bg-red-700/80 px-2 py-1 text-xs text-white hover:bg-red-600"
                  >
                    Delete
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
