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
      setMsg(`${count} 個のパックをインポートしました`);
      await reload();
    } else {
      setMsg(`インポート失敗: ${res.error}`);
    }
  };

  const onDelete = async (a: AddonPack) => {
    if (!confirm(`「${a.name}」を削除しますか？`)) return;
    const res = await api.deleteAddon(a.type, a.folder);
    if (res.ok) {
      setMsg(`「${a.name}」を削除しました`);
      await reload();
    } else {
      setMsg(`削除失敗: ${res.error}`);
    }
  };

  const isActive = (a: AddonPack): boolean => {
    const list = a.type === 'behavior' ? packs.behavior : packs.resource;
    return list.some((e) => e.pack_id === a.uuid);
  };

  const toggleActive = async (a: AddonPack) => {
    if (!active) {
      setMsg('アクティブワールドがありません。');
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
      setMsg(`保存失敗: ${res.error}`);
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
            ビヘイビア/リソースパックを管理し、アクティブワールドで有効化します。
          </p>
        </div>
        <button
          type="button"
          disabled={!installState?.installed || busy}
          onClick={onImport}
          className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
        >
          📥 .mcpack / .mcaddon をインポート
        </button>
      </div>

      {msg && <p className="text-sm text-emerald-400">{msg}</p>}

      {active ? (
        <p className="text-xs text-neutral-400">
          アクティブワールド: <span className="text-neutral-200">{active.displayName}</span>{' '}
          <span className="text-neutral-600">（{active.name}）</span>
        </p>
      ) : (
        <p className="text-xs text-yellow-400">アクティブワールドがありません。World 画面で選択してください。</p>
      )}
      {serverRunning && (
        <p className="text-xs text-yellow-400">
          サーバー稼働中です。有効化の変更は次回起動時に反映されます。
        </p>
      )}

      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder={`パックを検索（${addons.length}個）`}
        className="w-full rounded bg-neutral-800 px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-neutral-600"
      />

      <AddonGroup
        title="ビヘイビアパック"
        type="behavior"
        addons={grouped('behavior')}
        isActive={isActive}
        toggleActive={toggleActive}
        onDelete={onDelete}
        activeWorldName={active?.name}
      />
      <AddonGroup
        title="リソースパック"
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
        <p className="mt-3 text-sm text-neutral-500">パックがありません。</p>
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
                    title={!activeWorldName ? 'アクティブワールドがありません' : ''}
                  >
                    <input
                      type="checkbox"
                      checked={on}
                      disabled={!activeWorldName}
                      onChange={() => toggleActive(a)}
                    />
                    有効
                  </label>
                  <button
                    type="button"
                    onClick={() => onDelete(a)}
                    className="rounded bg-red-700/80 px-2 py-1 text-xs text-white hover:bg-red-600"
                  >
                    削除
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
